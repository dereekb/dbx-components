import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocRouterLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/router',
  name: 'doc.router',
  component: DocRouterLayoutComponent,
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState
];
