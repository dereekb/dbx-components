import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocHomeComponent } from './container/home.component';
import { DocLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  parent: 'root',
  url: '/doc',
  name: 'doc',
  redirectTo: 'doc.home',
  component: DocLayoutComponent
};

export const docHomeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.home',
  component: DocHomeComponent
};

export const docLayoutState: Ng2StateDeclaration = {
  url: '/layout',
  name: 'doc.layout.**',
  loadChildren: () => import('./modules/layout/doc.layout.module').then((m) => m.DocLayoutModule)
};

export const docActionState: Ng2StateDeclaration = {
  url: '/action',
  name: 'doc.action.**',
  loadChildren: () => import('./modules/action/doc.action.module').then((m) => m.DocActionModule)
};

export const docAuthState: Ng2StateDeclaration = {
  url: '/auth',
  name: 'doc.auth.**',
  loadChildren: () => import('./modules/auth/doc.auth.module').then((m) => m.DocAuthModule)
};

export const docRouterState: Ng2StateDeclaration = {
  url: '/router',
  name: 'doc.router.**',
  loadChildren: () => import('./modules/router/doc.router.module').then((m) => m.DocRouterModule)
};

export const docTextState: Ng2StateDeclaration = {
  url: '/text',
  name: 'doc.text.**',
  loadChildren: () => import('./modules/text/doc.text.module').then((m) => m.DocTextModule)
};

export const docInteractionState: Ng2StateDeclaration = {
  url: '/interaction',
  name: 'doc.interaction.**',
  loadChildren: () => import('./modules/interaction/doc.interaction.module').then((m) => m.DocInteractionModule)
};

export const docFormState: Ng2StateDeclaration = {
  url: '/form',
  name: 'doc.form.**',
  loadChildren: () => import('./modules/form/doc.form.module').then((m) => m.DocFormModule)
};

export const STATES: Ng2StateDeclaration[] = [layoutState, docHomeState, docLayoutState, docActionState, docAuthState, docRouterState, docTextState, docInteractionState, docFormState];
