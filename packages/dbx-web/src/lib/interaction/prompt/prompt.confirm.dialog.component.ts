import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DbxInjectedComponentConfig } from '@dereekb/dbx-core';
import { Component, OnInit } from '@angular/core';
import { AbstractDialogDirective } from '../dialog/abstract.dialog.directive';
import { DbxPromptConfirmConfig, DbxPromptConfirmTypes } from './prompt.confirm.component';
import { Maybe } from '@dereekb/util';

export const DEFAULT_DBX_PROMPT_CONFIRM_DIALOG_CONFIG = {
  title: 'Confirm?',
  type: DbxPromptConfirmTypes.NORMAL
};

export interface DbxPromptConfirmDialogConfig extends DbxPromptConfirmConfig {
  component?: DbxInjectedComponentConfig;
}

@Component({
  template: `
    <dbx-dialog-content>
      <dbx-prompt-confirm [config]="config" (confirm)="confirm()" (cancel)="cancel()">
        <dbx-injected-content [config]="injectedConfig"></dbx-injected-content>
      </dbx-prompt-confirm>
    </dbx-dialog-content>
  `
})
export class DbxPromptConfirmDialogComponent extends AbstractDialogDirective<boolean, DbxPromptConfirmDialogConfig> implements OnInit {

  get config(): DbxPromptConfirmDialogConfig {
    return this.data;
  }

  get injectedConfig(): Maybe<DbxInjectedComponentConfig> {
    return this.data.component;
  }

  static openDialog(matDialog: MatDialog, config: DbxPromptConfirmDialogConfig = DEFAULT_DBX_PROMPT_CONFIRM_DIALOG_CONFIG): MatDialogRef<DbxPromptConfirmDialogComponent, boolean> {
    const dialogRef = matDialog.open(DbxPromptConfirmDialogComponent, {
      data: config
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
