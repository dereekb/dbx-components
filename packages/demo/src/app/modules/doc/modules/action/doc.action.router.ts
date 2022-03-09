import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocActionContextComponent } from './container/context.component';
import { DocActionHomeComponent } from './container/home.component';
import { DocActionLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/action',
  name: 'doc.action',
  component: DocActionLayoutComponent,
  redirectTo: 'doc.action.home'
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.action.home',
  component: DocActionHomeComponent,
};

export const docActionContextState: Ng2StateDeclaration = {
  url: '/context',
  name: 'doc.action.context',
  component: DocActionContextComponent
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState,
  homeState,
  docActionContextState
];
