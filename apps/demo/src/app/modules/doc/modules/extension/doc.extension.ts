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
  },
  {
    icon: 'pin_drop',
    title: 'Mapbox',
    detail: 'mapbox extension',
    ref: 'doc.extension.mapbox'
  },
  {
    icon: 'table_view',
    title: 'Table',
    detail: 'table extension',
    ref: 'doc.extension.table'
  },
  {
    icon: 'code',
    title: 'Structure',
    detail: 'structure',
    ref: 'doc.extension.structure'
  },
  {
    icon: 'download',
    title: 'Download',
    detail: 'download',
    ref: 'doc.extension.download'
  },
  {
    icon: 'upload',
    title: 'StorageFile',
    detail: 'storagefile',
    ref: 'doc.extension.storagefile'
  },
  {
    icon: 'folder',
    title: 'Zip',
    detail: 'zip',
    ref: 'doc.extension.zip'
  },
  {
    icon: 'preview',
    title: 'Web File Preview',
    detail: 'web file preview',
    ref: 'doc.extension.webfilepreview'
  },
  {
    icon: 'help',
    title: 'Help',
    detail: 'dbx-help',
    ref: 'doc.extension.help'
  }
];

export const DOC_EXTENSION_ROOT_ROUTE = {
  icon: 'list_alt',
  title: 'Extensions',
  detail: 'dbx-web extensions',
  ref: 'doc.extension',
  children: DOC_EXTENSION_ROUTES
};
