import { DemoNotificationLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './notification.router';

import { DemoNotificationListPageComponent } from './container/list.component';
import { DemoNotificationListPageRightComponent } from './container/list.right.component';
import { DemoNotificationSettingsPageComponent } from './container/settings.component';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: STATES
    }),
    DemoNotificationLayoutComponent,
    DemoNotificationListPageComponent,
    DemoNotificationListPageRightComponent,
    DemoNotificationSettingsPageComponent
  ]
})
export class DemoNotificationModule {}
