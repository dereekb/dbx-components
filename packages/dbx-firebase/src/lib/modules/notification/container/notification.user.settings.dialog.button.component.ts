import { Component, computed, inject, Injector, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DbxButtonComponent } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { type DbxFirebaseNotificationUserSettingsComponentConfig } from './notification.user.settings.component';
import { DbxFirebaseNotificationUserSettingsDialogComponent } from './notification.user.settings.dialog.component';

/**
 * Default text of a {@link DbxFirebaseNotificationUserSettingsDialogButtonComponent}.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_USER_SETTINGS_DIALOG_BUTTON_TEXT = 'Notification Settings';

/**
 * Default icon of a {@link DbxFirebaseNotificationUserSettingsDialogButtonComponent}.
 */
export const DEFAULT_DBX_FIREBASE_NOTIFICATION_USER_SETTINGS_DIALOG_BUTTON_ICON = 'notifications';

/**
 * Button that opens the notification settings in a {@link DbxFirebaseNotificationUserSettingsDialogComponent}.
 *
 * Takes the same `config` as `dbx-firebase-notification-user-settings`, so it can show only the settings that belong where it is
 * placed. Edits the NotificationUser of an ancestor `dbxFirebaseNotificationUserDocument` when there is one, and otherwise the
 * signed-in user's.
 *
 * @example
 * ```html
 * <dbx-firebase-notification-user-settings-dialog-button header="Guestbook Notifications" [config]="{ groups: ['guestbook'] }"></dbx-firebase-notification-user-settings-dialog-button>
 * ```
 */
@Component({
  selector: 'dbx-firebase-notification-user-settings-dialog-button',
  template: `
    <dbx-button [stroked]="true" [text]="textSignal()" [icon]="iconSignal()" (buttonClick)="openNotificationSettingsDialog()"></dbx-button>
  `,
  host: {
    class: 'dbx-firebase-notification-user-settings-dialog-button'
  },
  imports: [DbxButtonComponent]
})
export class DbxFirebaseNotificationUserSettingsDialogButtonComponent {
  private readonly _matDialog = inject(MatDialog);
  private readonly _injector = inject(Injector);

  /**
   * Config for the settings, such as the `groups` or `templateTypes` to show.
   */
  readonly config = input<Maybe<DbxFirebaseNotificationUserSettingsComponentConfig>>();

  /**
   * Dialog header. Defaults to the button text.
   */
  readonly header = input<Maybe<string>>();
  readonly text = input<Maybe<string>>();
  readonly icon = input<Maybe<string>>();

  readonly textSignal = computed(() => this.text() ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_USER_SETTINGS_DIALOG_BUTTON_TEXT);
  readonly iconSignal = computed(() => this.icon() ?? DEFAULT_DBX_FIREBASE_NOTIFICATION_USER_SETTINGS_DIALOG_BUTTON_ICON);

  openNotificationSettingsDialog(): void {
    // the dialog renders outside this component's view, so its injector is handed over for an ancestor NotificationUserDocumentStore to resolve
    DbxFirebaseNotificationUserSettingsDialogComponent.openDialog(this._matDialog, {
      header: this.header() ?? this.textSignal(),
      config: this.config(),
      injector: this._injector
    });
  }
}
