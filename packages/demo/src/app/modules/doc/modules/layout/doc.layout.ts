
export const DOC_LAYOUT_ROUTES = [{
  icon: 'view_module',
  title: 'Bar',
  ref: 'doc.layout.bar'
}, {
  icon: 'view_module',
  title: 'Content',
  ref: 'doc.layout.content'
}, {
  icon: 'view_module',
  title: 'Section',
  ref: 'doc.layout.section'
}];

export const DOC_LAYOUT_ROOT_ROUTE = {
  icon: 'view_module',
  title: 'Layout',
  ref: 'doc.layout.home',
  children: DOC_LAYOUT_ROUTES
};
