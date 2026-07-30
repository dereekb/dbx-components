import { ChangeDetectionStrategy, Component, type Injector } from '@angular/core';
import { type MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { AbstractDialogDirective, DbxDialogContentDirective } from '@dereekb/dbx-web';
import { DbxFirebaseNotificationHealthCheckViewComponent } from './healthcheck.view.component';

/**
 * Configuration for opening a {@link DbxFirebaseNotificationHealthCheckDialogComponent}.
 */
export interface DbxFirebaseNotificationHealthCheckDialogComponentConfig {
  /**
   * The injector to open the dialog with.
   *
   * A dialog renders outside the opening component's view, so it does not inherit that component's
   * injector by default. Passing the opener's injector is what lets the view component resolve the
   * NotificationUserDocumentStore that `dbxFirebaseNotificationUserDocument` provided.
   */
  readonly injector?: Injector;
}

/**
 * Dialog wrapper around {@link DbxFirebaseNotificationHealthCheckViewComponent}.
 */
@Component({
  template: `
    <dbx-dialog-content>
      <dbx-firebase-notification-healthcheck-view></dbx-firebase-notification-healthcheck-view>
    </dbx-dialog-content>
  `,
  standalone: true,
  imports: [DbxDialogContentDirective, DbxFirebaseNotificationHealthCheckViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseNotificationHealthCheckDialogComponent extends AbstractDialogDirective {
  /**
   * Opens the notification delivery health check in a dialog.
   *
   * @param matDialog - The dialog service.
   * @param config - The injector to resolve the NotificationUserDocumentStore from.
   * @returns The dialog reference.
   */
  static openDialog(matDialog: MatDialog, config?: DbxFirebaseNotificationHealthCheckDialogComponentConfig): MatDialogRef<DbxFirebaseNotificationHealthCheckDialogComponent> {
    return matDialog.open(DbxFirebaseNotificationHealthCheckDialogComponent, {
      // a report with several delivery methods can exceed the viewport. Material inherits the pane's
      // max-height down to the dialog surface, which already scrolls, so capping it here keeps the
      // actions reachable. A percentage cap would not work, as the pane's height is not definite.
      maxHeight: 'calc(var(--vh100) * 0.9)',
      injector: config?.injector
    });
  }
}
