import { type Maybe } from '@dereekb/util';
import { compressImageFile, type DbxImageCompressionConfig, type ImageBitmapToBlobEncoder } from '@dereekb/dbx-web';
import { type DbxFirebaseStorageFileUploadFileModifier } from '../store/storagefile.upload.store';

/**
 * Configuration for {@link dbxFirebaseStorageFileImageCompressionFileModifier}. Wraps {@link DbxImageCompressionConfig} so additional knobs can be added without breaking callers.
 */
export interface DbxFirebaseStorageFileImageCompressionFileModifierConfig {
  /**
   * Compression rules forwarded to {@link compressImageFile}. PNG/JPEG inputs are resized / re-encoded according to this config; other file types pass through unchanged.
   */
  readonly compression: DbxImageCompressionConfig;
  /**
   * Optional encoder override forwarded to {@link compressImageFile}. Defaults to {@link DEFAULT_IMAGE_BITMAP_TO_BLOB_ENCODER}.
   */
  readonly encoder?: Maybe<ImageBitmapToBlobEncoder>;
}

/**
 * Returns a {@link DbxFirebaseStorageFileUploadFileModifier} that runs {@link compressImageFile} on each input file. Non-image files pass through untouched (compressImageFile short-circuits anything that is not PNG or JPEG). Images are downscaled and/or PNG→JPEG converted per `config.compression`; the returned `File` may have a rewritten name/extension when conversion ran.
 *
 * @param config - Compression rules and optional encoder override.
 * @returns A modifier suitable for {@link DbxFirebaseStorageFileUploadStore.setFileModifier}.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function dbxFirebaseStorageFileImageCompressionFileModifier(config: DbxFirebaseStorageFileImageCompressionFileModifierConfig): DbxFirebaseStorageFileUploadFileModifier {
  const { compression, encoder } = config;
  return async (file) => {
    const result = await compressImageFile(file, compression, encoder ?? undefined);
    return result.file;
  };
}
