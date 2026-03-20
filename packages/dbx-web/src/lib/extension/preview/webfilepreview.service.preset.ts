import { ZIP_FILE_MIME_TYPE } from '@dereekb/util';
import { DbxZipPreviewComponent } from '../zip';
import { type DbxWebFilePreviewServicePreviewComponentFunction, type DbxWebFilePreviewServiceEntry } from './webfilepreview';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';

// MARK: Zip
/**
 * Preview component function preset that renders zip files using {@link DbxZipPreviewComponent}.
 *
 * @param input - The preview input containing the source URL and MIME type of the zip file
 * @returns An injection component config that initializes a {@link DbxZipPreviewComponent} with the given source URL
 */
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
