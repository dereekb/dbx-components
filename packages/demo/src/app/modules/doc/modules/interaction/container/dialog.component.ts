import { MatDialog } from '@angular/material/dialog';
import { Component } from '@angular/core';
import { DocInteractionExampleDialogComponent } from '../component/interaction.dialog.component';

@Component({
  templateUrl: './dialog.component.html'
})
export class DocInteractionDialogComponent {

  constructor(readonly matDialog: MatDialog) { }

  openDialog() {
    this.matDialog.open(DocInteractionExampleDialogComponent);
    
  }

}
