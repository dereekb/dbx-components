import { DemoAppSettingsComponent } from './container/settings.component';
import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoAppHistoryComponent } from './container/history.component';
import { DemoAppHomeComponent } from './container/home.component';
import { DemoAppLayoutComponent } from './container/layout.component';
import { demoAppStateData } from './demo.app.router.auth';

export const demoAppState: Ng2StateDeclaration = {
  url: '/app',
  name: 'demo.app',
  redirectTo: 'demo.app.home',
  component: DemoAppLayoutComponent,
  data: demoAppStateData
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'demo.app.home',
  component: DemoAppHomeComponent
};

export const historyState: Ng2StateDeclaration = {
  url: '/history',
  name: 'demo.app.history',
  component: DemoAppHistoryComponent
};

export const settingsState: Ng2StateDeclaration = {
  url: '/settings',
  name: 'demo.app.settings',
  component: DemoAppSettingsComponent
};

export const notificationState: Ng2StateDeclaration = {
  url: '/notification',
  name: 'demo.app.notification.**',
  loadChildren: () => import('./modules/notification/notification.module').then((m) => m.DemoNotificationModule)
};

export const demoGuestbookFutureState: Ng2StateDeclaration = {
  name: 'demo.app.guestbook.**',
  url: '/guestbook',
  loadChildren: () => import('./modules/guestbook/guestbook.module').then((m) => m.DemoGuestbookModule)
};

export const demoProfileFutureState: Ng2StateDeclaration = {
  name: 'demo.app.profile.**',
  url: '/profile',
  loadChildren: () => import('./modules/profile/profile.module').then((m) => m.DemoProfileModule)
};

export const DEMO_APP_STATES: Ng2StateDeclaration[] = [
  //
  demoAppState,
  homeState,
  historyState,
  settingsState,
  notificationState,
  demoGuestbookFutureState,
  demoProfileFutureState
];
