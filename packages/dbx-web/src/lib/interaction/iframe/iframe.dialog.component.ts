import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { WebsiteUrlWithPrefix } from '@dereekb/util';
import { AbstractDialogDirective } from '../dialog/abstract.dialog.directive';
import { DbxDialogContentDirective } from '../dialog/dialog.content.directive';
import { DbxIframeComponent } from './iframe.component';

export interface DbxIframeDialogConfig {
  readonly contentUrl: WebsiteUrlWithPrefix;
}

@Component({
  template: `
    <dbx-dialog-content>
      <dbx-iframe [contentUrl]="contentUrl"></dbx-iframe>
    </dbx-dialog-content>
  `,
  imports: [DbxDialogContentDirective, DbxIframeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxIframeDialogComponent extends AbstractDialogDirective<void, DbxIframeDialogConfig> {
  get contentUrl() {
    return this.data.contentUrl;
  }

  static openDialog(matDialog: MatDialog, config: DbxIframeDialogConfig): MatDialogRef<DbxIframeDialogComponent, void> {
    const dialogRef = matDialog.open(DbxIframeDialogComponent, {
      data: config
    });

    return dialogRef;
  }
}
