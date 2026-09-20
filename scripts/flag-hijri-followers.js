'use strict';

const describe = (row) => `  ${row.date}  ${row.title} (${row.hijriDate ?? 'tanpa tanggal Hijriah'})`;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  try {
    const { flagged, review } = await app
      .service('api::calendar-entry.calendar-entry')
      .flagHijriFollowers({ dryRun });
    console.log(`${dryRun ? 'Would flag' : 'Flagged'} ${flagged.length} entries as followsHijri`);
    console.log(`${review.length} entries left for manual review:`);
    review.forEach((row) => console.log(describe(row)));
  } finally {
    await app.destroy();
  }
}

main().catch((error) => {
  console.error('Flagging failed:', error);
  process.exit(1);
});
