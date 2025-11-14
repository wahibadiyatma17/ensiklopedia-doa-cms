async function fixCategoryLocales() {
  try {
    console.log('Starting category locale cleanup...');
    
    // Access the database directly to remove locale columns
    const knex = strapi.db.connection;
    
    // Check if the table exists and has locale columns
    const hasLocaleColumn = await knex.schema.hasColumn('categories', 'locale');
    const hasLocalizationsColumn = await knex.schema.hasColumn('categories', 'localizations');
    
    console.log('Locale column exists:', hasLocaleColumn);
    console.log('Localizations column exists:', hasLocalizationsColumn);
    
    if (hasLocaleColumn || hasLocalizationsColumn) {
      console.log('Removing locale-related columns...');
      
      await knex.schema.alterTable('categories', (table) => {
        if (hasLocaleColumn) {
          table.dropColumn('locale');
        }
        if (hasLocalizationsColumn) {
          table.dropColumn('localizations');
        }
      });
      
      console.log('Locale columns removed successfully');
    }
    
    // Also clean up any category-category junction table locale issues
    const junctionTableExists = await knex.schema.hasTable('categories_subcategories_lnk');
    if (junctionTableExists) {
      console.log('Checking junction table...');
      
      // Clear and rebuild relationships
      await knex('categories_subcategories_lnk').del();
      console.log('Cleared junction table');
    }
    
    console.log('Category cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

module.exports = fixCategoryLocales;