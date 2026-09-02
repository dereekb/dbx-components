import { ChangeDetectionStrategy, Component, Injector, computed, inject, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { type Maybe } from '@dereekb/util';
import { DbxButtonComponent } from '@dereekb/dbx-web';
import { DbxFirebaseNotificationHealthCheckDialogComponent } from './healthcheck.dialog.component';

/**
 * Configuration for the {@link DbxFirebaseNotificationHealthCheckDialogButtonComponent}.
 */
export interface DbxFirebaseNotificationHealthCheckDialogButtonComponentConfig {
  readonly text?: Maybe<string>;
  readonly icon?: Maybe<string>;
}

/**
 * Button that opens the notification delivery health check in a dialog.
 *
 * Place it inside a `dbxFirebaseNotificationUserDocument` so the dialog's view component can resolve
 * that directive's NotificationUserDocumentStore.
 */
@Component({
  selector: 'dbx-firebase-notification-healthcheck-dialog-button',
  template: `
    <dbx-button [stroked]="true" [text]="textSignal()" [icon]="iconSignal()" (buttonClick)="openHealthCheckDialog()"></dbx-button>
  `,
  host: {
    class: 'dbx-firebase-notification-healthcheck-dialog-button'
  },
  imports: [DbxButtonComponent]
})
export class DbxFirebaseNotificationHealthCheckDialogButtonComponent {
  private readonly _matDialog = inject(MatDialog);
  private readonly _injector = inject(Injector);

  readonly config = input<Maybe<DbxFirebaseNotificationHealthCheckDialogButtonComponentConfig>>();
  readonly text = input<Maybe<string>>();
  readonly icon = input<Maybe<string>>();

  readonly textSignal = computed(() => {
    const config = this.config();
    return this.text() ?? config?.text ?? 'Check Notification Delivery';
  });
  readonly iconSignal = computed(() => {
    const config = this.config();
    return this.icon() ?? config?.icon ?? 'monitor_heart';
  });

  openHealthCheckDialog(): void {
    // the dialog renders outside this component's view, so its injector has to be handed over for the
    // NotificationUserDocumentStore to resolve inside it
    DbxFirebaseNotificationHealthCheckDialogComponent.openDialog(this._matDialog, { injector: this._injector });
  }
}
