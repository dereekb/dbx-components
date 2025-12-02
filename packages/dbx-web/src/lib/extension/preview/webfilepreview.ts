import { type MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { type WebsiteUrlWithPrefix, type Maybe, type ContentTypeMimeType, type ArrayOrValue, type MimeTypeWithoutParameters } from '@dereekb/util';

/**
 * Used for previewing a src url and embedMimeType.
 */
export type DbxWebFilePreviewServicePreviewFunction = (matDialog: MatDialog, srcUrl: WebsiteUrlWithPrefix, embedMimeType?: Maybe<ContentTypeMimeType | string>) => MatDialogRef<any, any>;

export interface DbxWebFilePreviewServiceEntry {
  /**
   * The MimeType(s) to associate the preview function with.
   */
  readonly mimeType: ArrayOrValue<MimeTypeWithoutParameters | string>;
  readonly previewFunction: DbxWebFilePreviewServicePreviewFunction;
}
