import { Component, Input, OnInit } from '@angular/core';
import { AbstractDialogDirective } from '../../interaction';
import { DbNgxPromptConfirmConfig } from './prompt.confirm.component';

@Component({
  template: `
    <dbx-prompt-confirm [config]="config" (confirm)="confirm()" (cancel)="cancel()"></dbx-prompt-confirm>
  `
})
export class DbNgxPromptConfirmDialogComponent extends AbstractDialogDirective implements OnInit {

  @Input()
  config?: DbNgxPromptConfirmConfig;

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

}
