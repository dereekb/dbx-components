import { type Ng2StateDeclaration } from '@uirouter/angular';
import { LandingLayoutComponent } from './container/layout.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  parent: 'root',
  name: 'landing',
  url: '/landing',
  component: LandingLayoutComponent
};

export const STATES: Ng2StateDeclaration[] = [LAYOUT_STATE];
