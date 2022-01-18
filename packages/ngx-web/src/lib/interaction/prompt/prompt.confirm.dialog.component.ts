import { Component, Inject, Input, NgZone, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { AbstractDialogDirective } from '@/app/common/nav/dialog/abstract.dialog.directive';
import { TransitionService } from '@uirouter/core';
import { DbNgxPromptConfirmConfig } from './prompt.confirm.component';

@Component({
  template: `
    <dbx-prompt-confirm [config]="config" (confirm)="confirm()" (cancel)="cancel()"></dbx-prompt-confirm>
  `
})
export class DbNgxPromptConfirmDialogComponent extends AbstractDialogDirective implements OnInit {

  @Input()
  config: DbNgxPromptConfirmConfig;

  constructor(
    @Inject(MatDialogRef) dialogRef: MatDialogRef<DbNgxPromptConfirmDialogComponent>,
    transitionService: TransitionService,
    ngZone: NgZone) {
    super(dialogRef, transitionService, ngZone);
  }

  ngOnInit(): void {
    super.ngOnInit();
  }

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

}
