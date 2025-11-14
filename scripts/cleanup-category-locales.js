const strapi = require('@strapi/strapi');

async function cleanupCategoryLocales() {
  try {
    const app = await strapi().load();
    
    // Get all categories
    const categories = await strapi.documents('api::category.category').findMany({
      populate: ['subcategories', 'categories']
    });
    
    console.log(`Found ${categories.length} categories to clean up`);
    
    // Remove locale-related data and fix relationships
    for (const category of categories) {
      try {
        await strapi.documents('api::category.category').update({
          documentId: category.documentId,
          data: {
            name: category.name,
            slug: category.slug,
            description: category.description,
            // Clear relationships temporarily to avoid circular issues
            subcategories: [],
            categories: []
          }
        });
        console.log(`Cleaned category: ${category.name}`);
      } catch (error) {
        console.error(`Error cleaning category ${category.name}:`, error.message);
      }
    }
    
    console.log('Category cleanup completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupCategoryLocales();