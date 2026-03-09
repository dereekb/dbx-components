import { Directive } from '@angular/core';
import { AbstractDbxWidgetComponent } from '@dereekb/dbx-web';
import { type NotificationItem, type NotificationItemMetadata } from '@dereekb/firebase';

@Directive()
export abstract class AbstractDbxFirebaseNotificationItemWidgetComponent<D extends NotificationItemMetadata = {}> extends AbstractDbxWidgetComponent<NotificationItem<D>> {
  get notificationItem(): NotificationItem<D> {
    return this.data;
  }
}
