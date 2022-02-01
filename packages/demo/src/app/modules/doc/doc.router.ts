import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocHomeComponent } from './container/home.component';
import { DocLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  parent: 'app',
  url: '/doc',
  name: 'doc',
  redirectTo: 'doc.home',
  component: DocLayoutComponent,
};

export const docHomeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.home',
  component: DocHomeComponent
};

export const docLayoutState: Ng2StateDeclaration = {
  url: '/layout',
  name: 'doc.layout.**',
  loadChildren: () => import('./modules/layout/doc.layout.module').then(m => m.DocLayoutModule)
};

export const docRouterState: Ng2StateDeclaration = {
  url: '/router',
  name: 'doc.router.**',
  loadChildren: () => import('./modules/router/doc.router.module').then(m => m.DocRouterModule)
};

export const docTextState: Ng2StateDeclaration = {
  url: '/text',
  name: 'doc.text.**',
  loadChildren: () => import('./modules/text/doc.text.module').then(m => m.DocTextModule)
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState,
  docHomeState,
  docLayoutState,
  docRouterState,
  docTextState
];
