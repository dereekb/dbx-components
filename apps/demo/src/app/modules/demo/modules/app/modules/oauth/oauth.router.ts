import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoAppOAuthLayoutComponent } from './container/layout.component';
import { DemoAppOAuthClientListPageComponent } from './container/list.component';
import { DemoAppOAuthClientListPageRightComponent } from './container/list.right.component';
import { DemoAppOAuthClientCreatePageComponent } from './container/list.create.component';

export const oauthLayoutState: Ng2StateDeclaration = {
  url: '/oauth',
  name: 'demo.app.oauth',
  redirectTo: 'demo.app.oauth.clients',
  component: DemoAppOAuthLayoutComponent
};

export const oauthClientListState: Ng2StateDeclaration = {
  name: 'demo.app.oauth.clients',
  component: DemoAppOAuthClientListPageComponent
};

export const oauthClientCreateState: Ng2StateDeclaration = {
  url: '/create',
  name: 'demo.app.oauth.clients.create',
  component: DemoAppOAuthClientCreatePageComponent
};

export const oauthClientDetailState: Ng2StateDeclaration = {
  url: '/:id',
  name: 'demo.app.oauth.clients.client',
  component: DemoAppOAuthClientListPageRightComponent
};

export const DEMO_APP_OAUTH_STATES: Ng2StateDeclaration[] = [oauthLayoutState, oauthClientListState, oauthClientCreateState, oauthClientDetailState];
