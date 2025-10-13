export const DOC_INTERACTION_ROUTES = [
  {
    icon: 'ads_click',
    title: 'Button',
    detail: 'dbx-button',
    ref: 'doc.interaction.button'
  },
  {
    icon: 'warning',
    title: 'Error',
    detail: 'dbx-error',
    ref: 'doc.interaction.error'
  },
  {
    icon: 'refresh',
    title: 'Loading',
    detail: 'dbx-loading',
    ref: 'doc.interaction.loading'
  },
  {
    icon: 'call_to_action',
    title: 'Dialog',
    detail: 'dbx-dialog',
    ref: 'doc.interaction.dialog'
  },
  {
    icon: 'filter_list',
    title: 'Filter',
    detail: 'dbx-filter',
    ref: 'doc.interaction.filter'
  },
  {
    icon: 'picture_in_picture',
    title: 'Prompt',
    detail: 'dbx-prompt',
    ref: 'doc.interaction.prompt'
  },
  {
    icon: 'picture_in_picture',
    title: 'Popover',
    detail: 'dbx-popover',
    ref: 'doc.interaction.popover'
  },
  {
    icon: 'picture_in_picture',
    title: 'Popup',
    detail: 'dbx-popup',
    ref: 'doc.interaction.popup'
  },
  {
    icon: 'picture_in_picture',
    title: 'Iframe',
    detail: 'dbx-iframe',
    ref: 'doc.interaction.iframe'
  },
  {
    icon: 'upload',
    title: 'Upload',
    detail: 'dbx-upload-area',
    ref: 'doc.interaction.upload'
  }
];

export const DOC_INTERACTION_ROOT_ROUTE = {
  icon: 'picture_in_picture',
  title: 'Interaction',
  detail: 'interactions',
  ref: 'doc.interaction',
  children: DOC_INTERACTION_ROUTES
};
