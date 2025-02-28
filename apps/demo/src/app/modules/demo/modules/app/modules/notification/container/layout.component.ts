import { Component, inject } from '@angular/core';
import { DbxFirebaseNotificationItemStore } from '@dereekb/dbx-firebase';
import { AnchorForValueFunction } from '@dereekb/dbx-web';
import { NotificationItem } from '@dereekb/firebase';
import { DemoAppRouterService } from '../../../demo.app.router.service';

@Component({
  templateUrl: './layout.component.html',
  providers: [DbxFirebaseNotificationItemStore]
})
export class DemoNotificationLayoutComponent {
  readonly demoAppRouterService = inject(DemoAppRouterService);
  readonly makeNotificationItemAnchor: AnchorForValueFunction<NotificationItem> = (doc) => this.demoAppRouterService.userNotificationListNotificationRef(doc.id);

  readonly notificationsButtonConfig = {
    makeNotificationItemAnchor: this.makeNotificationItemAnchor
  };
}
