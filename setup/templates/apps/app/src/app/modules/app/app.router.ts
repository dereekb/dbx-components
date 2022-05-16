import { Ng2StateDeclaration } from '@uirouter/angular';
import { AppHomeComponent } from './container/home.component';
import { AppLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  parent: 'root',
  url: '/app',
  name: 'app',
  redirectTo: 'app.home',
  component: AppLayoutComponent,
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'app.home',
  component: AppHomeComponent,
};

export const loginState: Ng2StateDeclaration = {
  url: '/login',
  name: 'app.login',
  redirectTo: 'app.auth.login'
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState,
  homeState,
  loginState
];
