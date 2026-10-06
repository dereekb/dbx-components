import { Component, computed, inject, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { DbxActionButtonDirective, DbxActionDirective, DbxActionEnforceModifiedDirective, DbxActionHandlerDirective, DbxActionValueDirective, DbxActionValueStreamDirective } from '@dereekb/dbx-core';
import { DbxActionSnackbarErrorDirective, DbxActionTransitionSafetyDirective, DbxButtonComponent, DbxButtonSpacerDirective, DbxContentPitDirective, DbxListTitleGroupDirective, DbxLoadingComponent } from '@dereekb/dbx-web';
import { type UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams } from '@dereekb/firebase';
import { type IsModifiedFunction, type WorkUsingContext } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { of } from 'rxjs';
import { DbxFirebaseNotificationSettingsListDelegate, dbxFirebaseNotificationSettingsListGroupDelegate } from '../component/notification.settings.list';
import { DbxFirebaseNotificationSettingsListComponent } from '../component/notification.settings.list.component';
import { DbxFirebaseNotificationSettingsListGroupHeaderComponent } from '../component/notification.settings.list.group.component';
import { DEFAULT_DBX_FIREBASE_NOTIFICATION_TEXT_MESSAGE_DISCLOSURE } from '../service/notification.settings';
import { DbxFirebaseNotificationUserSettingsStore, type DbxFirebaseNotificationUserSettingsStoreConfig } from '../store/notificationuser.settings.store';
import { DbxFirebaseNotificationHealthCheckDialogButtonComponent } from './healthcheck.dialog.button.component';
import { DbxFirebaseNotificationUserSettingsDeliveryComponent } from './notification.user.settings.delivery.component';

/**
 * Config for {@link DbxFirebaseNotificationUserSettingsComponent}. Merged over the app's `DbxFirebaseNotificationUserSettingsConfig`.
 */
export interface DbxFirebaseNotificationUserSettingsComponentConfig extends DbxFirebaseNotificationUserSettingsStoreConfig {
  /**
   * Whether to show the account-wide delivery settings: the delivery method switches and the text message phone number. True by default.
   */
  readonly showDeliveryMethodSettings?: Maybe<boolean>;
  /**
   * Whether to offer to set up notifications when the NotificationUser does not exist yet. True by default.
   */
  readonly allowCreate?: Maybe<boolean>;
  /**
   * Whether to show a button that opens the delivery health check. False by default.
   */
  readonly showDeliveryCheckButton?: Maybe<boolean>;
}

/**
 * Notification settings for the NotificationUser of the ancestor `NotificationUserDocumentStore`, such as the one provided by
 * `dbxFirebaseNotificationUserDocument`.
 *
 * Shows a grouped list with a default/on/off button per notification type and delivery method, and the account-wide delivery
 * settings. Changes are pending until Save, which sends them in one update. Offers to set up notifications when the
 * NotificationUser does not exist yet.
 *
 * @example
 * ```html
 * <div dbxFirebaseNotificationUserDocument dbxRouteModelIdFromAuthUserId>
 *   <dbx-firebase-notification-user-settings></dbx-firebase-notification-user-settings>
 * </div>
 * ```
 */
@Component({
  selector: 'dbx-firebase-notification-user-settings',
  template: `
    @switch (store.pageStateSignal()) {
      @case ('loading') {
        <dbx-loading [loading]="true" [linear]="true"></dbx-loading>
      }
      @case ('missing') {
        <dbx-content-pit>
          <p class="dbx-hint">Notifications have not been set up for this account yet.</p>
          @if (allowCreateSignal()) {
            <div dbxAction dbxActionValue dbxActionSnackbarError [dbxActionHandler]="handleCreateNotificationUser">
              <dbx-button dbxActionButton [raised]="true" color="primary" icon="notifications" text="Set Up Notifications"></dbx-button>
            </div>
          }
        </dbx-content-pit>
      }
      @case ('ready') {
        @if (showDeliveryMethodSettingsSignal()) {
          <dbx-firebase-notification-user-settings-delivery></dbx-firebase-notification-user-settings-delivery>
        }
        <dbx-firebase-notification-settings-list [state]="store.listStateSignal()" [dbxListTitleGroup]="groupDelegate"></dbx-firebase-notification-settings-list>
        <p class="dbx-hint dbx-small">Click a setting to switch it between Default, On and Off. Colored icons are your own choices; grey icons follow the default for that notification.</p>
        <div class="dbx-flex-bar" dbxAction [dbxActionValueStream]="updateParams$" [dbxActionValueStreamIsModifiedValue]="isUpdateParamsModified" dbxActionEnforceModified dbxActionTransitionSafety="dialog" dbxActionSnackbarError [dbxActionHandler]="handleSave">
          @if (showDeliveryCheckButtonSignal()) {
            <dbx-firebase-notification-healthcheck-dialog-button></dbx-firebase-notification-healthcheck-dialog-button>
          }
          <span class="dbx-spacer"></span>
          <dbx-button text="Discard" [disabled]="!store.isModifiedSignal() || store.savingSignal()" (buttonClick)="store.reset()"></dbx-button>
          <dbx-button-spacer></dbx-button-spacer>
          <dbx-button dbxActionButton [raised]="true" color="primary" text="Save"></dbx-button>
        </div>
        @if (store.enablesTextSignal()) {
          <p class="dbx-hint dbx-small">Saving turns on text messages. {{ textMessageDisclosureSignal() }}</p>
        }
      }
    }
  `,
  host: {
    class: 'd-block dbx-firebase-notification-user-settings'
  },
  imports: [
    DbxActionDirective,
    DbxActionValueDirective,
    DbxActionValueStreamDirective,
    DbxActionEnforceModifiedDirective,
    DbxActionHandlerDirective,
    DbxActionButtonDirective,
    DbxActionSnackbarErrorDirective,
    DbxActionTransitionSafetyDirective,
    DbxButtonComponent,
    DbxButtonSpacerDirective,
    DbxContentPitDirective,
    DbxListTitleGroupDirective,
    DbxLoadingComponent,
    DbxFirebaseNotificationSettingsListComponent,
    DbxFirebaseNotificationUserSettingsDeliveryComponent,
    DbxFirebaseNotificationHealthCheckDialogButtonComponent
  ],
  providers: [DbxFirebaseNotificationUserSettingsStore, { provide: DbxFirebaseNotificationSettingsListDelegate, useExisting: DbxFirebaseNotificationUserSettingsStore }]
})
export class DbxFirebaseNotificationUserSettingsComponent {
  readonly store = inject(DbxFirebaseNotificationUserSettingsStore);

  readonly config = input<Maybe<DbxFirebaseNotificationUserSettingsComponentConfig>>();

  readonly groupDelegate = dbxFirebaseNotificationSettingsListGroupDelegate(DbxFirebaseNotificationSettingsListGroupHeaderComponent);

  readonly showDeliveryMethodSettingsSignal = computed(() => this.config()?.showDeliveryMethodSettings !== false);
  readonly allowCreateSignal = computed(() => this.config()?.allowCreate !== false);
  readonly showDeliveryCheckButtonSignal = computed(() => this.config()?.showDeliveryCheckButton === true);
  readonly textMessageDisclosureSignal = computed(() => this.store.configSignal().textMessageDisclosure ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_TEXT_MESSAGE_DISCLOSURE);

  readonly updateParams$ = toObservable(this.store.updateParamsSignal);
  readonly isUpdateParamsModified: IsModifiedFunction<Maybe<UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams>> = (params) => of(params != null);

  readonly handleSave: WorkUsingContext<Maybe<UpdateNotificationUserDefaultNotificationBoxRecipientConfigParams>> = (params, context) => {
    context.startWorkingWithLoadingStateObservable(this.store.save(params));
  };

  readonly handleCreateNotificationUser: WorkUsingContext = (_, context) => {
    context.startWorkingWithLoadingStateObservable(this.store.createNotificationUser());
  };

  constructor() {
    this.store.setConfig(this.config);
  }
}
