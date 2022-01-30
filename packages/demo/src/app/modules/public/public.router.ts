import { Ng2StateDeclaration, UIView } from '@uirouter/angular';

export const publicState: Ng2StateDeclaration = {
  parent: 'app',
  url: '/',
  name: 'public',
  redirectTo: 'public.landing',
  component: UIView
};

export const publicLandingFutureState: Ng2StateDeclaration = {
  name: 'public.landing.**',
  url: '/landing',
  loadChildren: () => import('./modules/landing/landing.module').then(m => m.LandingModule)
};

export const publicDocFutureState: Ng2StateDeclaration = {
  name: 'public.doc.**',
  url: '/doc',
  loadChildren: () => import('./modules/doc/doc.module').then(m => m.DocModule)
};

export const STATES = [
  publicState,
  publicLandingFutureState,
  publicDocFutureState
];
