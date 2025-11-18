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
  },
};
