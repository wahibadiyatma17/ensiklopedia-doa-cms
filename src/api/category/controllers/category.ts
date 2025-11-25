/**
 *  category controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::category.category', () => ({
  async find(ctx) {
    // Add default filter for main categories ONLY if no specific filters are applied
    if (!ctx.query.filters) {
      ctx.query.filters = {};
    }
    
    const filters = ctx.query.filters as any;
    const hasSpecificFilters = filters.slug || filters.documentId || filters.categories || filters.subcategories;
    
    // Only apply Main Category filter if no specific filters are provided AND Main Category is not already specified
    if (!hasSpecificFilters && !filters['Main Category']) {
      filters['Main Category'] = { $eq: true };
    }

    // Ensure populate is set to include doa and subcategories
    if (!ctx.query.populate) {
      ctx.query.populate = {
        doa: true,
        subcategories: true,
        categories: true
      };
    }

    // Call the default core action
    const { data, meta } = await super.find(ctx);
    return { data, meta };
  },

  async findOne(ctx) {
    // Ensure populate is set for single item requests
    if (!ctx.query.populate) {
      ctx.query.populate = {
        doa: true,
        subcategories: true,
        categories: true
      };
    }

    // Call the default core action
    const { data, meta } = await super.findOne(ctx);
    return { data, meta };
  },
}));
