import { type Ng2StateDeclaration } from '@uirouter/angular';
import { AppLayoutComponent as RootAppLayoutComponent } from './container/layout.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  name: 'root',
  redirectTo: 'landing',
  component: RootAppLayoutComponent
};

export const PUBLIC_LANDING_FUTURE_STATE: Ng2StateDeclaration = {
  parent: 'root',
  name: 'landing.**',
  url: '/landing',
  loadChildren: () => import('./modules/landing/landing.module').then((m) => m.LandingModule)
};

export const PUBLIC_DOC_FUTURE_STATE: Ng2StateDeclaration = {
  parent: 'root',
  name: 'doc.**',
  url: '/doc',
  loadChildren: () => import('./modules/doc/doc.module').then((m) => m.DocModule)
};

export const PUBLIC_DEMO_FUTURE_STATE: Ng2StateDeclaration = {
  parent: 'root',
  name: 'demo.**',
  url: '/demo',
  loadChildren: () => import('./modules/demo/demo.module').then((m) => m.DemoModule)
};

export const STATES = [LAYOUT_STATE, PUBLIC_LANDING_FUTURE_STATE, PUBLIC_DOC_FUTURE_STATE, PUBLIC_DEMO_FUTURE_STATE];
