import { Component } from '@angular/core';
import { AbstractDialogDirective } from '@dereekb/dbx-web';
import { DbxDialogContentDirective } from '../../../../../../../../../packages/dbx-web/src/lib/interaction/dialog/dialog.content.directive';
import { DbxDialogContentCloseComponent } from '../../../../../../../../../packages/dbx-web/src/lib/interaction/dialog/dialog.content.close.component';
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
