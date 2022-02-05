
export const DOC_ROUTER_ROUTES = [{
  icon: 'route',
  title: 'Anchor',
  detail: 'dbx-anchor',
  ref: 'doc.router.anchor'
}, {
  icon: 'route',
  title: 'Anchor List',
  detail: 'dbx-anchor',
  ref: 'doc.router.anchorlist'
}, {
  icon: 'route',
  title: 'Nav Bar',
  detail: 'dbx-anchor',
  ref: 'doc.router.navbar'
}];

export const DOC_ROUTER_ROOT_ROUTE = {
  icon: 'route',
  title: 'Router',
  ref: 'doc.router',
  children: DOC_ROUTER_ROUTES
};
