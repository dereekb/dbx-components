import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DocExamplesLayoutComponent } from './container/layout.component';
import { DocExamplesHomeComponent } from './container/home.component';
import { DocExamplesListComponent } from './container/list.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/examples',
  name: 'doc.examples',
  component: DocExamplesLayoutComponent,
  redirectTo: 'doc.examples.home'
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.examples.home',
  component: DocExamplesHomeComponent
};

export const listState: Ng2StateDeclaration = {
  url: '/list',
  name: 'doc.examples.list',
  component: DocExamplesListComponent
};

export const STATES: Ng2StateDeclaration[] = [
  //
  layoutState,
  homeState,
  listState
];
