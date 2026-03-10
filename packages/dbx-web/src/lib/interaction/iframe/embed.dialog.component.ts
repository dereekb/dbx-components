import { type MatDialog, type MatDialogRef, type MatDialogConfig } from '@angular/material/dialog';
import { type ContentTypeMimeType, type Maybe, type WebsiteUrlWithPrefix } from '@dereekb/util';
import { DbxEmbedComponent } from './embed.component';
import { DbxInjectionDialogComponent } from '../dialog/dialog.injection.component';

/**
 * Configuration for opening an embed dialog, supporting both URL and Blob content sources.
 */
export interface DbxEmbedDialogConfig extends Omit<MatDialogConfig, 'data'> {
  readonly srcUrl?: Maybe<WebsiteUrlWithPrefix>;
  readonly blob?: Maybe<Blob>;
  readonly embedMimeType?: Maybe<ContentTypeMimeType | string>;
  readonly sanitizeUrl?: boolean;
}

/**
 * Opens a dialog containing a {@link DbxEmbedComponent} to display embedded content from a URL or Blob.
 *
 * @example
 * ```ts
 * const ref = openEmbedDialog(matDialog, { srcUrl: 'https://example.com/doc.pdf', embedMimeType: 'application/pdf' });
 * ```
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
