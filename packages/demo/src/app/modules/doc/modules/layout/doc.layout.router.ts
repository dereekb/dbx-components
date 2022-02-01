import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocLayoutLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/layout',
  name: 'doc.layout',
  component: DocLayoutLayoutComponent,
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState
];
