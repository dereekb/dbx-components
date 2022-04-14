import { Ng2StateDeclaration } from '@uirouter/angular';
import { DemoAppHomeComponent } from './container/home.component';
import { DemoAppLayoutComponent } from './container/layout.component';

export const demoAppState: Ng2StateDeclaration = {
  url: '/app',
  name: 'demo.app',
  redirectTo: 'demo.app.home',
  component: DemoAppLayoutComponent
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'demo.app.home',
  component: DemoAppHomeComponent,
};

export const DEMO_APP_STATES: Ng2StateDeclaration[] = [
  demoAppState,
  homeState
];
