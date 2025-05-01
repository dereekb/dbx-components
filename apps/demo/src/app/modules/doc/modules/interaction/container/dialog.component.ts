import { MatDialog } from '@angular/material/dialog';
import { Component, inject } from '@angular/core';
import { DocInteractionExampleDialogComponent } from '../component/interaction.dialog.component';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton } from '@angular/material/button';
import { DbxContentPitDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.pit.directive';
import { DbxDialogContentDirective } from '../../../../../../../../../packages/dbx-web/src/lib/interaction/dialog/dialog.content.directive';
import { DbxDialogContentCloseComponent } from '../../../../../../../../../packages/dbx-web/src/lib/interaction/dialog/dialog.content.close.component';

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
