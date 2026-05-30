import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    // Custom field that auto-fills the rank for main categories with the next
    // available value. Stored as a plain integer; the auto-increment UI lives
    // in src/admin/components/AutoRankInput.tsx.
    strapi.customFields.register({
      name: 'auto-rank',
      type: 'integer',
    });
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap(/* { strapi }: { strapi: Core.Strapi } */) {},
};
