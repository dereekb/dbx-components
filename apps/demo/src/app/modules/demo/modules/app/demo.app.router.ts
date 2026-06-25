import { DemoAppSettingsComponent } from './container/settings.component';
import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoAppHistoryComponent } from './container/history.component';
import { DemoAppHomeComponent } from './container/home.component';
import { DemoAppLayoutComponent } from './container/layout.component';
import { DEMO_APP_STATE_DATA } from './demo.app.router.auth';

export const DEMO_APP_STATE: Ng2StateDeclaration = {
  url: '/app?imp',
  name: 'demo.app',
  redirectTo: 'demo.app.home',
  component: DemoAppLayoutComponent,
  // `imp` is the impersonation query param (?imp=<uid>); dynamic so toggling it re-keys without reloading
  // the state tree. Children of demo.app inherit it. Read by dbxAuthImpersonationQuerySync in the layout.
  params: {
    imp: { dynamic: true, value: null }
  },
  data: DEMO_APP_STATE_DATA
};

export const HOME_STATE: Ng2StateDeclaration = {
  url: '/home',
  name: 'demo.app.home',
  component: DemoAppHomeComponent
};

export const HISTORY_STATE: Ng2StateDeclaration = {
  url: '/history',
  name: 'demo.app.history',
  component: DemoAppHistoryComponent
};

export const SETTINGS_STATE: Ng2StateDeclaration = {
  url: '/settings',
  name: 'demo.app.settings',
  component: DemoAppSettingsComponent
};

export const NOTIFICATION_STATE: Ng2StateDeclaration = {
  url: '/notification',
  name: 'demo.app.notification.**',
  loadChildren: () => import('./modules/notification/notification.module').then((m) => m.DemoNotificationModule)
};

export const DEMO_GUESTBOOK_FUTURE_STATE: Ng2StateDeclaration = {
  name: 'demo.app.guestbook.**',
  url: '/guestbook',
  loadChildren: () => import('./modules/guestbook/guestbook.module').then((m) => m.DemoGuestbookModule)
};

export const DEMO_PROFILE_FUTURE_STATE: Ng2StateDeclaration = {
  name: 'demo.app.profile.**',
  url: '/profile',
  loadChildren: () => import('./modules/profile/profile.module').then((m) => m.DemoProfileModule)
};

export const DEMO_OIDC_FUTURE_STATE: Ng2StateDeclaration = {
  name: 'demo.app.oidc.**',
  url: '/oidc',
  loadChildren: () => import('./modules/oidc/oidc.module').then((m) => m.DemoAppOidcModule)
};

export const DEMO_APP_STATES: Ng2StateDeclaration[] = [
  //
  DEMO_APP_STATE,
  HOME_STATE,
  HISTORY_STATE,
  SETTINGS_STATE,
  NOTIFICATION_STATE,
  DEMO_GUESTBOOK_FUTURE_STATE,
  DEMO_PROFILE_FUTURE_STATE,
  DEMO_OIDC_FUTURE_STATE
];
