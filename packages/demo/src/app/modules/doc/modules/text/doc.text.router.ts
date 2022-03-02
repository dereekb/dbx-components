import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocTextLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/text',
  name: 'doc.text',
  component: DocTextLayoutComponent,
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState
];
