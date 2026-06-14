import { type Ng2StateDeclaration } from '@uirouter/angular';
import { APP_CODE_PREFIXOAuthLayoutComponent } from './container/layout.component';
import { APP_CODE_PREFIXOAuthLoginComponent } from './container/login.component';
import { APP_CODE_PREFIXOAuthConsentComponent } from './container/consent.component';

/**
 * OAuth interaction parent state — the backend redirects here for login/consent flows.
 *
 * URL `/oauth` matches `APP_CODE_PREFIX_CAPS_APP_OAUTH_INTERACTION_PATH` from `FIREBASE_COMPONENTS_NAME`.
 */
export const oauthState: Ng2StateDeclaration = {
  parent: 'root',
  name: 'oauth',
  url: '/oauth',
  component: APP_CODE_PREFIXOAuthLayoutComponent,
  redirectTo: 'app'
};

export const oauthLoginState: Ng2StateDeclaration = {
  name: 'oauth.login',
  url: '/login?uid',
  component: APP_CODE_PREFIXOAuthLoginComponent
};

export const oauthConsentState: Ng2StateDeclaration = {
  name: 'oauth.consent',
  url: '/consent?uid&client_name&scopes',
  component: APP_CODE_PREFIXOAuthConsentComponent
};

export const APP_OAUTH_STATES: Ng2StateDeclaration[] = [oauthState, oauthLoginState, oauthConsentState];
