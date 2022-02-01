import { Ng2StateDeclaration } from '@uirouter/angular';
import { AppLayoutComponent } from './container/layout.component';

export const layoutState: Ng2StateDeclaration = {
  name: 'app',
  url: '/',
  redirectTo: 'public',
  component: AppLayoutComponent,
};

export const publicFutureState: Ng2StateDeclaration = {
  parent: 'app',
  name: 'public.**',
  loadChildren: () => import('./modules/public/public.module').then(m => m.PublicModule)
};

export const STATES = [
  layoutState,
  publicFutureState
];
