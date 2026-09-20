import { factories } from '@strapi/strapi';
import {
  ANCHORABLE_TYPE,
  EMPTY_HIJRI_FIELDS,
  MONTH_START_TYPE,
  UID,
  anchorToUtc,
  hijriAnchorOf,
  hijriFieldsFor,
  sameHijriFields,
  titleNamesHijriDate,
  toIsoDate,
  toMonthStarts,
  toUtcDay,
} from '../hijri';
import type { HijriFields, MonthStart } from '../hijri';

type SyncRow = Partial<HijriFields> & {
  id: number;
  date: unknown;
  type: string;
  title?: string | null;
  followsHijri?: boolean | null;
};

type Patch = HijriFields | { date: string };

export type SyncResult = { updated: number; moved: number };

export type FlagResult = { flagged: SyncRow[]; review: SyncRow[] };

const SYNC_COLUMNS = ['id', 'date', 'type', 'followsHijri', 'hijriDate', 'hijriMonth', 'hijriYear'];

const monthStartFields = (row: SyncRow): HijriFields =>
  row.hijriMonth && row.hijriYear != null
    ? {
        hijriDate: `1 ${row.hijriMonth} ${row.hijriYear}`,
        hijriMonth: row.hijriMonth,
        hijriYear: row.hijriYear,
      }
    : EMPTY_HIJRI_FIELDS;

const changedFields = (next: HijriFields, row: SyncRow): HijriFields | null =>
  sameHijriFields(next, row) ? null : next;

const patchFor = (row: SyncRow, starts: MonthStart[]): Patch | null => {
  if (row.type === MONTH_START_TYPE) return changedFields(monthStartFields(row), row);

  const anchor = hijriAnchorOf(row);
  if (!anchor) return changedFields(hijriFieldsFor(row.date, starts), row);

  const utc = anchorToUtc(anchor, starts);
  return utc == null || utc === toUtcDay(row.date) ? null : { date: toIsoDate(utc) };
};

const groupByPatch = (rows: SyncRow[], starts: MonthStart[]) => {
  const groups = new Map<string, { ids: number[]; patch: Patch }>();
  for (const row of rows) {
    const patch = patchFor(row, starts);
    if (!patch) continue;
    const key = JSON.stringify(patch);
    const group = groups.get(key) ?? { ids: [], patch };
    group.ids.push(row.id);
    groups.set(key, group);
  }
  return Array.from(groups.values());
};

export default factories.createCoreService(UID, ({ strapi }) => ({
  async syncHijriFields(): Promise<SyncResult> {
    const rows: SyncRow[] = await strapi.db.query(UID).findMany({ select: SYNC_COLUMNS });
    const starts = toMonthStarts(rows.filter((row) => row.type === MONTH_START_TYPE));
    const groups = groupByPatch(rows, starts);
    const updatedAt = new Date();

    await strapi.db.transaction(async () => {
      for (const { ids, patch } of groups) {
        await strapi.db.query(UID).updateMany({
          where: { id: { $in: ids } },
          data: { ...patch, updatedAt },
        });
      }
    });

    return groups.reduce<SyncResult>(
      (result, { ids, patch }) => ({
        updated: result.updated + ids.length,
        moved: result.moved + ('date' in patch ? ids.length : 0),
      }),
      { updated: 0, moved: 0 },
    );
  },

  async flagHijriFollowers({ dryRun = false } = {}): Promise<FlagResult> {
    const rows: SyncRow[] = await strapi.db.query(UID).findMany({
      where: { type: { $in: [ANCHORABLE_TYPE, MONTH_START_TYPE] } },
      select: [...SYNC_COLUMNS, 'title'],
      orderBy: { date: 'asc' },
    });
    const starts = toMonthStarts(rows.filter((row) => row.type === MONTH_START_TYPE));

    const result: FlagResult = { flagged: [], review: [] };
    for (const row of rows) {
      if (row.type !== ANCHORABLE_TYPE || row.followsHijri) continue;
      const anchor = hijriAnchorOf({ ...row, followsHijri: true });
      const isFollower =
        anchor != null &&
        sameHijriFields(hijriFieldsFor(row.date, starts), row) &&
        titleNamesHijriDate(row.title ?? '', anchor);
      (isFollower ? result.flagged : result.review).push(row);
    }

    if (!dryRun && result.flagged.length > 0) {
      await strapi.db.query(UID).updateMany({
        where: { id: { $in: result.flagged.map((row) => row.id) } },
        data: { followsHijri: true, updatedAt: new Date() },
      });
    }

    return result;
  },
}));
