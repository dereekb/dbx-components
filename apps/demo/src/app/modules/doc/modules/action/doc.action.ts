
export const DOC_ACTION_ROUTES = [{
  icon: 'sensors',
  title: 'Action Context',
  detail: 'action context',
  ref: 'doc.action.context'
}, {
  icon: 'dashboard_customize',
  title: 'Action Directives',
  detail: 'list of dbx-action directives',
  ref: 'doc.action.directives'
}, {
  icon: 'ads_click',
  title: 'Interactions',
  detail: 'interaction related action directives',
  ref: 'doc.action.interaction'
}, {
  icon: 'dynamic_form',
  title: 'Form Actions',
  detail: 'dbx-form action directives and examples',
  ref: 'doc.action.form'
}, {
  icon: 'dynamic_form',
  title: 'Action Map',
  detail: 'dbx-form action map',
  ref: 'doc.action.map'
}];

export const DOC_ACTION_ROOT_ROUTE = {
  icon: 'sensors',
  title: 'Actions',
  detail: 'actions',
  ref: 'doc.action',
  children: DOC_ACTION_ROUTES
};
