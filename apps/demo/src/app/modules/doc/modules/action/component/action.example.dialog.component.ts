import { Component } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AbstractDialogDirective, DbxDialogContentDirective, DbxButtonSpacerDirective } from '@dereekb/dbx-web';
import { MatButton } from '@angular/material/button';

@Component({
  template: `
    <dbx-dialog-content>
      <p>Pick a value.</p>
      <div>
        <button mat-raised-button (click)="close(100)">100</button>
        <dbx-button-spacer></dbx-button-spacer>
        <button mat-raised-button (click)="close(1000)">1000</button>
        <dbx-button-spacer></dbx-button-spacer>
        <button mat-raised-button (click)="close()">Cancel</button>
      </div>
    </dbx-dialog-content>
  `,
  standalone: true,
  imports: [DbxDialogContentDirective, MatButton, DbxButtonSpacerDirective]
})
export class DocActionExampleDialogComponent extends AbstractDialogDirective {
  static openDialog(matDialog: MatDialog): MatDialogRef<DocActionExampleDialogComponent, boolean> {
    const dialogRef = matDialog.open(DocActionExampleDialogComponent, {});
    return dialogRef;
  }
}
