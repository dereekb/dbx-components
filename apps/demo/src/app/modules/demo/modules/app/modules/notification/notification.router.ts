import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoNotificationLayoutComponent } from './container/layout.component';
import { DemoNotificationListPageComponent } from './container/list.component';
import { DemoNotificationListPageRightComponent } from './container/list.right.component';
import { DemoNotificationSettingsPageComponent } from './container/settings.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/notification',
  name: 'demo.app.notification',
  redirectTo: 'demo.app.notification.list',
  component: DemoNotificationLayoutComponent
};

export const NOTIFICATION_LIST_STATE: Ng2StateDeclaration = {
  name: 'demo.app.notification.list',
  component: DemoNotificationListPageComponent
};

export const NOTIFICATION_LIST_RIGHT_STATE: Ng2StateDeclaration = {
  url: '/:id',
  name: 'demo.app.notification.list.notification',
  component: DemoNotificationListPageRightComponent
};

export const NOTIFICATION_SETTINGS_STATE: Ng2StateDeclaration = {
  url: '/settings',
  name: 'demo.app.notification.settings',
  component: DemoNotificationSettingsPageComponent
};

export const STATES: Ng2StateDeclaration[] = [LAYOUT_STATE, NOTIFICATION_LIST_STATE, NOTIFICATION_LIST_RIGHT_STATE, NOTIFICATION_SETTINGS_STATE];
