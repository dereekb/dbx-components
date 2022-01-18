import { Component, Inject, Input, NgZone, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { AbstractDialogDirective } from '@/app/common/nav/dialog/abstract.dialog.directive';
import { TransitionService } from '@uirouter/core';
import { ActionContextStoreSourceInstance } from './action';
import { DbNgxPromptConfirmConfig, DbNgxPromptConfirmTypes } from '../responsive/prompt/prompt.confirm.component';

export enum DbNgxActionTransitionSafetyDialogResult {
  SUCCESS,
  STAY,
  DISCARD,
  NONE
}

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
export class DbNgxActionTransitionSafetyDialogComponent extends AbstractDialogDirective implements OnInit {

  config: DbNgxPromptConfirmConfig = {
    type: DbNgxPromptConfirmTypes.NORMAL,
    title: 'Unsaved Changes',
    prompt: 'You have unsaved changes on this page.',
    confirmText: 'Stay',
    cancelText: 'Discard Changes'
  };

  constructor(
    readonly source: ActionContextStoreSourceInstance,
    @Inject(MatDialogRef) dialogRef: MatDialogRef<DbNgxActionTransitionSafetyDialogComponent>,
    transitionService: TransitionService,
    ngZone: NgZone) {
    super(dialogRef, transitionService, ngZone);
  }

  ngOnInit(): void {
    super.ngOnInit();
  }

  confirm(): void {
    this.dialogRef.close(DbNgxActionTransitionSafetyDialogResult.STAY);
  }

  cancel(): void {
    this.dialogRef.close(DbNgxActionTransitionSafetyDialogResult.DISCARD);
  }

}
