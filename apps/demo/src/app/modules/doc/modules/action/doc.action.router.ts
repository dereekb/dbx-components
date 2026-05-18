import { DocActionInteractionComponent } from './container/interaction.component';
import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DocActionContextComponent } from './container/context.component';
import { DocActionDirectivesComponent } from './container/directives.component';
import { DocActionFormComponent } from './container/form.component';
import { DocActionHomeComponent } from './container/home.component';
import { DocActionLayoutComponent } from './container/layout.component';
import { DocActionMapComponent } from './container/map.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/action',
  name: 'doc.action',
  component: DocActionLayoutComponent,
  redirectTo: 'doc.action.home'
};

export const HOME_STATE: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.action.home',
  component: DocActionHomeComponent
};

export const DOC_ACTION_CONTEXT_STATE: Ng2StateDeclaration = {
  url: '/context',
  name: 'doc.action.context',
  component: DocActionContextComponent
};

export const DOC_ACTION_DIRECTIVES_STATE: Ng2StateDeclaration = {
  url: '/directives',
  name: 'doc.action.directives',
  component: DocActionDirectivesComponent
};

export const DOC_ACTION_INTERACTION_STATE: Ng2StateDeclaration = {
  url: '/interaction',
  name: 'doc.action.interaction',
  component: DocActionInteractionComponent
};

export const DOC_ACTION_FORM_STATE: Ng2StateDeclaration = {
  url: '/form',
  name: 'doc.action.form',
  component: DocActionFormComponent
};

export const DOC_ACTION_MAP_STATE: Ng2StateDeclaration = {
  url: '/map',
  name: 'doc.action.map',
  component: DocActionMapComponent
};

export const STATES: Ng2StateDeclaration[] = [LAYOUT_STATE, HOME_STATE, DOC_ACTION_CONTEXT_STATE, DOC_ACTION_DIRECTIVES_STATE, DOC_ACTION_INTERACTION_STATE, DOC_ACTION_FORM_STATE, DOC_ACTION_MAP_STATE];
