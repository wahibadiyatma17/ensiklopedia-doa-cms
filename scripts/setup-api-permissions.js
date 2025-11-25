/**
 * Script to setup API permissions for categories and doa
 */

module.exports = async ({ strapi }) => {
  console.log('Setting up API permissions...');

  try {
    // Find the Public role
    const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
      where: { type: 'public' }
    });

    if (!publicRole) {
      console.log('❌ Public role not found');
      return;
    }

    console.log(`✓ Found public role (ID: ${publicRole.id})`);

    // Define permissions to create
    const permissions = [
      // Category permissions
      { action: 'api::category.category.find', role: publicRole.id },
      { action: 'api::category.category.findOne', role: publicRole.id },
      // Doa permissions  
      { action: 'api::doa.doa.find', role: publicRole.id },
      { action: 'api::doa.doa.findOne', role: publicRole.id },
    ];

    // Check and create permissions
    for (const permissionData of permissions) {
      const existingPermission = await strapi.query('plugin::users-permissions.permission').findOne({
        where: {
          action: permissionData.action,
          role: permissionData.role
        }
      });

      if (existingPermission) {
        console.log(`- Permission already exists: ${permissionData.action}`);
      } else {
        await strapi.query('plugin::users-permissions.permission').create({
          data: permissionData
        });
        console.log(`✓ Created permission: ${permissionData.action}`);
      }
    }

    console.log('\n🎉 API permissions setup completed!');

  } catch (error) {
    console.error('❌ Error setting up permissions:', error);
  }
};