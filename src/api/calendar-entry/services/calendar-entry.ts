import { factories } from '@strapi/strapi';
import {
  EMPTY_HIJRI_FIELDS,
  MONTH_START_TYPE,
  UID,
  hijriFieldsFor,
  sameHijriFields,
  toMonthStarts,
} from '../hijri';
import type { HijriFields } from '../hijri';

const HIJRI_COLUMNS = ['id', 'date', 'type', 'hijriDate', 'hijriMonth', 'hijriYear'];

const monthStartFields = (row: { hijriMonth?: string | null; hijriYear?: number | null }): HijriFields =>
  row.hijriMonth && row.hijriYear != null
    ? {
        hijriDate: `1 ${row.hijriMonth} ${row.hijriYear}`,
        hijriMonth: row.hijriMonth,
        hijriYear: row.hijriYear,
      }
    : EMPTY_HIJRI_FIELDS;

export default factories.createCoreService(UID, ({ strapi }) => ({
  async syncHijriFields(): Promise<number> {
    const rows = await strapi.db.query(UID).findMany({ select: HIJRI_COLUMNS });
    const starts = toMonthStarts(rows.filter((row) => row.type === MONTH_START_TYPE));

    const stale = rows.flatMap((row) => {
      const next =
        row.type === MONTH_START_TYPE ? monthStartFields(row) : hijriFieldsFor(row.date, starts);
      return sameHijriFields(next, row) ? [] : [{ id: row.id, next }];
    });

    await strapi.db.transaction(async () => {
      for (const { id, next } of stale) {
        await strapi.db.query(UID).updateMany({ where: { id }, data: next });
      }
    });

    return stale.length;
  },
}));
