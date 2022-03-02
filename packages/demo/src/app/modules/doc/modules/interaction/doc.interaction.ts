
export const DOC_INTERACTION_ROUTES = [{
  icon: 'call_to_action',
  title: 'Dialog',
  detail: 'dbx-dialog',
  ref: 'doc.interaction.dialog'
}, {
  icon: 'filter_list',
  title: 'Filter',
  detail: 'dbx-filter',
  ref: 'doc.interaction.filter'
}, {
  icon: 'picture_in_picture',
  title: 'Prompt',
  detail: 'dbx-prompt',
  ref: 'doc.interaction.prompt'
}, {
  icon: 'picture_in_picture',
  title: 'Popover',
  detail: 'dbx-popover',
  ref: 'doc.interaction.popover'
}, {
  icon: 'picture_in_picture',
  title: 'Popup',
  detail: 'dbx-popup',
  ref: 'doc.interaction.popup'
}];

export const DOC_INTERACTION_ROOT_ROUTE = {
  icon: 'picture_in_picture',
  title: 'Interaction',
  ref: 'doc.interaction',
  children: DOC_INTERACTION_ROUTES
};
