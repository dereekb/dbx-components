import { Component } from '@angular/core';
import { AbstractDialogDirective } from '@dereekb/dbx-web';

@Component({
  template: `
    <dbx-dialog-content>
      <dbx-dialog-content-close [padded]="true" (close)="close()"></dbx-dialog-content-close>
      <p>This is a dialog. Click the close button to close, or the X button to close.</p>
      <button mat-raised-button (click)="close()">Closed</button>
    </dbx-dialog-content>
  `
})
export class DocInteractionExampleDialogComponent extends AbstractDialogDirective {}
