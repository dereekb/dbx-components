import { MatDialog } from '@angular/material/dialog';
import { Component, inject } from '@angular/core';
import { DocInteractionExampleDialogComponent } from '../component/interaction.dialog.component';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton } from '@angular/material/button';
import { DbxContentPitDirective } from '@dereekb/dbx-web';
import { DbxDialogContentDirective } from '@dereekb/dbx-web';
import { DbxDialogContentCloseComponent } from '@dereekb/dbx-web';

@Component({
  templateUrl: './dialog.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, MatButton, DbxContentPitDirective, DbxDialogContentDirective, DbxDialogContentCloseComponent]
})
export class DocInteractionDialogComponent {
  readonly matDialog = inject(MatDialog);

  openDialog() {
    this.matDialog.open(DocInteractionExampleDialogComponent);
  }
}
