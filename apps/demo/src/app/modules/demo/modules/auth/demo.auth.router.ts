import { Ng2StateDeclaration } from '@uirouter/angular';
import { DemoAuthAuthorizeComponent } from './component/authorize.component';
import { DemoAuthErrorComponent } from './component/error.component';
import { DemoAuthLayoutComponent } from './component/layout.component';
import { DemoAuthLoggedOutComponent } from './component/loggedout.component';
import { DemoAuthLoginComponent } from './component/login.component';

export const authState: Ng2StateDeclaration = {
  url: '/auth?target',
  name: 'demo.auth',
  redirectTo: 'demo.auth.login',
  component: DemoAuthLayoutComponent
};

export const authLoginState: Ng2StateDeclaration = {
  name: 'demo.auth.login',
  url: '/login',
  component: DemoAuthLoginComponent,
};

export const authLoginErrorState: Ng2StateDeclaration = {
  name: 'demo.auth.error',
  url: '/error',
  component: DemoAuthErrorComponent
};

export const authLoggedOutState: Ng2StateDeclaration = {
  name: 'demo.auth.loggedout',
  url: '/loggedout',
  component: DemoAuthLoggedOutComponent
};

export const authLoginAuthorizeState: Ng2StateDeclaration = {
  name: 'demo.auth.authorize',
  url: '/authorize?code&state',
  component: DemoAuthAuthorizeComponent
};

export const DEMO_AUTH_STATES: Ng2StateDeclaration[] = [
  authState,
  authLoginState,
  authLoginErrorState,
  authLoggedOutState,
  authLoginAuthorizeState,
];
