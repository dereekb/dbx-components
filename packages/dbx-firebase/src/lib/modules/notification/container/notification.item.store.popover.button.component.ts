import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild, inject } from '@angular/core';
import { AbstractPopoverRefDirective, DbxPopoverService } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxFirebaseNotificationItemStorePopoverComponent, DbxFirebaseNotificationItemStorePopoverParams } from './notification.item.store.popover.component';
import { DbxFirebaseNotificationItemStore } from '../store/notification.item.store';
import { loadingStateFromObs } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';

export type DbxFirebaseNotificationItemStorePopoverButtonConfig = DbxFirebaseNotificationItemStorePopoverParams;

@Component({
  selector: 'dbx-firebase-notification-item-store-popover-button',
  template: `
    <dbx-icon-button #button (buttonClick)="showNotificationsPopover()" icon="notifications"></dbx-icon-button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseNotificationItemStorePopoverButtonComponent extends AbstractPopoverRefDirective<unknown, unknown> {
  private readonly _dbxPopoverService = inject(DbxPopoverService);
  private readonly _dbxFirebaseNotificationItemStore = inject(DbxFirebaseNotificationItemStore, { optional: true });

  @ViewChild('button', { read: ElementRef, static: false })
  buttonElement!: ElementRef;

  @Input()
  config?: Maybe<Partial<DbxFirebaseNotificationItemStorePopoverButtonConfig>>;

  protected override _makePopoverRef(origin?: ElementRef): NgPopoverRef<unknown, unknown> {
    const config = this.config;

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

  showNotificationsPopover(): void {
    const origin = this.buttonElement.nativeElement;
    this.showPopover(origin);
  }
}
