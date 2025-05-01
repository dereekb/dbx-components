import { Component } from '@angular/core';
import { AbstractDialogDirective } from '@dereekb/dbx-web';
import { DbxDialogContentDirective } from '@dereekb/dbx-web';
import { DbxDialogContentCloseComponent } from '@dereekb/dbx-web';
import { MatButton } from '@angular/material/button';

@Component({
  template: `
    <dbx-dialog-content>
      <dbx-dialog-content-close [padded]="true" (close)="close()"></dbx-dialog-content-close>
      <p>This is a dialog. Click the close button to close, or the X button to close.</p>
      <button mat-raised-button (click)="close()">Closed</button>
    </dbx-dialog-content>
  `,
  standalone: true,
  imports: [DbxDialogContentDirective, DbxDialogContentCloseComponent, MatButton]
})
export class DocInteractionExampleDialogComponent extends AbstractDialogDirective {}
