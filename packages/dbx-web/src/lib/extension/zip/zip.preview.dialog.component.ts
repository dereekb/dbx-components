import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { WebsiteUrlWithPrefix } from '@dereekb/util';
import { DbxDialogContentDirective, AbstractDialogDirective } from '../../interaction/dialog';
import { DbxZipPreviewComponent } from './zip.preview.component';
import { Maybe } from '@dereekb/util';

export interface DbxZipPreviewDialogConfig {
  readonly srcUrl?: Maybe<WebsiteUrlWithPrefix>;
  readonly blob?: Maybe<Blob>;
  readonly downloadFileName?: Maybe<string>;
}

@Component({
  template: `
    <dbx-dialog-content>
      <dbx-zip-preview [srcUrl]="srcUrl" [blob]="blob" [downloadFileName]="downloadFileName"></dbx-zip-preview>
    </dbx-dialog-content>
  `,
  imports: [DbxZipPreviewComponent, DbxDialogContentDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxZipPreviewDialogComponent extends AbstractDialogDirective<void, DbxZipPreviewDialogConfig> {
  get srcUrl() {
    return this.data.srcUrl;
  }

  get blob() {
    return this.data.blob;
  }

  get downloadFileName() {
    return this.data.downloadFileName;
  }

  static openDialog(matDialog: MatDialog, config: DbxZipPreviewDialogConfig): MatDialogRef<DbxZipPreviewDialogComponent, void> {
    const dialogRef = matDialog.open(DbxZipPreviewDialogComponent, {
      data: config
    });

    return dialogRef;
  }
}
