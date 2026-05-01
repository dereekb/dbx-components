import { type MatDialog, type MatDialogRef, type MatDialogConfig } from '@angular/material/dialog';
import { type Maybe, type WebsiteUrlWithPrefix } from '@dereekb/util';
import { DbxInjectionDialogComponent } from '../../interaction/dialog';
import { DbxPdfPreviewComponent } from './pdf.preview.component';

/**
 * Configuration for opening a PDF preview dialog. Extends {@link MatDialogConfig} with PDF-specific source options (blob or URL) and an optional download file name.
 */
export interface DbxPdfPreviewDialogConfig extends Omit<MatDialogConfig, 'data'> {
  readonly srcUrl?: Maybe<WebsiteUrlWithPrefix>;
  readonly blob?: Maybe<Blob>;
  readonly downloadFileName?: Maybe<string>;
}

/**
 * Opens a dialog containing a {@link DbxPdfPreviewComponent} for previewing a PDF blob or URL.
 *
 * @param matDialog The {@link MatDialog} instance to use.
 * @param config Source (blob or URL) and Material dialog options.
 * @returns The {@link MatDialogRef} for the opened dialog.
 */
export function openPdfPreviewDialog(matDialog: MatDialog, config: DbxPdfPreviewDialogConfig): MatDialogRef<DbxInjectionDialogComponent<DbxPdfPreviewComponent>, void> {
  return DbxInjectionDialogComponent.openDialog(matDialog, {
    ...config,
    showCloseButton: false,
    componentConfig: {
      componentClass: DbxPdfPreviewComponent,
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
