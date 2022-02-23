import { Component, OnInit } from '@angular/core';
import { DbxPromptConfirmConfig, DbxPromptConfirmTypes, AbstractDialogDirective } from '../../interaction';

export enum DbxActionTransitionSafetyDialogResult {
  SUCCESS,
  STAY,
  DISCARD,
  NONE
}

/**
 * Dialog that is shown/triggered as part of the DbxActionTransitionSafety
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
export class DbxActionUIRouterTransitionSafetyDialogComponent extends AbstractDialogDirective implements OnInit {

  config: DbxPromptConfirmConfig = {
    type: DbxPromptConfirmTypes.NORMAL,
    title: 'Unsaved Changes',
    prompt: 'You have unsaved changes on this page.',
    confirmText: 'Stay',
    cancelText: 'Discard Changes'
  };

  confirm(): void {
    this.dialogRef.close(DbxActionTransitionSafetyDialogResult.STAY);
  }

  cancel(): void {
    this.dialogRef.close(DbxActionTransitionSafetyDialogResult.DISCARD);
  }

}
