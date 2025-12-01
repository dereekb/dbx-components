import { ZIP_FILE_MIME_TYPE } from '@dereekb/util';
import { DbxEmbedDialogComponent } from '../../interaction/iframe/embed.dialog.component';
import { DbxZipPreviewDialogComponent } from '../zip';
import { DbxWebFilePreviewServiceEntry, DbxWebFilePreviewServicePreviewFunction } from './preview';

/**
 * Default preset for previewing a file using a DbxEmbedDialogComponent.
 */
export const DBX_WEB_FILE_PREVIEW_SERVICE_DEFAULT_PRESET: DbxWebFilePreviewServicePreviewFunction = (matDialog, srcUrl, embedMimeType) => {
  return DbxEmbedDialogComponent.openDialog(matDialog, {
    srcUrl,
    embedMimeType,
    sanitizeUrl: true
  });
};

/**
 * Preset for previewing a zip file using a DbxZipPreviewDialogComponent.
 */
export const DBX_WEB_FILE_PREVIEW_SERVICE_ZIP_PRESET: DbxWebFilePreviewServicePreviewFunction = (matDialog, srcUrl) => {
  return DbxZipPreviewDialogComponent.openDialog(matDialog, {
    srcUrl
  });
};

export const DBX_WEB_FILE_PREVIEW_SERVICE_ZIP_PRESET_ENTRY: DbxWebFilePreviewServiceEntry = {
  mimeType: ZIP_FILE_MIME_TYPE,
  previewFunction: DBX_WEB_FILE_PREVIEW_SERVICE_ZIP_PRESET
};
