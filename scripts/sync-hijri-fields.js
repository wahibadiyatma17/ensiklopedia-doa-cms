'use strict';

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const app = await createStrapi(await compileStrapi()).load();
  app.log.level = 'error';
  try {
    const { updated, moved } = await app.service('api::calendar-entry.calendar-entry').syncHijriFields();
    console.log(`Hijri fields synced: ${updated} entries updated, ${moved} of them moved to follow their Hijri date`);
  } finally {
    await app.destroy();
  }
}

main().catch((error) => {
  console.error('Sync failed:', error);
  process.exit(1);
});
