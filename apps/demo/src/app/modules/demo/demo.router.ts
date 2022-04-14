import { Ng2StateDeclaration } from '@uirouter/angular';
import { DemoHomeComponent } from './container/home.component';
import { DemoLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  parent: 'app',
  url: '/demo',
  name: 'demo',
  redirectTo: 'demo.home',
  component: DemoLayoutComponent,
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'demo.home',
  component: DemoHomeComponent,
};

export const loginState: Ng2StateDeclaration = {
  url: '/login',
  name: 'demo.login',
  redirectTo: 'demo.auth.login'
};

export const demoAuthFutureState: Ng2StateDeclaration = {
  name: 'demo.auth.**',
  url: '/auth',
  loadChildren: () => import('./modules/auth/demo.auth.module').then(m => m.DemoAuthModule)
};

export const demoAppFutureState: Ng2StateDeclaration = {
  name: 'demo.app.**',
  url: '/app',
  loadChildren: () => import('./modules/app/demo.app.module').then(m => m.DemoAppModule)
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState,
  homeState,
  loginState,
  demoAuthFutureState
];
