import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ContentTypeMimeType, Maybe, WebsiteUrlWithPrefix } from '@dereekb/util';
import { AbstractDialogDirective } from '../dialog/abstract.dialog.directive';
import { DbxEmbedComponent } from './embed.component';
import { DbxDialogContentDirective } from '../dialog/dialog.content.directive';
import { MatDialogConfig } from '@angular/material/dialog';

export interface DbxEmbedDialogConfig extends Omit<MatDialogConfig, 'data'> {
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
      ...config,
      data: config
    });

    return dialogRef;
  }
}
