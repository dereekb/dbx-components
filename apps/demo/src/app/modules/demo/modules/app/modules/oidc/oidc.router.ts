import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoAppOidcLayoutComponent } from './container/layout.component';
import { DemoAppOidcClientListPageComponent } from './container/list.component';
import { DemoAppOidcClientListPageRightComponent } from './container/list.right.component';
import { DemoAppOidcClientCreatePageComponent } from './container/list.create.component';
import { DemoAppOidcGrantListPageComponent } from './container/grants.component';

export const OIDC_LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/oidc',
  name: 'demo.app.oidc',
  redirectTo: 'demo.app.oidc.clients',
  component: DemoAppOidcLayoutComponent
};

export const OIDC_CLIENT_LIST_STATE: Ng2StateDeclaration = {
  name: 'demo.app.oidc.clients',
  component: DemoAppOidcClientListPageComponent
};

export const OIDC_CLIENT_CREATE_STATE: Ng2StateDeclaration = {
  url: '/create',
  name: 'demo.app.oidc.clients.create',
  component: DemoAppOidcClientCreatePageComponent
};

export const OIDC_CLIENT_DETAIL_STATE: Ng2StateDeclaration = {
  url: '/:id',
  name: 'demo.app.oidc.clients.client',
  component: DemoAppOidcClientListPageRightComponent
};

export const OIDC_GRANT_LIST_STATE: Ng2StateDeclaration = {
  url: '/grants',
  name: 'demo.app.oidc.grants',
  component: DemoAppOidcGrantListPageComponent
};

export const DEMO_APP_OIDC_STATES: Ng2StateDeclaration[] = [OIDC_LAYOUT_STATE, OIDC_CLIENT_LIST_STATE, OIDC_CLIENT_CREATE_STATE, OIDC_CLIENT_DETAIL_STATE, OIDC_GRANT_LIST_STATE];
