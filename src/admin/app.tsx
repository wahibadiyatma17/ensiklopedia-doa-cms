import type { StrapiApp } from '@strapi/strapi/admin';
import { 
  setPluginConfig, 
  defaultHtmlPreset 
} from '@_sh/strapi-plugin-ckeditor';

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
  register() {
    setPluginConfig(ckeditorConfig);
  },
  bootstrap(app: StrapiApp) {
    console.log('Admin customization loaded');

    // Add white text styling for CKEditor
    const addCKEditorStyles = () => {
      const style = document.createElement('style');
      style.id = 'ckeditor-white-text';
      style.textContent = `
        /* CKEditor white text styling */
        .ck.ck-editor__editable,
        .ck.ck-editor__editable * {
          color: white !important;
        }
        
        .ck.ck-editor__editable p,
        .ck.ck-editor__editable div,
        .ck.ck-editor__editable span,
        .ck.ck-editor__editable h1,
        .ck.ck-editor__editable h2,
        .ck.ck-editor__editable h3,
        .ck.ck-editor__editable h4,
        .ck.ck-editor__editable h5,
        .ck.ck-editor__editable h6,
        .ck.ck-editor__editable li,
        .ck.ck-editor__editable ul,
        .ck.ck-editor__editable ol,
        .ck.ck-editor__editable strong,
        .ck.ck-editor__editable em,
        .ck.ck-editor__editable i,
        .ck.ck-editor__editable b {
          color: white !important;
        }
        
        /* Ensure new content has white color by default */
        .ck-content {
          color: white !important;
        }
        
        /* Override any black text that might be set */
        .ck.ck-editor__editable [style*="color: rgb(0, 0, 0)"],
        .ck.ck-editor__editable [style*="color:#000000"],
        .ck.ck-editor__editable [style*="color: black"] {
          color: white !important;
        }
      `;
      
      // Remove existing style if present
      const existing = document.getElementById('ckeditor-white-text');
      if (existing) {
        existing.remove();
      }
      
      document.head.appendChild(style);
    };

    // Apply styles immediately and when DOM changes
    addCKEditorStyles();
    
    // Monitor for CKEditor initialization
    const ckEditorObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const element = node as Element;
            if (element.classList?.contains('ck-editor') ||
                element.querySelector?.('.ck-editor')) {
              setTimeout(addCKEditorStyles, 100);
            }
          }
        });
      });
    });
    
    ckEditorObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

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
