import { Component, Input, OnInit } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { AbstractDialogDirective } from '../../interaction/dialog/abstract.dialog.directive';
import { DbNgxPromptConfirmConfig } from './prompt.confirm.component';

@Component({
  template: `
    <dbx-prompt-confirm [config]="config" (confirm)="confirm()" (cancel)="cancel()"></dbx-prompt-confirm>
  `
})
export class DbNgxPromptConfirmDialogComponent extends AbstractDialogDirective implements OnInit {

  @Input()
  config?: Maybe<DbNgxPromptConfirmConfig>;

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

}
