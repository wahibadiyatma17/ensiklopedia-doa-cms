import schema from './content-types/calendar-entry/schema.json';

export const UID = 'api::calendar-entry.calendar-entry';
export const MONTH_START_TYPE = 'awal_bulan_hijriah';
export const HIJRI_MONTHS: readonly string[] = schema.attributes.hijriMonth.enum;

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

export type MonthStartRow = {
  date: unknown;
  hijriMonth?: string | null;
  hijriYear?: number | null;
};

export type MonthStart = {
  utc: number;
  hijriMonth: string;
  hijriYear: number;
  length: number;
};

export type HijriFields = {
  hijriDate: string | null;
  hijriMonth: string | null;
  hijriYear: number | null;
};

export const EMPTY_HIJRI_FIELDS: HijriFields = { hijriDate: null, hijriMonth: null, hijriYear: null };

export const toUtcDay = (value: unknown): number | null => {
  if (value instanceof Date) {
    return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const match = typeof value === 'string' ? value.match(ISO_DATE) : null;
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
};

export const toIsoDate = (utc: number) => new Date(utc).toISOString().slice(0, 10);

export const daysBetween = (from: number, to: number) => (to - from) / DAY_MS;

export const toMonthStarts = (rows: MonthStartRow[]): MonthStart[] => {
  const sorted = rows
    .flatMap((row) => {
      const utc = toUtcDay(row.date);
      return utc != null && row.hijriMonth && HIJRI_MONTHS.includes(row.hijriMonth) && row.hijriYear != null
        ? [{ utc, hijriMonth: row.hijriMonth, hijriYear: row.hijriYear }]
        : [];
    })
    .sort((a, b) => a.utc - b.utc);

  return sorted.map((start, index) => ({
    ...start,
    length: sorted[index + 1] ? daysBetween(start.utc, sorted[index + 1].utc) : 30,
  }));
};

export const findMonthStart = (starts: MonthStart[], hijriMonth: string, hijriYear: number) =>
  starts.find((start) => start.hijriMonth === hijriMonth && start.hijriYear === hijriYear);

export const hijriToUtc = (start: MonthStart, day: number) => start.utc + (day - 1) * DAY_MS;

export const hijriFieldsFor = (date: unknown, starts: MonthStart[]): HijriFields => {
  const utc = toUtcDay(date);
  if (utc == null) return EMPTY_HIJRI_FIELDS;

  let start: MonthStart | undefined;
  for (const candidate of starts) {
    if (candidate.utc > utc) break;
    start = candidate;
  }
  if (!start) return EMPTY_HIJRI_FIELDS;

  const day = daysBetween(start.utc, utc) + 1;
  if (day > start.length) return EMPTY_HIJRI_FIELDS;

  return {
    hijriDate: `${day} ${start.hijriMonth} ${start.hijriYear}`,
    hijriMonth: start.hijriMonth,
    hijriYear: start.hijriYear,
  };
};

export const sameHijriFields = (a: HijriFields, b: Partial<HijriFields>) =>
  a.hijriDate === (b.hijriDate ?? null) &&
  a.hijriMonth === (b.hijriMonth ?? null) &&
  a.hijriYear === (b.hijriYear ?? null);
