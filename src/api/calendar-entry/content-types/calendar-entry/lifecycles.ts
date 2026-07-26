import { errors } from '@strapi/utils';

// Validation for the single Kalender Islam collection.
//
// Event entries (hari_besar / astronomi) just need a title. Awal-bulan
// entries form the app's Hijri conversion table, where one wrong row breaks
// dates for a whole month span — so every create/update must keep those rows
// a strictly ordered sequence of Hijri months, each lasting 29 or 30 days.

const UID = 'api::calendar-entry.calendar-entry';
const MONTH_START = 'awal_bulan_hijriah';
const DAY_MS = 86400000;

const MONTH_INDEX: Record<string, number> = {
  Muharam: 0,
  Safar: 1,
  Rabiulawal: 2,
  Rabiulakhir: 3,
  Jumadilawal: 4,
  Jumadilakhir: 5,
  Rajab: 6,
  Syakban: 7,
  Ramadan: 8,
  Syawal: 9,
  Zulqaidah: 10,
  Zulhijah: 11,
};

// Strapi date values arrive as 'YYYY-MM-DD' strings (or Date instances from
// the admin). Normalize to a UTC day number so arithmetic is timezone-proof.
const toUtcDay = (value: unknown): number | null => {
  if (value instanceof Date) {
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return null;
};

const label = (row: { hijriMonth: string; hijriYear: number }) =>
  `${row.hijriMonth} ${row.hijriYear}`;

const validate = async (event: any) => {
  const { data, where } = event.params;

  // Updates can be partial; merge over the stored row so we always validate
  // the complete resulting entry.
  let current = { ...data };
  const selfId: number | undefined = where?.id ?? data?.id;
  if (selfId != null) {
    const existing = await strapi.db.query(UID).findOne({ where: { id: selfId } });
    if (existing) current = { ...existing, ...data };
  }

  if (current.type !== MONTH_START) {
    if (typeof current.title !== 'string' || current.title.trim() === '') {
      throw new errors.ApplicationError(
        'Judul wajib diisi untuk entri hari besar atau astronomi.',
      );
    }
    return;
  }

  const { date, hijriMonth, hijriYear } = current;
  const monthIdx = MONTH_INDEX[hijriMonth];
  const utc = toUtcDay(date);
  if (monthIdx === undefined || hijriYear == null) {
    throw new errors.ApplicationError(
      'Entri awal bulan Hijriah wajib mengisi bulan Hijriah dan tahun Hijriah.',
    );
  }
  // A missing/invalid date is reported by schema validation.
  if (utc == null) return;

  const seq = hijriYear * 12 + monthIdx; // absolute Hijri month number

  const rows = await strapi.db.query(UID).findMany({ where: { type: MONTH_START } });
  for (const row of rows) {
    if (selfId != null && row.id === selfId) continue;
    const rowIdx = MONTH_INDEX[row.hijriMonth];
    const rowUtc = toUtcDay(row.date);
    if (rowIdx === undefined || rowUtc == null) continue;
    const rowSeq = row.hijriYear * 12 + rowIdx;

    if (rowSeq === seq) {
      throw new errors.ApplicationError(
        `${label(current)} sudah terdaftar (mulai ${row.date}). Ubah entri yang sudah ada, jangan membuat duplikat.`,
      );
    }
    if (rowUtc === utc) {
      throw new errors.ApplicationError(
        `Tanggal ${current.date} sudah dipakai sebagai awal ${label(row)}.`,
      );
    }
    if (rowSeq < seq !== rowUtc < utc) {
      throw new errors.ApplicationError(
        `Urutan tanggal tidak konsisten: ${label(current)} harus ${rowSeq < seq ? 'sesudah' : 'sebelum'} ${label(row)} (${row.date}).`,
      );
    }
    if (rowSeq === seq - 1) {
      const gap = (utc - rowUtc) / DAY_MS;
      if (gap !== 29 && gap !== 30) {
        throw new errors.ApplicationError(
          `Jarak dari awal ${label(row)} (${row.date}) harus 29 atau 30 hari, sekarang ${gap} hari.`,
        );
      }
    }
    if (rowSeq === seq + 1) {
      const gap = (rowUtc - utc) / DAY_MS;
      if (gap !== 29 && gap !== 30) {
        throw new errors.ApplicationError(
          `Jarak ke awal ${label(row)} (${row.date}) harus 29 atau 30 hari, sekarang ${gap} hari.`,
        );
      }
    }
  }
};

export default {
  beforeCreate: validate,
  beforeUpdate: validate,
};
