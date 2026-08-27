import { errors } from '@strapi/utils';
import {
  HIJRI_MONTHS,
  MONTH_START_TYPE,
  UID,
  daysBetween,
  hijriFieldsFor,
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

const label = (row: MonthStartRow) => `${row.hijriMonth} ${row.hijriYear}`;

const monthSequence = (row: MonthStartRow) => row.hijriYear * 12 + HIJRI_MONTHS.indexOf(row.hijriMonth);

const loadMonthStartRows = (): Promise<MonthStartRow[]> =>
  strapi.db.query(UID).findMany({
    where: { type: MONTH_START_TYPE },
    select: ['id', 'date', 'hijriMonth', 'hijriYear'],
  });

const validateMonthStart = async (current: MonthStartRow, selfId: number | undefined) => {
  const utc = toUtcDay(current.date);
  if (utc == null) return;
  const seq = monthSequence(current);

  for (const row of await loadMonthStartRows()) {
    if (row.id === selfId) continue;
    const rowUtc = toUtcDay(row.date);
    if (rowUtc == null || !HIJRI_MONTHS.includes(row.hijriMonth)) continue;
    const rowSeq = monthSequence(row);

    if (rowSeq === seq) {
      throw new errors.ApplicationError(
        `${label(current)} sudah terdaftar (mulai ${isoDate(row.date)}). Ubah entri yang sudah ada, jangan membuat duplikat.`,
      );
    }
    if (rowUtc === utc) {
      throw new errors.ApplicationError(
        `Tanggal ${isoDate(current.date)} sudah dipakai sebagai awal ${label(row)}.`,
      );
    }
    if (rowSeq < seq !== rowUtc < utc) {
      throw new errors.ApplicationError(
        `Urutan tanggal tidak konsisten: ${label(current)} harus ${rowSeq < seq ? 'sesudah' : 'sebelum'} ${label(row)} (${isoDate(row.date)}).`,
      );
    }
    if (rowSeq === seq - 1) {
      const gap = daysBetween(rowUtc, utc);
      if (!VALID_MONTH_LENGTHS.includes(gap)) {
        throw new errors.ApplicationError(
          `Jarak dari awal ${label(row)} (${isoDate(row.date)}) harus 29 atau 30 hari, sekarang ${gap} hari.`,
        );
      }
    }
    if (rowSeq === seq + 1) {
      const gap = daysBetween(utc, rowUtc);
      if (!VALID_MONTH_LENGTHS.includes(gap)) {
        throw new errors.ApplicationError(
          `Jarak ke awal ${label(row)} (${isoDate(row.date)}) harus 29 atau 30 hari, sekarang ${gap} hari.`,
        );
      }
    }
  }
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
    Object.assign(data, hijriFieldsFor(current.date, toMonthStarts(await loadMonthStartRows())));
    return;
  }

  if (!HIJRI_MONTHS.includes(current.hijriMonth) || current.hijriYear == null) {
    throw new errors.ApplicationError(
      'Entri awal bulan Hijriah wajib mengisi bulan Hijriah dan tahun Hijriah.',
    );
  }
  data.hijriDate = `1 ${current.hijriMonth} ${current.hijriYear}`;
  await validateMonthStart(current, selfId);
};

const syncHijriFields = () => strapi.service(UID).syncHijriFields();

const syncIfMonthStartChanged = async (event: any) => {
  if (event.result?.type === MONTH_START_TYPE || event.state?.wasMonthStart) {
    await syncHijriFields();
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
