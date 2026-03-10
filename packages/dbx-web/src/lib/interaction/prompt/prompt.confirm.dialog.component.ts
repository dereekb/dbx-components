import { type MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { AbstractDialogDirective } from '../dialog/abstract.dialog.directive';
import { DbxPromptConfirmComponent, type DbxPromptConfirmConfig } from './prompt.confirm.component';
import { type Maybe } from '@dereekb/util';
import { DbxDialogContentDirective } from '../dialog/dialog.content.directive';

/**
 * Default configuration used when no custom config is provided to the confirm dialog.
 */
export const DEFAULT_DBX_PROMPT_CONFIRM_DIALOG_CONFIG = {
  title: 'Confirm?'
};

/**
 * Configuration for the confirmation dialog, extending prompt config with an optional injected component.
 */
export interface DbxPromptConfirmDialogConfig extends DbxPromptConfirmConfig {
  component?: DbxInjectionComponentConfig;
}

/**
 * Dialog component that displays a confirmation prompt and returns a boolean result.
 *
 * Use the static `openDialog` method to programmatically open the dialog.
 *
 * @example
 * ```ts
 * const ref = DbxPromptConfirmDialogComponent.openDialog(matDialog, {
 *   title: 'Delete item?',
 *   prompt: 'This action cannot be undone.',
 *   confirmText: 'Delete'
 * });
 * ref.afterClosed().subscribe(confirmed => { ... });
 * ```
 */
@Component({
  template: `
    <dbx-dialog-content>
      <dbx-prompt-confirm [config]="config" (confirm)="confirm()" (cancel)="cancel()">
        <dbx-injection [config]="injectionConfig"></dbx-injection>
      </dbx-prompt-confirm>
    </dbx-dialog-content>
  `,
  standalone: true,
  imports: [DbxDialogContentDirective, DbxPromptConfirmComponent, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxPromptConfirmDialogComponent extends AbstractDialogDirective<boolean, DbxPromptConfirmDialogConfig> {
  get config(): DbxPromptConfirmDialogConfig {
    return this.data;
  }

  get injectionConfig(): Maybe<DbxInjectionComponentConfig> {
    return this.data.component;
  }

  static openDialog(matDialog: MatDialog, config?: Maybe<DbxPromptConfirmDialogConfig>): MatDialogRef<DbxPromptConfirmDialogComponent, boolean> {
    const dialogRef = matDialog.open(DbxPromptConfirmDialogComponent, {
      data: config ?? DEFAULT_DBX_PROMPT_CONFIRM_DIALOG_CONFIG
    });

    return dialogRef;
  }

  confirm(): void {
    this.close(true);
  }

  cancel(): void {
    this.close(false);
  }
}
