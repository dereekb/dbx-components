import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoOAuthLayoutComponent } from './container/layout.component';
import { DemoOAuthLoginComponent } from './container/login.component';
import { DemoOAuthConsentComponent } from './container/consent.component';

export const oauthState: Ng2StateDeclaration = {
  url: '/oauth',
  name: 'demo.oauth',
  redirectTo: 'demo.home',
  component: DemoOAuthLayoutComponent
};

export const oauthLoginState: Ng2StateDeclaration = {
  name: 'demo.oauth.login',
  url: '/login?uid',
  component: DemoOAuthLoginComponent
};

export const oauthConsentState: Ng2StateDeclaration = {
  name: 'demo.oauth.consent',
  url: '/consent?uid&client_name&scopes',
  component: DemoOAuthConsentComponent
};

export const DEMO_OAUTH_STATES: Ng2StateDeclaration[] = [oauthState, oauthLoginState, oauthConsentState];
