import { type MatDialog, type MatDialogRef, type MatDialogConfig } from '@angular/material/dialog';
import { type WebsiteUrlWithPrefix } from '@dereekb/util';
import { DbxIframeComponent } from './iframe.component';
import { DbxInjectionDialogComponent } from '../dialog/dialog.injection.component';

/**
 * Configuration for opening an iframe dialog.
 */
export interface DbxIframeDialogConfig extends Omit<MatDialogConfig, 'data'> {
  readonly contentUrl: WebsiteUrlWithPrefix;
}

/**
 * Opens a dialog containing a {@link DbxIframeComponent} to display a URL in an iframe.
 *
 * @param matDialog - The Angular Material dialog service used to open the dialog
 * @param config - Configuration specifying the content URL and dialog options
 * @returns A reference to the opened dialog for controlling or subscribing to its lifecycle
 *
 * @example
 * ```ts
 * const ref = openIframeDialog(matDialog, { contentUrl: 'https://example.com' });
 * ```
 */
export function openIframeDialog(matDialog: MatDialog, config: DbxIframeDialogConfig): MatDialogRef<DbxInjectionDialogComponent<DbxIframeComponent>, void> {
  return DbxInjectionDialogComponent.openDialog(matDialog, {
    ...config,
    showCloseButton: true,
    componentConfig: {
      componentClass: DbxIframeComponent,
      init: (x) => {
        const { contentUrl } = config;
        x.contentUrl.set(contentUrl);
      }
    }
  });
}
