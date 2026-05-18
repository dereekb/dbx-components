import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoAuthAuthorizeComponent } from './container/authorize.component';
import { DemoAuthErrorComponent } from './container/error.component';
import { DemoAuthLayoutComponent } from './container/layout.component';
import { DemoAuthLoggedOutComponent } from './container/loggedout.component';
import { DemoAuthLoginComponent } from './container/login.component';
import { DemoAuthResetPasswordComponent } from './container/reset.component';

export const AUTH_STATE: Ng2StateDeclaration = {
  url: '/auth?target',
  name: 'demo.auth',
  redirectTo: 'demo.auth.login',
  component: DemoAuthLayoutComponent
};

export const AUTH_LOGIN_STATE: Ng2StateDeclaration = {
  name: 'demo.auth.login',
  url: '/login',
  component: DemoAuthLoginComponent
};

export const AUTH_LOGIN_ERROR_STATE: Ng2StateDeclaration = {
  name: 'demo.auth.error',
  url: '/error',
  component: DemoAuthErrorComponent
};

export const AUTH_LOGGED_OUT_STATE: Ng2StateDeclaration = {
  name: 'demo.auth.loggedout',
  url: '/loggedout',
  component: DemoAuthLoggedOutComponent
};

export const AUTH_LOGIN_AUTHORIZE_STATE: Ng2StateDeclaration = {
  name: 'demo.auth.authorize',
  url: '/authorize?code&state',
  component: DemoAuthAuthorizeComponent
};

export const AUTH_RESET_PASSWORD_STATE: Ng2StateDeclaration = {
  name: 'demo.auth.reset',
  url: '/reset?oobCode',
  component: DemoAuthResetPasswordComponent
};

export const DEMO_AUTH_STATES: Ng2StateDeclaration[] = [AUTH_STATE, AUTH_LOGIN_STATE, AUTH_LOGIN_ERROR_STATE, AUTH_LOGGED_OUT_STATE, AUTH_LOGIN_AUTHORIZE_STATE, AUTH_RESET_PASSWORD_STATE];
