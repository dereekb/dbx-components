export const DOC_LAYOUT_ROUTES = [
  {
    icon: 'account_circle',
    title: 'Avatar',
    detail: 'dbx-avatar',
    ref: 'doc.layout.avatar'
  },
  {
    icon: 'view_module',
    title: 'Bar',
    detail: 'dbx-bar',
    ref: 'doc.layout.bar'
  },
  {
    icon: 'view_module',
    title: 'Content',
    detail: 'dbx-content',
    ref: 'doc.layout.content'
  },
  {
    icon: 'view_module',
    title: 'Flex',
    detail: 'dbxFlexGroup',
    ref: 'doc.layout.flex'
  },
  {
    icon: 'view_module',
    title: 'Section',
    detail: 'dbx-section',
    ref: 'doc.layout.section'
  },
  {
    icon: 'view_module',
    title: 'Section Page',
    detail: 'dbx-section-page',
    ref: 'doc.layout.sectionpage'
  },
  {
    icon: 'view_module',
    title: 'Two Column Page',
    detail: 'dbx-section-page with two columns',
    ref: 'doc.layout.sectionpagetwo'
  },
  {
    icon: 'list',
    title: 'List',
    detail: 'dbx-list',
    ref: 'doc.layout.list'
  },
  {
    icon: 'table_rows',
    title: 'Two Block',
    detail: 'dbx-two-block',
    ref: 'doc.layout.block'
  },
  {
    icon: 'view_column',
    title: 'Two Columns',
    detail: 'dbx-two-column',
    ref: 'doc.layout.two'
  }
];

export const DOC_LAYOUT_ROOT_ROUTE = {
  icon: 'view_module',
  title: 'Layout',
  detail: 'layouts',
  ref: 'doc.layout',
  children: DOC_LAYOUT_ROUTES
};
