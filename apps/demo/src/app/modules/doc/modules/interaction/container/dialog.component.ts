import { MatDialog } from '@angular/material/dialog';
import { Component, inject } from '@angular/core';
import { DocInteractionExampleDialogComponent } from '../component/interaction.dialog.component';

@Component({
  templateUrl: './dialog.component.html'
})
export class DocInteractionDialogComponent {
  readonly matDialog = inject(MatDialog);

  openDialog() {
    this.matDialog.open(DocInteractionExampleDialogComponent);
  }
}
