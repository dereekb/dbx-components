import { Component } from '@angular/core';
import { AbstractDialogDirective } from '@dereekb/dbx-web';

@Component({
  template: `
  <dbx-dialog-content>
    <p>This is a dialog.</p>
    <button mat-raised-button (click)="close()">Closed</button>
  </dbx-dialog-content>
  `
})
export class DocInteractionExampleDialogComponent extends AbstractDialogDirective { }
