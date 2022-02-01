import { Ng2StateDeclaration } from '@uirouter/angular';
import { DemoLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  parent: 'app',
  url: '/demo',
  name: 'demo',
  component: DemoLayoutComponent,
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState
];
