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

export const STATES: Ng2StateDeclaration[] = [
  layoutState,
  homeState
];
