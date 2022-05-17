import { Ng2StateDeclaration } from '@uirouter/angular';
import { RootAppLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  name: 'root',
  redirectTo: 'landing',
  component: RootAppLayoutComponent,
};

export const publicLandingFutureState: Ng2StateDeclaration = {
  parent: 'root',
  name: 'landing.**',
  url: '/landing',
  loadChildren: () => import('./modules/landing/landing.module').then(m => m.LandingModule)
};

export const publicAppFutureState: Ng2StateDeclaration = {
  parent: 'root',
  name: 'app.**',
  url: '/app',
  loadChildren: () => import('./modules/app/app.module').then(m => m.AppModule)
};

export const STATES = [
  layoutState,
  publicLandingFutureState,
  publicAppFutureState
];
