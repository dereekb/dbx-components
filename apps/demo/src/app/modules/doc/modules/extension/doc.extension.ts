export const DOC_EXTENSION_ROUTES = [
  {
    icon: 'event',
    title: 'Calendar',
    detail: 'dbx-calendar',
    ref: 'doc.extension.calendar'
  },
  {
    icon: 'code',
    title: 'Widget',
    detail: 'dbx-widget-view',
    ref: 'doc.extension.widget'
  }
];

export const DOC_EXTENSION_ROOT_ROUTE = {
  icon: 'list_alt',
  title: 'Extensions',
  detail: 'dbx-web extensions',
  ref: 'doc.extension',
  children: DOC_EXTENSION_ROUTES
};
