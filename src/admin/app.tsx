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

      if (path === '/admin/content-manager/collection-types/api::category.category') {
        // Check if no query params exist OR if it has the specific params to redirect
        const shouldRedirect =
          !search || search === '' || search === '?page=1&pageSize=10&sort=rank%3AASC';

        if (shouldRedirect) {
          const newUrl = `${path}?page=1&pageSize=16&sort=rank:ASC&filters[$and][0][Main%20Category][$eq]=true`;
          window.location.href = newUrl;
        }
      }
    };

    // Apply on initial load
    setTimeout(applyDefaultFilter, 500);

    // Monitor for navigation changes (popstate for back/forward)
    window.addEventListener('popstate', () => {
      setTimeout(applyDefaultFilter, 100);
    });

    // Monitor for DOM changes to detect SPA navigation
    const observer = new MutationObserver(() => {
      applyDefaultFilter();
    });

    // Start observing after a delay to ensure the app is loaded
    setTimeout(() => {
      const targetNode = document.querySelector('[data-strapi="app"]') || document.body;
      observer.observe(targetNode, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['data-testid', 'class']
      });
    }, 1000);
  },
};
