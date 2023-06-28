import { Component } from '@angular/core';
import { AbstractDialogDirective } from '@dereekb/dbx-web';

@Component({
  template: `
    <dbx-dialog-content>
      <dbx-dialog-content-close (close)="close()"></dbx-dialog-content-close>
      <p>This is a dialog.</p>
      <button mat-raised-button (click)="close()">Closed</button>
    </dbx-dialog-content>
  `
})
export class DocInteractionExampleDialogComponent extends AbstractDialogDirective {}
