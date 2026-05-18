import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DocHomeComponent } from './container/home.component';
import { DocLayoutComponent } from './container/layout.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  parent: 'root',
  url: '/doc',
  name: 'doc',
  redirectTo: 'doc.home',
  component: DocLayoutComponent
};

export const DOC_HOME_STATE: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.home',
  component: DocHomeComponent
};

export const DOC_LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/layout',
  name: 'doc.layout.**',
  loadChildren: () => import('./modules/layout/doc.layout.module').then((m) => m.DocLayoutModule)
};

export const DOC_ACTION_STATE: Ng2StateDeclaration = {
  url: '/action',
  name: 'doc.action.**',
  loadChildren: () => import('./modules/action/doc.action.module').then((m) => m.DocActionModule)
};

export const DOC_AUTH_STATE: Ng2StateDeclaration = {
  url: '/auth',
  name: 'doc.auth.**',
  loadChildren: () => import('./modules/auth/doc.auth.module').then((m) => m.DocAuthModule)
};

export const DOC_ROUTER_STATE: Ng2StateDeclaration = {
  url: '/router',
  name: 'doc.router.**',
  loadChildren: () => import('./modules/router/doc.router.module').then((m) => m.DocRouterModule)
};

export const DOC_TEXT_STATE: Ng2StateDeclaration = {
  url: '/text',
  name: 'doc.text.**',
  loadChildren: () => import('./modules/text/doc.text.module').then((m) => m.DocTextModule)
};

export const DOC_INTERACTION_STATE: Ng2StateDeclaration = {
  url: '/interaction',
  name: 'doc.interaction.**',
  loadChildren: () => import('./modules/interaction/doc.interaction.module').then((m) => m.DocInteractionModule)
};

export const DOC_EXTENSION_STATE: Ng2StateDeclaration = {
  url: '/extension',
  name: 'doc.extension.**',
  loadChildren: () => import('./modules/extension/doc.extension.module').then((m) => m.DocExtensionModule)
};

export const DOC_FORM_STATE: Ng2StateDeclaration = {
  url: '/form',
  name: 'doc.form.**',
  loadChildren: () => import('./modules/form/doc.form.module').then((m) => m.DocFormModule)
};

export const DOC_BUGS_STATE: Ng2StateDeclaration = {
  url: '/bugs',
  name: 'doc.bugs.**',
  loadChildren: () => import('./modules/bugs/doc.bugs.module').then((m) => m.DocBugsModule)
};

export const DOC_EXAMPLES_STATE: Ng2StateDeclaration = {
  url: '/examples',
  name: 'doc.examples.**',
  loadChildren: () => import('./modules/examples/doc.examples.module').then((m) => m.DocExamplesModule)
};

export const STATES: Ng2StateDeclaration[] = [
  //
  LAYOUT_STATE,
  DOC_HOME_STATE,
  DOC_LAYOUT_STATE,
  DOC_ACTION_STATE,
  DOC_AUTH_STATE,
  DOC_ROUTER_STATE,
  DOC_TEXT_STATE,
  DOC_INTERACTION_STATE,
  DOC_EXTENSION_STATE,
  DOC_FORM_STATE,
  DOC_BUGS_STATE,
  DOC_EXAMPLES_STATE
];
