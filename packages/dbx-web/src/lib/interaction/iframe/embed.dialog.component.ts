import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AbstractDialogDirective, DbxDialogContentDirective, DbxEmbedComponent } from '@dereekb/dbx-web';
import { ContentTypeMimeType, Maybe, WebsiteUrlWithPrefix } from '@dereekb/util';

export interface DbxEmbedDialogConfig {
  readonly srcUrl: WebsiteUrlWithPrefix;
  readonly embedMimeType?: Maybe<ContentTypeMimeType | string>;
  readonly sanitizeUrl?: boolean;
}

@Component({
  template: `
    <dbx-dialog-content>
      <dbx-embed [srcUrl]="srcUrl" [sanitizeUrl]="sanitizeUrl" [type]="type"></dbx-embed>
    </dbx-dialog-content>
  `,
  imports: [DbxDialogContentDirective, DbxEmbedComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxEmbedDialogComponent extends AbstractDialogDirective<void, DbxEmbedDialogConfig> {
  get type() {
    return this.data.embedMimeType;
  }

  get srcUrl() {
    return this.data.srcUrl;
  }

  get sanitizeUrl() {
    return this.data.sanitizeUrl;
  }

  static openDialog(matDialog: MatDialog, config: DbxEmbedDialogConfig): MatDialogRef<DbxEmbedDialogComponent, void> {
    const dialogRef = matDialog.open(DbxEmbedDialogComponent, {
      data: config
    });

    return dialogRef;
  }
}
