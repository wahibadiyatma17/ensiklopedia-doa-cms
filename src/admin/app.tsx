import type { StrapiApp } from '@strapi/strapi/admin';
import {
  setPluginConfig,
  defaultHtmlPreset
} from '@_sh/strapi-plugin-ckeditor';
import { Hashtag } from '@strapi/icons';
import type { ComponentType } from 'react';

const ckeditorConfig = {
  presets: [defaultHtmlPreset],
};

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
  register(app: StrapiApp) {
    setPluginConfig(ckeditorConfig);

    // Auto-incrementing rank input for main categories. When Main Category is
    // turned on, it looks up the highest existing rank and pre-fills this field
    // with the next value (e.g. latest 25 -> 26).
    app.customFields.register({
      name: 'auto-rank',
      type: 'integer',
      icon: Hashtag,
      intlLabel: {
        id: 'category.auto-rank.label',
        defaultMessage: 'Rank',
      },
      intlDescription: {
        id: 'category.auto-rank.description',
        defaultMessage: 'Auto-incremented order for main categories',
      },
      components: {
        Input: async () =>
          (await import('./components/AutoRankInput')) as unknown as {
            default: ComponentType;
          },
      },
    });
  },
  bootstrap(app: StrapiApp) {
    console.log('Admin customization loaded');

    // Apply default filter for category collection and redirect content manager to Doa
    const applyDefaultFilter = () => {
      const path = window.location.pathname;
      const search = window.location.search;

      // Redirect content manager root to Category collection
      if (path === '/admin/content-manager' || path === '/admin/content-manager/') {
        const doaUrl = '/admin/content-manager/collection-types/api::category.category?page=1&pageSize=16&sort=rank:ASC&filters[$and][0][Main%20Category][$eq]=true';
        window.location.href = doaUrl;
        return;
      }

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
