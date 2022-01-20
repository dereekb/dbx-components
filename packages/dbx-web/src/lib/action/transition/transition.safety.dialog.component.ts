import { Component, OnInit } from '@angular/core';
import { DbNgxPromptConfirmConfig, DbNgxPromptConfirmTypes, AbstractDialogDirective } from '../../interaction';

export enum DbNgxActionTransitionSafetyDialogResult {
  SUCCESS,
  STAY,
  DISCARD,
  NONE
}

/**
 * Dialog that is shown/triggered as part of the DbNgxActionTransitionSafety
 */
@Component({
  template: `
    <dbx-prompt-confirm [config]="config" (confirm)="confirm()" (cancel)="cancel()">
      <ng-container>
        <dbx-error dbxActionError></dbx-error>
        <dbx-button text="Save Changes" dbxActionButton></dbx-button>
        <dbx-button-spacer></dbx-button-spacer>
      </ng-container>
    </dbx-prompt-confirm>
  `
})
export class DbNgxActionUIRouterTransitionSafetyDialogComponent extends AbstractDialogDirective implements OnInit {

  config: DbNgxPromptConfirmConfig = {
    type: DbNgxPromptConfirmTypes.NORMAL,
    title: 'Unsaved Changes',
    prompt: 'You have unsaved changes on this page.',
    confirmText: 'Stay',
    cancelText: 'Discard Changes'
  };

  confirm(): void {
    this.dialogRef.close(DbNgxActionTransitionSafetyDialogResult.STAY);
  }

  cancel(): void {
    this.dialogRef.close(DbNgxActionTransitionSafetyDialogResult.DISCARD);
  }

}
