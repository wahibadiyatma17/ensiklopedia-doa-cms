import { errors } from '@strapi/utils';
import {
  ANCHORABLE_TYPE,
  HIJRI_MONTHS,
  MONTH_START_TYPE,
  UID,
  daysBetween,
  hijriAnchorOf,
  hijriFieldsFor,
  monthLabel,
  toIsoDate,
  toMonthStarts,
  toUtcDay,
} from '../../hijri';

type MonthStartRow = { id?: number; date: unknown; hijriMonth: string; hijriYear: number };

const VALID_MONTH_LENGTHS = [29, 30];

const isoDate = (value: unknown) => {
  const utc = toUtcDay(value);
  return utc == null ? String(value) : toIsoDate(utc);
};

const monthSequence = (row: MonthStartRow) => row.hijriYear * 12 + HIJRI_MONTHS.indexOf(row.hijriMonth);

const loadMonthStartRows = (): Promise<MonthStartRow[]> =>
  strapi.db.query(UID).findMany({
    where: { type: MONTH_START_TYPE },
    select: ['id', 'date', 'hijriMonth', 'hijriYear'],
  });

const validateMonthStart = (current: MonthStartRow, others: MonthStartRow[]) => {
  const utc = toUtcDay(current.date);
  if (utc == null) return;
  const seq = monthSequence(current);

  for (const row of others) {
    const rowUtc = toUtcDay(row.date);
    if (rowUtc == null || !HIJRI_MONTHS.includes(row.hijriMonth)) continue;
    const rowSeq = monthSequence(row);

    if (rowSeq === seq) {
      throw new errors.ApplicationError(
        `${monthLabel(current)} sudah terdaftar (mulai ${isoDate(row.date)}). Ubah entri yang sudah ada, jangan membuat duplikat.`,
      );
    }
    if (rowUtc === utc) {
      throw new errors.ApplicationError(
        `Tanggal ${isoDate(current.date)} sudah dipakai sebagai awal ${monthLabel(row)}.`,
      );
    }
    if (rowSeq < seq !== rowUtc < utc) {
      throw new errors.ApplicationError(
        `Urutan tanggal tidak konsisten: ${monthLabel(current)} harus ${rowSeq < seq ? 'sesudah' : 'sebelum'} ${monthLabel(row)} (${isoDate(row.date)}).`,
      );
    }
    if (rowSeq === seq - 1) {
      const gap = daysBetween(rowUtc, utc);
      if (!VALID_MONTH_LENGTHS.includes(gap)) {
        throw new errors.ApplicationError(
          `Jarak dari awal ${monthLabel(row)} (${isoDate(row.date)}) harus 29 atau 30 hari, sekarang ${gap} hari.`,
        );
      }
    }
    if (rowSeq === seq + 1) {
      const gap = daysBetween(utc, rowUtc);
      if (!VALID_MONTH_LENGTHS.includes(gap)) {
        throw new errors.ApplicationError(
          `Jarak ke awal ${monthLabel(row)} (${isoDate(row.date)}) harus 29 atau 30 hari, sekarang ${gap} hari.`,
        );
      }
    }
  }
};

const assertFollowersStillFit = async (current: MonthStartRow, rows: MonthStartRow[], others: MonthStartRow[]) => {
  const lengthsBefore = new Map(toMonthStarts(rows).map((start) => [monthLabel(start), start.length]));
  const shortened = toMonthStarts([...others, current]).filter(
    (start) => start.length < (lengthsBefore.get(monthLabel(start)) ?? Infinity),
  );
  if (shortened.length === 0) return;

  const lengths = new Map(shortened.map((start) => [monthLabel(start), start.length]));
  const followers = await strapi.db.query(UID).findMany({
    where: {
      type: ANCHORABLE_TYPE,
      followsHijri: true,
      $or: shortened.map(({ hijriMonth, hijriYear }) => ({ hijriMonth, hijriYear })),
    },
    select: ['title', 'type', 'followsHijri', 'hijriDate', 'hijriMonth', 'hijriYear'],
  });
  const stranded = followers.filter((row) => {
    const anchor = hijriAnchorOf(row);
    return anchor != null && anchor.day > lengths.get(monthLabel(anchor));
  });
  if (stranded.length === 0) return;

  const strandedMonths = new Set(stranded.map(monthLabel));
  const months = shortened
    .filter((start) => strandedMonths.has(monthLabel(start)))
    .map((start) => `${monthLabel(start)} menjadi ${start.length} hari`)
    .join(', ');
  const entries = stranded.map((row) => `"${row.title}" (${row.hijriDate})`).join(', ');
  throw new errors.ApplicationError(
    `${months}, padahal ada entri yang mengikuti tanggal Hijriah di luar panjang bulan itu: ${entries}. Pindahkan entri tersebut atau matikan followsHijri-nya, lalu simpan ulang.`,
  );
};

const validate = async (event: any) => {
  const { data, where } = event.params;
  const selfId: number | undefined = where?.id ?? data?.id;
  const existing = selfId != null ? await strapi.db.query(UID).findOne({ where: { id: selfId } }) : null;
  const current = { ...existing, ...data };
  event.state.wasMonthStart = existing?.type === MONTH_START_TYPE;

  if (current.type !== MONTH_START_TYPE) {
    if (typeof current.title !== 'string' || current.title.trim() === '') {
      throw new errors.ApplicationError('Judul wajib diisi untuk entri hari besar atau astronomi.');
    }
    data.followsHijri = current.type === ANCHORABLE_TYPE && current.followsHijri === true;
    Object.assign(data, hijriFieldsFor(current.date, toMonthStarts(await loadMonthStartRows())));
    return;
  }

  if (!HIJRI_MONTHS.includes(current.hijriMonth) || current.hijriYear == null) {
    throw new errors.ApplicationError(
      'Entri awal bulan Hijriah wajib mengisi bulan Hijriah dan tahun Hijriah.',
    );
  }
  data.followsHijri = false;
  data.hijriDate = `1 ${current.hijriMonth} ${current.hijriYear}`;

  const rows = await loadMonthStartRows();
  const others = rows.filter((row) => row.id !== selfId);
  validateMonthStart(current, others);
  await assertFollowersStillFit(current, rows, others);
};

const syncHijriFields = () => strapi.service(UID).syncHijriFields();

const syncIfMonthStartChanged = async (event: any) => {
  if (event.result?.type !== MONTH_START_TYPE && !event.state?.wasMonthStart) return;
  const { moved } = await syncHijriFields();
  if (moved > 0) {
    strapi.log.info(`Kalender Islam: ${moved} entri ikut bergeser mengikuti tanggal Hijriahnya.`);
  }
};

export default {
  beforeCreate: validate,
  beforeUpdate: validate,
  afterCreate: syncIfMonthStartChanged,
  afterUpdate: syncIfMonthStartChanged,
  afterDelete: syncIfMonthStartChanged,
  afterDeleteMany: syncHijriFields,
};
