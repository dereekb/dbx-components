import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoOAuthClientsComponent } from './container/clients.component';

export const oauthClientsState: Ng2StateDeclaration = {
  url: '/oauth',
  name: 'demo.app.oauth',
  redirectTo: 'demo.app.oauth.clients',
  component: DemoOAuthClientsComponent
};

export const oauthClientsListState: Ng2StateDeclaration = {
  url: '/clients',
  name: 'demo.app.oauth.clients',
  component: DemoOAuthClientsComponent
};

export const DEMO_APP_OAUTH_STATES: Ng2StateDeclaration[] = [oauthClientsState, oauthClientsListState];
