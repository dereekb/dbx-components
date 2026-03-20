import { MatDialog } from '@angular/material/dialog';
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { DocInteractionExampleDialogComponent } from '../component/interaction.dialog.component';
import { DbxContentContainerDirective, DbxContentPitDirective, DbxDialogContentDirective, DbxDialogContentCloseComponent, openIframeDialog } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton } from '@angular/material/button';

@Component({
  templateUrl: './dialog.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, MatButton, DbxContentPitDirective, DbxDialogContentDirective, DbxDialogContentCloseComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocInteractionDialogComponent {
  readonly matDialog = inject(MatDialog);

  openDialog() {
    this.matDialog.open(DocInteractionExampleDialogComponent);
  }

  openInjectionDialog() {
    return openIframeDialog(this.matDialog, {
      contentUrl: 'https://iframetester.com/'
    });
  }
}
