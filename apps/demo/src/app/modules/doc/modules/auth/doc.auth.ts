
export const DOC_AUTH_ROUTES = [{
  icon: 'visibility',
  title: 'Role Directives',
  detail: 'role directives',
  ref: 'doc.auth.role'
}];

export const DOC_AUTH_ROOT_ROUTE = {
  icon: 'fingerprint',
  title: 'Auth',
  detail: 'auth directives',
  ref: 'doc.auth',
  children: DOC_AUTH_ROUTES
};
