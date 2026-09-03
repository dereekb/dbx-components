import { type Ng2StateDeclaration } from '@uirouter/angular';
import { LandingLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  parent: 'root',
  name: 'landing',
  url: '/landing',
  component: LandingLayoutComponent
};

export const STATES: Ng2StateDeclaration[] = [layoutState];
