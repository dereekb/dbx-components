import { Component, inject, type Injector } from '@angular/core';
import { type MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { DbxRouteModelIdFromAuthUserIdDirective } from '@dereekb/dbx-core';
import { AbstractDialogDirective, DbxDialogModule, DbxLinkComponent } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_MODE, type DbxFirebaseNotificationBoxSettingsMode, DbxFirebaseNotificationUserSettingsConfig } from '../service/notification.settings';
import { NotificationUserDocumentStore } from '../store/notificationuser.document.store';
import { DbxFirebaseNotificationUserDocumentStoreDirective } from '../store/notificationuser.document.store.directive';
import { DbxFirebaseNotificationBoxContextToggleComponent } from './notification.box.context.toggle.component';
import { DbxFirebaseNotificationUserSettingsComponent, type DbxFirebaseNotificationUserSettingsComponentConfig } from './notification.user.settings.component';

/**
 * Default header of a {@link DbxFirebaseNotificationUserSettingsDialogComponent}.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_USER_SETTINGS_DIALOG_HEADER = 'Notification Settings';

/**
 * Configuration for opening a {@link DbxFirebaseNotificationUserSettingsDialogComponent}.
 */
export interface DbxFirebaseNotificationUserSettingsDialogConfig {
  /**
   * Dialog header. Defaults to {@link DEFAULT_DBX_FIREBASE_NOTIFICATION_USER_SETTINGS_DIALOG_HEADER}.
   */
  readonly header?: Maybe<string>;
  /**
   * Config for the settings, such as the `groups` or `templateTypes` to show. Saving only changes the settings that are shown.
   *
   * Its `settingsAnchor` overrides the app's, for the link to all of the notification settings. With a `notificationBox`, the dialog edits the
   * user's settings for that box.
   */
  readonly config?: Maybe<DbxFirebaseNotificationUserSettingsComponentConfig>;
  /**
   * Whether to wrap the settings in a `dbx-firebase-notification-box-context-toggle` when the config has a `notificationBox`, so the user can
   * switch between the box's settings and their global settings. False by default.
   *
   * Only applies in `perBox` mode (see {@link DbxFirebaseNotificationBoxSettingsMode}). In the default `global` mode, the settings shown for a
   * box already are the global settings, so there is nothing to switch to.
   */
  readonly showNotificationBoxToggle?: Maybe<boolean>;
  /**
   * The injector to open the dialog with.
   *
   * A dialog renders outside the opening component's view, so it does not inherit that component's injector by default. When
   * this injector provides a NotificationUserDocumentStore, such as from an ancestor `dbxFirebaseNotificationUserDocument`,
   * that NotificationUser is edited. Otherwise the signed-in user's NotificationUser is.
   */
  readonly injector?: Maybe<Injector>;
}

/**
 * Dialog wrapper around {@link DbxFirebaseNotificationUserSettingsComponent}, configured the same way.
 *
 * Use it to show a few notification settings where they are relevant, such as only the `groups` for the current page. Links to
 * the page with all of the settings when a `settingsAnchor` is configured, such as through the `userSettings` of
 * `provideDbxFirebaseNotifications()`. Opened by {@link DbxFirebaseNotificationUserSettingsDialogButtonComponent}.
 *
 * When the config has a `notificationBox`, the dialog shows the settings for that box (see {@link DbxFirebaseNotificationUserSettingsComponent}).
 * In `perBox` mode, `showNotificationBoxToggle` wraps them in a {@link DbxFirebaseNotificationBoxContextToggleComponent}.
 */
@Component({
  template: `
    <dbx-dialog-content class="dbx-dialog-content-with-header">
      <h3 class="dbx-dialog-content-header">{{ header }}</h3>
      <dbx-dialog-content-close (close)="close()"></dbx-dialog-content-close>
      @if (showNotificationBoxToggle) {
        <dbx-firebase-notification-box-context-toggle [notificationBox]="config?.notificationBox">
          @if (hasNotificationUserDocumentStore) {
            <dbx-firebase-notification-user-settings [config]="config"></dbx-firebase-notification-user-settings>
          } @else {
            <div dbxFirebaseNotificationUserDocument dbxRouteModelIdFromAuthUserId>
              <dbx-firebase-notification-user-settings [config]="config"></dbx-firebase-notification-user-settings>
            </div>
          }
        </dbx-firebase-notification-box-context-toggle>
      } @else if (hasNotificationUserDocumentStore) {
        <dbx-firebase-notification-user-settings [config]="config"></dbx-firebase-notification-user-settings>
      } @else {
        <div dbxFirebaseNotificationUserDocument dbxRouteModelIdFromAuthUserId>
          <dbx-firebase-notification-user-settings [config]="config"></dbx-firebase-notification-user-settings>
        </div>
      }
      @if (settingsAnchor) {
        <div class="dbx-pt3 dbx-small">
          <dbx-link [anchor]="settingsAnchor">See all notification settings</dbx-link>
        </div>
      }
    </dbx-dialog-content>
  `,
  imports: [DbxDialogModule, DbxLinkComponent, DbxRouteModelIdFromAuthUserIdDirective, DbxFirebaseNotificationUserDocumentStoreDirective, DbxFirebaseNotificationUserSettingsComponent, DbxFirebaseNotificationBoxContextToggleComponent]
})
export class DbxFirebaseNotificationUserSettingsDialogComponent extends AbstractDialogDirective<unknown, Maybe<DbxFirebaseNotificationUserSettingsDialogConfig>> {
  private readonly _appConfig = inject(DbxFirebaseNotificationUserSettingsConfig, { optional: true });

  readonly hasNotificationUserDocumentStore = inject(NotificationUserDocumentStore, { optional: true }) != null;
  readonly header = this.data?.header ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_USER_SETTINGS_DIALOG_HEADER;
  readonly config = this.data?.config;
  readonly notificationBoxSettingsMode = this.config?.notificationBoxSettingsMode ?? this._appConfig?.notificationBoxSettingsMode ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_MODE;
  readonly showNotificationBoxToggle = this.config?.notificationBox != null && this.notificationBoxSettingsMode === 'perBox' && this.data?.showNotificationBoxToggle === true;

  /**
   * Anchor to all of the notification settings. The dialog closes once it navigates.
   */
  readonly settingsAnchor = this.config?.settingsAnchor ?? this._appConfig?.settingsAnchor;

  /**
   * Opens the notification settings in a dialog.
   *
   * @param matDialog - The dialog service.
   * @param config - The header, settings config and injector.
   * @returns The dialog reference.
   */
  static openDialog(matDialog: MatDialog, config?: Maybe<DbxFirebaseNotificationUserSettingsDialogConfig>): MatDialogRef<DbxFirebaseNotificationUserSettingsDialogComponent> {
    return matDialog.open(DbxFirebaseNotificationUserSettingsDialogComponent, {
      // a long list of settings can exceed the viewport, so cap the dialog and let its surface scroll
      maxHeight: 'calc(var(--vh100) * 0.9)',
      injector: config?.injector ?? undefined,
      data: config
    });
  }
}
