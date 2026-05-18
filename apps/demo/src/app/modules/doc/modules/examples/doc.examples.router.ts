import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DocExamplesLayoutComponent } from './container/layout.component';
import { DocExamplesHomeComponent } from './container/home.component';
import { DocExamplesListComponent } from './container/list.component';
import { DocExamplesCardComponent } from './container/card.component';
import { DocExamplesActionComponent } from './container/action.component';
import { DocExamplesLayoutExamplesComponent } from './container/layout-examples.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/examples',
  name: 'doc.examples',
  component: DocExamplesLayoutComponent,
  redirectTo: 'doc.examples.home'
};

export const HOME_STATE: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.examples.home',
  component: DocExamplesHomeComponent
};

export const LIST_STATE: Ng2StateDeclaration = {
  url: '/list',
  name: 'doc.examples.list',
  component: DocExamplesListComponent
};

export const CARD_STATE: Ng2StateDeclaration = {
  url: '/card',
  name: 'doc.examples.card',
  component: DocExamplesCardComponent
};

export const ACTION_STATE: Ng2StateDeclaration = {
  url: '/action',
  name: 'doc.examples.action',
  component: DocExamplesActionComponent
};

export const LAYOUT_EXAMPLES_STATE: Ng2StateDeclaration = {
  url: '/layout',
  name: 'doc.examples.layout',
  component: DocExamplesLayoutExamplesComponent
};

export const STATES: Ng2StateDeclaration[] = [
  //
  LAYOUT_STATE,
  HOME_STATE,
  LIST_STATE,
  CARD_STATE,
  ACTION_STATE,
  LAYOUT_EXAMPLES_STATE
];
