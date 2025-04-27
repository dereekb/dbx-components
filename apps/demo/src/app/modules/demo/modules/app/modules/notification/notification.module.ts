import { DemoNotificationLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './notification.router';
import { DemoAppSharedModule } from 'demo-components';
import { DbxFirebaseNotificationModule } from '@dereekb/dbx-firebase';
import { DemoNotificationListPageComponent } from './container/list.component';
import { DemoNotificationListPageRightComponent } from './container/list.right.component';

@NgModule({
  imports: [
    DemoAppSharedModule,
    DbxFirebaseNotificationModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [DemoNotificationLayoutComponent, DemoNotificationListPageComponent, DemoNotificationListPageRightComponent]
})
export class DemoNotificationModule {}
