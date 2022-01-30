import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/doc',
  name: 'public.doc',
  component: DocLayoutComponent,
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState
];
