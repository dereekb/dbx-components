import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoAppOidcLayoutComponent } from './container/layout.component';
import { DemoAppOidcClientListPageComponent } from './container/list.component';
import { DemoAppOidcClientListPageRightComponent } from './container/list.right.component';
import { DemoAppOidcClientCreatePageComponent } from './container/list.create.component';

export const oidcLayoutState: Ng2StateDeclaration = {
  url: '/oidc',
  name: 'demo.app.oidc',
  redirectTo: 'demo.app.oidc.clients',
  component: DemoAppOidcLayoutComponent
};

export const oidcClientListState: Ng2StateDeclaration = {
  name: 'demo.app.oidc.clients',
  component: DemoAppOidcClientListPageComponent
};

export const oidcClientCreateState: Ng2StateDeclaration = {
  url: '/create',
  name: 'demo.app.oidc.clients.create',
  component: DemoAppOidcClientCreatePageComponent
};

export const oidcClientDetailState: Ng2StateDeclaration = {
  url: '/:id',
  name: 'demo.app.oidc.clients.client',
  component: DemoAppOidcClientListPageRightComponent
};

export const DEMO_APP_OIDC_STATES: Ng2StateDeclaration[] = [oidcLayoutState, oidcClientListState, oidcClientCreateState, oidcClientDetailState];
