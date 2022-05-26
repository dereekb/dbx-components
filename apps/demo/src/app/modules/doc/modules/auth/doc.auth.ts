export const DOC_AUTH_ROUTES = [
  {
    icon: 'visibility',
    title: 'Role Directives',
    detail: 'role directives',
    ref: 'doc.auth.role'
  },
  {
    icon: 'login',
    title: 'Firebase Login',
    detail: 'firebase login buttons',
    ref: 'doc.auth.firebase'
  }
];

export const DOC_AUTH_ROOT_ROUTE = {
  icon: 'fingerprint',
  title: 'Auth',
  detail: 'auth directives',
  ref: 'doc.auth',
  children: DOC_AUTH_ROUTES
};
