export default {
  /**
   * Auto-assign the next rank when a *main* category is created. The value is
   * computed here at write time — one past the current highest main-category
   * rank — so it is always authoritative: two near-simultaneous creates can't
   * settle on the same stale number, and a failed admin pre-fill can't persist
   * a wrong value.
   *
   * Non-main categories keep the schema default and are ignored. Reordering of
   * existing rows is owned by the drag-and-drop plugin through update events,
   * which this create-only hook intentionally never touches.
   */
  async beforeCreate(event: { params: { data: Record<string, any> } }) {
    const { data } = event.params;

    if (data['Main Category'] !== true) return;

    const [highest] = await strapi.entityService.findMany(
      'api::category.category',
      {
        // 'Main Category' contains a space, which Strapi's generated filter
        // types don't model; the filter is valid at runtime.
        filters: { 'Main Category': true } as any,
        sort: { rank: 'desc' },
        fields: ['rank'],
        limit: 1,
      }
    );

    data.rank = (highest?.rank ?? 0) + 1;
  },
};
