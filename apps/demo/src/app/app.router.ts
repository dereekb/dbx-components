import { type Ng2StateDeclaration } from '@uirouter/angular';
import { AppLayoutComponent as RootAppLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  name: 'root',
  redirectTo: 'landing',
  component: RootAppLayoutComponent
};

export const publicLandingFutureState: Ng2StateDeclaration = {
  parent: 'root',
  name: 'landing.**',
  url: '/landing',
  loadChildren: () => import('./modules/landing/landing.module').then((m) => m.LandingModule)
};

export const publicDocFutureState: Ng2StateDeclaration = {
  parent: 'root',
  name: 'doc.**',
  url: '/doc',
  loadChildren: () => import('./modules/doc/doc.module').then((m) => m.DocModule)
};

export const publicDemoFutureState: Ng2StateDeclaration = {
  parent: 'root',
  name: 'demo.**',
  url: '/demo',
  loadChildren: () => import('./modules/demo/demo.module').then((m) => m.DemoModule)
};

export const STATES = [layoutState, publicLandingFutureState, publicDocFutureState, publicDemoFutureState];
