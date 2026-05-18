import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DocTextLayoutComponent } from './container/layout.component';
import { DocTextHomeComponent } from './container/home.component';
import { DocTextPipesComponent } from './container/pipes.component';
import { DocTextTextComponent } from './container/text.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/text',
  name: 'doc.text',
  component: DocTextLayoutComponent,
  redirectTo: 'doc.text.home'
};

export const HOME_STATE: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.text.home',
  component: DocTextHomeComponent
};

export const TEXT_STATE: Ng2StateDeclaration = {
  url: '/text',
  name: 'doc.text.text',
  component: DocTextTextComponent
};

export const PIPES_STATE: Ng2StateDeclaration = {
  url: '/pipes',
  name: 'doc.text.pipes',
  component: DocTextPipesComponent
};

export const STATES: Ng2StateDeclaration[] = [
  //
  LAYOUT_STATE,
  HOME_STATE,
  TEXT_STATE,
  PIPES_STATE
];
