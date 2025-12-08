import { MatDialog, MatDialogRef, MatDialogConfig } from '@angular/material/dialog';
import { ContentTypeMimeType, Maybe, WebsiteUrlWithPrefix } from '@dereekb/util';
import { DbxEmbedComponent } from './embed.component';
import { DbxInjectionDialogComponent } from '../dialog/dialog.injection.component';

export interface DbxEmbedDialogConfig extends Omit<MatDialogConfig, 'data'> {
  readonly srcUrl?: Maybe<WebsiteUrlWithPrefix>;
  readonly blob?: Maybe<Blob>;
  readonly embedMimeType?: Maybe<ContentTypeMimeType | string>;
  readonly sanitizeUrl?: boolean;
}

/**
 * Opens a dialog with DbxEmbedComponent.
 *
 * @param matDialog The MatDialog instance to use.
 * @param config The configuration for the dialog.
 * @returns The MatDialogRef for the dialog.
 */
export function openEmbedDialog(matDialog: MatDialog, config: DbxEmbedDialogConfig): MatDialogRef<DbxInjectionDialogComponent<DbxEmbedComponent>, void> {
  return DbxInjectionDialogComponent.openDialog(matDialog, {
    ...config,
    showCloseButton: false,
    componentConfig: {
      componentClass: DbxEmbedComponent,
      init: (x) => {
        const { blob, srcUrl, embedMimeType, sanitizeUrl } = config;

        if (blob != null) {
          x.blob.set(blob);
        }

        if (srcUrl != null) {
          x.srcUrl.set(srcUrl);
        }

        if (embedMimeType != null) {
          x.type.set(embedMimeType);
        }

        if (sanitizeUrl != null) {
          x.sanitizeUrl.set(sanitizeUrl);
        }
      }
    }
  });
}
