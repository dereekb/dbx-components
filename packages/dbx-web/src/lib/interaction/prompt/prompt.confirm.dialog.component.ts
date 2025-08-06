import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { AbstractDialogDirective } from '../dialog/abstract.dialog.directive';
import { DbxPromptConfirmComponent, DbxPromptConfirmConfig } from './prompt.confirm.component';
import { type Maybe } from '@dereekb/util';
import { DbxDialogContentDirective } from '../dialog/dialog.content.directive';

export const DEFAULT_DBX_PROMPT_CONFIRM_DIALOG_CONFIG = {
  title: 'Confirm?'
};

export interface DbxPromptConfirmDialogConfig extends DbxPromptConfirmConfig {
  component?: DbxInjectionComponentConfig;
}

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
export class DbxPromptConfirmDialogComponent extends AbstractDialogDirective<boolean, DbxPromptConfirmDialogConfig> implements OnInit {
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
