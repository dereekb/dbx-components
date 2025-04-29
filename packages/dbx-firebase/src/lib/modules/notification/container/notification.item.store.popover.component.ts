import { ChangeDetectionStrategy, Component, ElementRef } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { AbstractPopoverDirective, AnchorForValueFunction, DbxListEmptyContentComponent, DbxListItemAnchorModifierDirective, DbxListModifierModule, DbxPopoverInteractionModule, DbxPopoverKey, DbxPopoverService } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { NotificationItem } from '@dereekb/firebase';
import { Observable } from 'rxjs';
import { LoadingState } from '@dereekb/rxjs';
import { DbxFirebaseNotificationItemListComponent } from '../component';

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
  templateUrl: './notification.item.store.popover.component.html',
  imports: [DbxPopoverInteractionModule, DbxListModifierModule, DbxFirebaseNotificationItemListComponent, DbxListEmptyContentComponent, DbxListItemAnchorModifierDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
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

  readonly params = this.popover.data as DbxFirebaseNotificationItemStorePopoverParams;
  readonly icon = this.params.icon ?? 'notifications';
  readonly header = this.params.header ?? 'Notifications';
  readonly emptyText = this.params.header ?? 'There are no notifications.';
  readonly makeNotificationItemAnchor = this.params.makeNotificationItemAnchor;
  readonly notificationItemsLoadingState$ = this.params.notificationItemsLoadingState$;
}
