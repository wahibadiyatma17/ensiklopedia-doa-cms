export default () => ({
  'drag-drop-content-types-strapi5': {
    enabled: true,
  },
  'ckeditor': {
    enabled: true,
    config: {
      preset: 'rich', // 'rich', 'standard' or 'light'
      editor: {
        ui: {
          poweredBy: {
            hide: false
          }
        }
      }
    }
  }
});
