import { ChangeDetectionStrategy, Component, ElementRef, inject, input, viewChild } from '@angular/core';
import { AbstractPopoverRefDirective, DbxButtonComponent, DbxPopoverService } from '@dereekb/dbx-web';
import { type NgPopoverRef } from 'ng-overlay-container';
import { DbxFirebaseNotificationItemStorePopoverComponent, type DbxFirebaseNotificationItemStorePopoverParams } from './notification.item.store.popover.component';
import { DbxFirebaseNotificationItemStore } from '../store/notification.item.store';
import { loadingStateFromObs } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';

export type DbxFirebaseNotificationItemStorePopoverButtonConfig = DbxFirebaseNotificationItemStorePopoverParams;

@Component({
  selector: 'dbx-firebase-notification-item-store-popover-button',
  template: `
    <dbx-button #button (buttonClick)="showNotificationsPopover()" icon="notifications" iconOnly aria-label="Notifications"></dbx-button>
  `,
  standalone: true,
  imports: [DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseNotificationItemStorePopoverButtonComponent extends AbstractPopoverRefDirective<unknown, unknown> {
  private readonly _dbxPopoverService = inject(DbxPopoverService);
  private readonly _dbxFirebaseNotificationItemStore = inject(DbxFirebaseNotificationItemStore, { optional: true });

  readonly buttonElement = viewChild<string, Maybe<ElementRef>>('button', { read: ElementRef });
  readonly config = input<Maybe<Partial<DbxFirebaseNotificationItemStorePopoverButtonConfig>>>();

  showNotificationsPopover(): void {
    const origin = this.buttonElement()?.nativeElement;
    this.showPopover(origin);
  }

  protected override _makePopoverRef(origin?: ElementRef): NgPopoverRef<unknown, unknown> {
    const config = this.config();
    const notificationItemsLoadingState$ = config?.notificationItemsLoadingState$ ?? (this._dbxFirebaseNotificationItemStore != null ? loadingStateFromObs(this._dbxFirebaseNotificationItemStore.items$) : undefined);

    if (!origin) {
      throw new Error('Missing origin.');
    } else if (!notificationItemsLoadingState$) {
      throw new Error('Missing notificationItemsLoadingState$.');
    }

    return DbxFirebaseNotificationItemStorePopoverComponent.openPopover(this._dbxPopoverService, {
      origin,
      notificationItemsLoadingState$,
      ...config
    });
  }
}
