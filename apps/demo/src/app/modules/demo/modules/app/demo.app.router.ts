import { Ng2StateDeclaration } from '@uirouter/angular';
import { DemoAppHomeComponent } from './container/home.component';
import { DemoAppLayoutComponent } from './container/layout.component';

export const demoAppState: Ng2StateDeclaration = {
  url: '/app',
  name: 'demo.app',
  redirectTo: 'demo.app.home',
  component: DemoAppLayoutComponent
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'demo.app.home',
  component: DemoAppHomeComponent,
};

export const demoGuestbookFutureState: Ng2StateDeclaration = {
  name: 'demo.app.guestbook.**',
  url: '/guestbook',
  loadChildren: () => import('./modules/guestbook/guestbook.module').then(m => m.DemoGuestbookModule)
};

export const demoProfileFutureState: Ng2StateDeclaration = {
  name: 'demo.app.profile.**',
  url: '/profile',
  loadChildren: () => import('./modules/profile/profile.module').then(m => m.DemoProfileModule)
};

export const DEMO_APP_STATES: Ng2StateDeclaration[] = [
  demoAppState,
  homeState,
  demoGuestbookFutureState,
  demoProfileFutureState
];
