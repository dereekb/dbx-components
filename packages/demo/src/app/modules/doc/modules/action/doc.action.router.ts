import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocActionContextComponent } from './container/context.component';
import { DocActionDirectivesComponent } from './container/directives.component';
import { DocActionFormComponent } from './container/form.component';
import { DocActionHomeComponent } from './container/home.component';
import { DocActionLayoutComponent } from './container/layout.component';
import { DocActionMapComponent } from './container/map.component';

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

export const docActionDirectivesState: Ng2StateDeclaration = {
  url: '/directives',
  name: 'doc.action.directives',
  component: DocActionDirectivesComponent
};

export const docActionFormState: Ng2StateDeclaration = {
  url: '/form',
  name: 'doc.action.form',
  component: DocActionFormComponent
};

export const docActionMapState: Ng2StateDeclaration = {
  url: '/map',
  name: 'doc.action.map',
  component: DocActionMapComponent
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState,
  homeState,
  docActionContextState,
  docActionDirectivesState,
  docActionFormState,
  docActionMapState
];
