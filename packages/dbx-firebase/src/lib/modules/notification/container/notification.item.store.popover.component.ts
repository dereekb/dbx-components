import { Component, ElementRef } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { AbstractPopoverDirective, AnchorForValueFunction, DbxPopoverKey, DbxPopoverService } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { NotificationItem } from '@dereekb/firebase';
import { Observable } from 'rxjs';
import { LoadingState } from '@dereekb/rxjs';

export interface DbxFirebaseNotificationItemStorePopoverParams {
  /**
   * Custom icon
   *
   * Defaults to "history"
   */
  readonly icon?: string;
  /**
   * Custom header text
   *
   * Defaults to "History"
   */
  readonly header?: string;
  /**
   * Custom empty text when no items exist.
   */
  readonly emptyText?: string;
  /**
   * Origin to add the popover to.
   */
  readonly origin: ElementRef;
  /**
   * Items loading state.
   */
  readonly notificationItemsLoadingState$: Observable<LoadingState<NotificationItem[]>>;
  /**
   * Anchor
   */
  readonly makeNotificationItemAnchor?: Maybe<AnchorForValueFunction<NotificationItem>>;
}

export const DEFAULT_DBX_FIREBASE_NOTIFICATION_ITEM_STORE_POPOVER_KEY = 'notification-item-store-notifications';

@Component({
  templateUrl: './notification.item.store.popover.component.html'
})
export class DbxFirebaseNotificationItemStorePopoverComponent extends AbstractPopoverDirective<unknown, DbxFirebaseNotificationItemStorePopoverParams> {
  static openPopover(popupService: DbxPopoverService, { origin, header, icon, emptyText, makeNotificationItemAnchor, notificationItemsLoadingState$ }: DbxFirebaseNotificationItemStorePopoverParams, popoverKey?: DbxPopoverKey): NgPopoverRef {
    return popupService.open({
      key: popoverKey ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_ITEM_STORE_POPOVER_KEY,
      origin,
      componentClass: DbxFirebaseNotificationItemStorePopoverComponent,
      data: {
        header,
        icon,
        emptyText,
        notificationItemsLoadingState$,
        makeNotificationItemAnchor
      }
    });
  }

  get params(): DbxFirebaseNotificationItemStorePopoverParams {
    return this.popover.data as DbxFirebaseNotificationItemStorePopoverParams;
  }

  get icon() {
    return this.params.icon ?? 'notifications';
  }

  get header() {
    return this.params.header ?? 'Notifications';
  }

  get emptyText() {
    return this.params.header ?? 'There are no notifications.';
  }

  get notificationItemsLoadingState$() {
    return this.params.notificationItemsLoadingState$;
  }

  get makeNotificationItemAnchor() {
    return this.params.makeNotificationItemAnchor;
  }
}
