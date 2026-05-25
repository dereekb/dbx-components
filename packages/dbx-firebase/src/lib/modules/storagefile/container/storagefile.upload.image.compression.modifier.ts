import { type Maybe } from '@dereekb/util';
import { compressImageFile, type CompressImageFileResult, type DbxImageCompressionConfig, type ImageBitmapToBlobEncoder } from '@dereekb/dbx-web';
import { type DbxFirebaseStorageFileUploadFileModifier } from '../store/storagefile.upload.store';

/**
 * Callback invoked after each {@link compressImageFile} call when logging is enabled on {@link dbxFirebaseStorageFileImageCompressionFileModifier}. Receives the original input file and the full {@link CompressImageFileResult}.
 */
export type DbxFirebaseStorageFileImageCompressionLogger = (input: File, result: CompressImageFileResult) => void;

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
  /**
   * Controls compression-outcome logging.
   * - `false` / unset — no logging (default).
   * - `true` — logs each outcome whose `compression` status is not `'unchanged'` via `console.info`, with the file name, original/final sizes, status, and (when available) original dimensions.
   * - Function — invoked for every result (including `'unchanged'`); `console.info` is skipped so the caller fully owns logging.
   */
  readonly log?: Maybe<boolean | DbxFirebaseStorageFileImageCompressionLogger>;
}

/**
 * Returns a {@link DbxFirebaseStorageFileUploadFileModifier} that runs {@link compressImageFile} on each input file. Non-image files pass through untouched (compressImageFile short-circuits anything that is not PNG or JPEG). Images are downscaled and/or PNG→JPEG converted per `config.compression`; the returned `File` may have a rewritten name/extension when conversion ran.
 *
 * When `config.log` is set, each compression outcome is forwarded to a logger (see {@link DbxFirebaseStorageFileImageCompressionFileModifierConfig.log}).
 *
 * @param config - Compression rules, optional encoder override, and optional logging hook.
 * @returns A modifier suitable for {@link DbxFirebaseStorageFileUploadStore.setFileModifier}.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function dbxFirebaseStorageFileImageCompressionFileModifier(config: DbxFirebaseStorageFileImageCompressionFileModifierConfig): DbxFirebaseStorageFileUploadFileModifier {
  const { compression, encoder, log } = config;
  const customLogger: Maybe<DbxFirebaseStorageFileImageCompressionLogger> = typeof log === 'function' ? log : undefined;
  const consoleLoggingEnabled = log === true;

  return async (file) => {
    const result = await compressImageFile(file, compression, encoder ?? undefined);

    if (customLogger != null) {
      customLogger(file, result);
    } else if (consoleLoggingEnabled && result.compression !== 'unchanged') {
      console.info('[dbxFirebaseStorageFileImageCompressionFileModifier] compressed image', {
        name: file.name,
        inputType: file.type,
        outputType: result.mimeType,
        status: result.compression,
        originalSize: file.size,
        finalSize: result.file.size,
        originalDimensions: result.originalDimensions,
        finalDimensions: result.finalDimensions
      });
    }

    return result.file;
  };
}
