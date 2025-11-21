import { Component } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AbstractDialogDirective, DbxDialogContentDirective, DbxIframeComponent } from '@dereekb/dbx-web';
import { WebsiteUrlWithPrefix } from '@dereekb/util';

export interface DbxIframeDialogConfig {
  readonly contentUrl: WebsiteUrlWithPrefix;
}

@Component({
  template: `
    <dbx-dialog-content>
      <dbx-iframe [contentUrl]="contentUrl"></dbx-iframe>
    </dbx-dialog-content>
  `,
  standalone: true,
  imports: [DbxDialogContentDirective, DbxIframeComponent]
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
