import { MatDialog, MatDialogRef, MatDialogConfig } from '@angular/material/dialog';
import { WebsiteUrlWithPrefix, Maybe } from '@dereekb/util';
import { DbxInjectionDialogComponent } from '../../interaction/dialog';
import { DbxZipPreviewComponent } from './zip.preview.component';

export interface DbxZipPreviewDialogConfig extends Omit<MatDialogConfig, 'data'> {
  readonly srcUrl?: Maybe<WebsiteUrlWithPrefix>;
  readonly blob?: Maybe<Blob>;
  readonly downloadFileName?: Maybe<string>;
}

/**
 * Opens a dialog with DbxZipPreviewComponent.
 *
 * @param matDialog The MatDialog instance to use.
 * @param config The configuration for the dialog.
 * @returns The MatDialogRef for the dialog.
 */
export function openZipPreviewDialog(matDialog: MatDialog, config: DbxZipPreviewDialogConfig): MatDialogRef<DbxInjectionDialogComponent<DbxZipPreviewComponent>, void> {
  return DbxInjectionDialogComponent.openDialog(matDialog, {
    ...config,
    showCloseButton: false,
    componentConfig: {
      componentClass: DbxZipPreviewComponent,
      init: (x) => {
        const { blob, srcUrl, downloadFileName } = config;

        if (blob != null) {
          x.blob.set(blob);
        }

        if (srcUrl != null) {
          x.srcUrl.set(srcUrl);
        }

        if (downloadFileName != null) {
          x.downloadFileName.set(downloadFileName);
        }
      }
    }
  });
}
