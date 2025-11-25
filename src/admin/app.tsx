import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    locales: [],
    translations: {
      en: {
        'Auth.form.welcome.title': 'Welcome to Ensiklopedia Doa CMS',
        'Auth.form.welcome.subtitle': 'Log in to your account',
      },
    },
  },
  bootstrap(app: StrapiApp) {
    console.log('Admin customization loaded');
    
    // Apply default filter for category collection
    const applyDefaultFilter = () => {
      const path = window.location.pathname;
      const search = window.location.search;
      
      if (path === '/admin/content-manager/collection-types/api::category.category' && 
          !search.includes('filters')) {
        const newUrl = `${path}?page=1&pageSize=7&sort=rank:ASC&filters[$and][0][Main%20Category][$eq]=true`;
        window.location.href = newUrl;
      }
    };
    
    // Apply on initial load and navigation
    setTimeout(applyDefaultFilter, 500);
    
    // Monitor for navigation changes
    const observer = new MutationObserver(() => {
      applyDefaultFilter();
    });
    
    setTimeout(() => {
      const targetNode = document.querySelector('[data-strapi="app"]') || document.body;
      observer.observe(targetNode, { childList: true, subtree: true });
    }, 1000);
  },
};
