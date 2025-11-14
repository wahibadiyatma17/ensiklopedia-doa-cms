const fs = require('fs');

// This script needs to be run with Strapi's bootstrap context
// It should be placed in the scripts/ directory and run with: npm run strapi script import-to-strapi.js

module.exports = async ({ strapi }) => {
  try {
    console.log('Starting data import...');
    
    // Read converted data
    const categoriesData = JSON.parse(fs.readFileSync('import-output/categories.json', 'utf8'));
    const doasData = JSON.parse(fs.readFileSync('import-output/doas.json', 'utf8'));
    
    console.log(`Found ${categoriesData.length} categories and ${doasData.length} doas to import`);
    
    // Import categories first
    console.log('Importing categories...');
    const categoryMap = new Map(); // Map original ID to new Strapi ID
    
    for (const categoryData of categoriesData) {
      try {
        const existing = await strapi.entityService.findMany('api::category.category', {
          filters: { slug: categoryData.slug },
          limit: 1
        });
        
        if (existing && existing.length > 0) {
          console.log(`Category "${categoryData.name}" already exists, skipping...`);
          categoryMap.set(categoryData.id, existing[0].id);
          continue;
        }
        
        const created = await strapi.entityService.create('api::category.category', {
          data: {
            name: categoryData.name,
            slug: categoryData.slug,
            description: categoryData.description,
            publishedAt: categoryData.publishedAt
          }
        });
        
        categoryMap.set(categoryData.id, created.id);
        console.log(`Created category: ${categoryData.name}`);
        
      } catch (error) {
        console.error(`Error creating category ${categoryData.name}:`, error.message);
      }
    }
    
    // Import doas
    console.log('Importing doas...');
    let imported = 0;
    
    for (const doaData of doasData) {
      try {
        const existing = await strapi.entityService.findMany('api::doa.doa', {
          filters: { slug: doaData.slug },
          limit: 1
        });
        
        if (existing && existing.length > 0) {
          console.log(`Doa "${doaData.title}" already exists, skipping...`);
          continue;
        }
        
        // Map category ID
        const categoryId = categoryMap.get(doaData.category);
        
        const doaToCreate = {
          title: doaData.title,
          slug: doaData.slug,
          arab: doaData.arab === 'null' ? null : doaData.arab,
          indo: doaData.indo === '-' ? null : doaData.indo,
          latin: doaData.latin === '-' ? null : doaData.latin,
          status: doaData.status,
          state: doaData.state,
          orderNum: doaData.orderNum,
          publishedAt: doaData.publishedAt
        };
        
        if (categoryId) {
          doaToCreate.category = categoryId;
        }
        
        const created = await strapi.entityService.create('api::doa.doa', {
          data: doaToCreate
        });
        
        imported++;
        console.log(`Created doa: ${doaData.title}`);
        
      } catch (error) {
        console.error(`Error creating doa ${doaData.title}:`, error.message);
      }
    }
    
    console.log(`\nImport completed!`);
    console.log(`Categories: ${categoryMap.size}`);
    console.log(`Doas: ${imported}`);
    
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
};