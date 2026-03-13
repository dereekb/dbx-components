import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoOidcLayoutComponent } from './container/layout.component';
import { DemoOidcLoginComponent } from './container/login.component';
import { DemoOidcConsentComponent } from './container/consent.component';

export const oidcState: Ng2StateDeclaration = {
  url: '/oidc',
  name: 'demo.oidc',
  redirectTo: 'demo.home',
  component: DemoOidcLayoutComponent
};

export const oidcLoginState: Ng2StateDeclaration = {
  name: 'demo.oidc.login',
  url: '/login?uid',
  component: DemoOidcLoginComponent
};

export const oidcConsentState: Ng2StateDeclaration = {
  name: 'demo.oidc.consent',
  url: '/consent?uid&client_name&scopes',
  component: DemoOidcConsentComponent
};

export const DEMO_OIDC_STATES: Ng2StateDeclaration[] = [oidcState, oidcLoginState, oidcConsentState];
