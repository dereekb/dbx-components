import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoHomeComponent } from './container/home.component';
import { DemoLayoutComponent } from './container/layout.component';
import { type HasAuthStateData, redirectBasedOnAuthUserState } from '@dereekb/dbx-core';
import { DEMO_APP_STATE_DATA } from './modules/app/demo.app.router.auth';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  parent: 'root',
  url: '/demo',
  name: 'demo',
  redirectTo: 'demo.home',
  component: DemoLayoutComponent
};

export const HOME_STATE: Ng2StateDeclaration = {
  url: '/home',
  name: 'demo.home',
  component: DemoHomeComponent
};

export const LOGIN_STATE: Ng2StateDeclaration = {
  url: '/login',
  name: 'demo.login',
  redirectTo: 'demo.auth.login'
};

export const DEMO_AUTH_FUTURE_STATE: Ng2StateDeclaration = {
  name: 'demo.auth.**',
  url: '/auth',
  loadChildren: () => import('./modules/auth/demo.auth.module').then((m) => m.DemoAuthModule),
  data: {
    authStates: 'none', // User who aren't logged in.
    redirectTo: redirectBasedOnAuthUserState({
      new: { ref: 'demo.onboard' },
      user: { ref: 'demo.app' }
    })
  } as HasAuthStateData
};

export const DEMO_ONBOARD_FUTURE_STATE: Ng2StateDeclaration = {
  name: 'demo.onboard.**',
  url: '/onboard',
  loadChildren: () => import('./modules/onboard/demo.onboard.module').then((m) => m.DemoOnboardModule),
  data: {
    authStates: 'new', // New users only
    redirectTo: redirectBasedOnAuthUserState({
      user: { ref: 'demo.app' }
    })
  } as HasAuthStateData
};

export const DEMO_APP_FUTURE_STATE: Ng2StateDeclaration = {
  name: 'demo.app.**',
  url: '/app',
  loadChildren: () => import('./modules/app/demo.app.module').then((m) => m.DemoAppModule),
  data: DEMO_APP_STATE_DATA
};

export const DEMO_OAUTH_FUTURE_STATE: Ng2StateDeclaration = {
  name: 'demo.oauth.**',
  url: '/oauth',
  loadChildren: () => import('./modules/oauth/demo.oauth.module').then((m) => m.DemoOAuthModule)
};

// TODO: Add public state that also allows anonymous viewers. Anonymous users still must sign the ToS. Their signature updates their Token.

export const STATES: Ng2StateDeclaration[] = [LAYOUT_STATE, HOME_STATE, LOGIN_STATE, DEMO_ONBOARD_FUTURE_STATE, DEMO_AUTH_FUTURE_STATE, DEMO_APP_FUTURE_STATE, DEMO_OAUTH_FUTURE_STATE];
