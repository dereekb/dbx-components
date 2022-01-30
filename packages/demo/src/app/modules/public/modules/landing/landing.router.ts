import { Ng2StateDeclaration } from '@uirouter/angular';
import { LandingLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/',
  name: 'public.landing',
  component: LandingLayoutComponent,
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState
];
