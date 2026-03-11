import { Directive } from '@angular/core';
import { AbstractDbxWidgetComponent } from '@dereekb/dbx-web';
import { type NotificationItem, type NotificationItemMetadata } from '@dereekb/firebase';

/**
 * Abstract base directive for notification item widget display components.
 *
 * Provides typed access to the {@link NotificationItem} data for custom rendering.
 */
@Directive()
export abstract class AbstractDbxFirebaseNotificationItemWidgetComponent<D extends NotificationItemMetadata = {}> extends AbstractDbxWidgetComponent<NotificationItem<D>> {
  get notificationItem(): NotificationItem<D> {
    return this.data;
  }
}
