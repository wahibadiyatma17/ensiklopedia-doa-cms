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

    // Apply default filter for category collection only when no query params exist
    const applyDefaultFilter = () => {
      const path = window.location.pathname;
      const search = window.location.search;

      if (
        path === '/admin/content-manager/collection-types/api::category.category' &&
        (!search || search === '')
      ) {
        const newUrl = `${path}?page=1&pageSize=7&sort=rank:ASC&filters[$and][0][Main%20Category][$eq]=true`;
        window.location.href = newUrl;
      }
    };

    // Apply only on initial load
    setTimeout(applyDefaultFilter, 500);
  },
};
