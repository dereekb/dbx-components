import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DemoNotificationLayoutComponent } from './container/layout.component';
import { DemoNotificationListPageComponent } from './container/list.component';
import { DemoNotificationListPageRightComponent } from './container/list.right.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/notification',
  name: 'demo.app.notification',
  redirectTo: 'demo.app.notification.list',
  component: DemoNotificationLayoutComponent
};

export const notificationListState: Ng2StateDeclaration = {
  name: 'demo.app.notification.list',
  component: DemoNotificationListPageComponent
};

export const notificationListRightState: Ng2StateDeclaration = {
  url: '/:id',
  name: 'demo.app.notification.list.notification',
  component: DemoNotificationListPageRightComponent
};

export const STATES: Ng2StateDeclaration[] = [layoutState, notificationListState, notificationListRightState];
