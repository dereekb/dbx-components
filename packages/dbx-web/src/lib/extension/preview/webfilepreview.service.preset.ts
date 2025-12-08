import { ZIP_FILE_MIME_TYPE } from '@dereekb/util';
import { DbxZipPreviewComponent } from '../zip';
import { DbxWebFilePreviewServicePreviewComponentFunction, DbxWebFilePreviewServicePreviewDialogWithComponentFunction, type DbxWebFilePreviewServiceEntry } from './webfilepreview';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';

// MARK: Zip
export const DBX_WEB_FILE_PREVIEW_SERVICE_ZIP_COMPONENT_PRESET: DbxWebFilePreviewServicePreviewComponentFunction = (input) => {
  const { srcUrl } = input;
  const config: DbxInjectionComponentConfig<DbxZipPreviewComponent> = {
    componentClass: DbxZipPreviewComponent,
    init: (x) => {
      x.srcUrl.set(srcUrl);
    }
  };

  return config;
};

/**
 * DbxWebFilePreviewServiceEntry for previewing a zip file using a DbxZipPreviewDialogComponent.
 */
export const DBX_WEB_FILE_PREVIEW_SERVICE_ZIP_PRESET_ENTRY: DbxWebFilePreviewServiceEntry = {
  mimeType: ZIP_FILE_MIME_TYPE,
  previewComponentFunction: DBX_WEB_FILE_PREVIEW_SERVICE_ZIP_COMPONENT_PRESET
};
