import { Ng2StateDeclaration } from '@uirouter/angular';
import { AppLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  name: 'app',
  redirectTo: 'landing',
  component: AppLayoutComponent,
};

export const publicLandingFutureState: Ng2StateDeclaration = {
  parent: 'app',
  name: 'landing.**',
  url: '/landing',
  loadChildren: () => import('./modules/landing/landing.module').then(m => m.LandingModule)
};

export const publicDocFutureState: Ng2StateDeclaration = {
  parent: 'app',
  name: 'doc.**',
  url: '/doc',
  loadChildren: () => import('./modules/doc/doc.module').then(m => m.DocModule)
};

export const STATES = [
  layoutState,
  publicLandingFutureState,
  publicDocFutureState
];
