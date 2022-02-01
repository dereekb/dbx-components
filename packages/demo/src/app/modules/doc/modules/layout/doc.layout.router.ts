import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocLayoutHomeComponent } from './container/home.component';
import { DocLayoutLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/layout',
  name: 'doc.layout',
  component: DocLayoutLayoutComponent,
  redirectTo: 'doc.layout.home'
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.layout.home',
  component: DocLayoutHomeComponent,
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState,
  homeState
];
