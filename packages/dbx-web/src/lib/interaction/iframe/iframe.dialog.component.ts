import { MatDialog, MatDialogRef, MatDialogConfig } from '@angular/material/dialog';
import { WebsiteUrlWithPrefix } from '@dereekb/util';
import { DbxIframeComponent } from './iframe.component';
import { DbxInjectionDialogComponent } from '../dialog/dialog.injection.component';

export interface DbxIframeDialogConfig extends Omit<MatDialogConfig, 'data'> {
  readonly contentUrl: WebsiteUrlWithPrefix;
}

/**
 * Opens a dialog with DbxEmbedComponent.
 *
 * @param matDialog The MatDialog instance to use.
 * @param config The configuration for the dialog.
 * @returns The MatDialogRef for the dialog.
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
