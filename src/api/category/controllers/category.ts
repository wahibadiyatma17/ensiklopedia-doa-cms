/**
 *  category controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::category.category', () => ({
  async find(ctx) {
    // Add default filter for main categories unless explicitly filtered
    if (!ctx.query.filters) {
      ctx.query.filters = {};
    }
    
    // Only apply default filter if Main Category is not already specified
    const filters = ctx.query.filters as any;
    if (!filters['Main Category']) {
      filters['Main Category'] = { $eq: true };
    }

    // Call the default core action
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },
}));
