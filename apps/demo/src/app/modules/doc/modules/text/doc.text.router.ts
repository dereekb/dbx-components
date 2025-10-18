import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DocTextLayoutComponent } from './container/layout.component';
import { DocTextHomeComponent } from './container/home.component';
import { DocTextPipesComponent } from './container/pipes.component';
import { DocTextTextComponent } from './container/text.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/text',
  name: 'doc.text',
  component: DocTextLayoutComponent,
  redirectTo: 'doc.text.home'
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.text.home',
  component: DocTextHomeComponent
};

export const textState: Ng2StateDeclaration = {
  url: '/text',
  name: 'doc.text.text',
  component: DocTextTextComponent
};

export const pipesState: Ng2StateDeclaration = {
  url: '/pipes',
  name: 'doc.text.pipes',
  component: DocTextPipesComponent
};

export const STATES: Ng2StateDeclaration[] = [
  //
  layoutState,
  homeState,
  textState,
  pipesState
];
