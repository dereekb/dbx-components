import { JPEG_MIME_TYPE, JPEG_MIME_TYPES, PNG_MIME_TYPE, type FileSize, type Maybe, type MimeTypeWithoutParameters } from '@dereekb/util';

/**
 * Describes whether an image file went through client-side compression.
 *
 * - `unchanged` — the original file is returned as-is.
 * - `resized` — the image was downscaled but its MIME type was preserved.
 * - `converted` — the image's MIME type was converted (e.g. PNG → JPEG) without resizing.
 * - `resized_and_converted` — the image was both downscaled and converted.
 */
export type ImageCompressionStatus = 'unchanged' | 'resized' | 'converted' | 'resized_and_converted';

/**
 * Configures client-side image compression for an image `File`.
 */
export interface DbxImageCompressionConfig {
  /**
   * Maximum allowed value for the larger image dimension in pixels. Images larger than this are scaled down so neither width nor height exceeds the limit, preserving aspect ratio. `null`/undefined disables resizing.
   */
  readonly maxDimension?: Maybe<number>;
  /**
   * Convert PNG inputs to JPEG. Defaults to `false`. JPEGs that need resizing are always re-encoded as JPEG.
   */
  readonly convertPngToJpeg?: Maybe<boolean>;
  /**
   * JPEG encode quality in [0,1]. Defaults to `0.85`. Used for PNG→JPEG conversion and for resized JPEG re-encoding.
   */
  readonly jpegQuality?: Maybe<number>;
  /**
   * Skip compression when the file is already smaller than this many bytes. `null`/undefined applies no minimum.
   */
  readonly minSizeBytes?: Maybe<FileSize>;
}

/**
 * Default JPEG quality used when re-encoding images during compression.
 */
export const DEFAULT_IMAGE_JPEG_QUALITY = 0.85;

/**
 * Pixel dimensions captured from a decoded image.
 */
export interface CompressImageDimensions {
  readonly width: number;
  readonly height: number;
}

/**
 * Result of {@link compressImageFile}. Holds the (possibly unchanged) file alongside a status describing what happened.
 */
export interface CompressImageFileResult {
  /**
   * Final file. When `compression === 'unchanged'`, this is the same `File` reference passed in.
   */
  readonly file: File;
  /**
   * Final MIME type. May differ from the input file's type when conversion occurred.
   */
  readonly mimeType: MimeTypeWithoutParameters;
  /**
   * What happened to the file. `'unchanged'` when no compression was applied.
   */
  readonly compression: ImageCompressionStatus;
  /**
   * Dimensions of the source image, captured during decoding. Only set when the source was decoded (i.e. compression actually ran).
   */
  readonly originalDimensions?: Maybe<CompressImageDimensions>;
}

interface ImageEncodeTarget {
  readonly mimeType: MimeTypeWithoutParameters;
  readonly extension: string;
}

/**
 * Inputs supplied to an {@link ImageBitmapToBlobEncoder} when {@link compressImageFile} needs to emit a compressed image.
 */
export interface ImageBitmapToBlobEncoderInput {
  readonly bitmap: ImageBitmap;
  readonly targetWidth: number;
  readonly targetHeight: number;
  readonly mimeType: MimeTypeWithoutParameters;
  readonly quality: number;
}

/**
 * Strategy responsible for turning an {@link ImageBitmap} into a `Blob` of the requested MIME type and quality. The default implementation uses {@link OffscreenCanvas} (or a `HTMLCanvasElement` fallback) — tests can pass a stub to avoid touching real canvas APIs.
 */
export type ImageBitmapToBlobEncoder = (input: ImageBitmapToBlobEncoderInput) => Promise<Maybe<Blob>>;

const PNG_EXTENSION = '.png';
const JPG_EXTENSION = '.jpg';

function isJpegMime(mimeType: MimeTypeWithoutParameters): boolean {
  return JPEG_MIME_TYPES.includes(mimeType);
}

function decideEncodeTarget(sourceMimeType: MimeTypeWithoutParameters, convertPngToJpeg: boolean, needsResize: boolean): ImageEncodeTarget {
  let mimeType: MimeTypeWithoutParameters;
  let extension: string;

  if (isJpegMime(sourceMimeType)) {
    mimeType = JPEG_MIME_TYPE;
    extension = JPG_EXTENSION;
  } else if (sourceMimeType === PNG_MIME_TYPE) {
    if (convertPngToJpeg) {
      mimeType = JPEG_MIME_TYPE;
      extension = JPG_EXTENSION;
    } else if (needsResize) {
      mimeType = PNG_MIME_TYPE;
      extension = PNG_EXTENSION;
    } else {
      // No work needed at all.
      mimeType = PNG_MIME_TYPE;
      extension = PNG_EXTENSION;
    }
  } else {
    // Unsupported source — let caller short-circuit.
    mimeType = sourceMimeType;
    extension = '';
  }

  return { mimeType, extension };
}

function computeScale(width: number, height: number, maxDimension: Maybe<number>): number {
  let scale: number;

  if (maxDimension == null || maxDimension <= 0) {
    scale = 1;
  } else {
    const largest = Math.max(width, height);

    if (largest <= maxDimension) {
      scale = 1;
    } else {
      scale = maxDimension / largest;
    }
  }

  return scale;
}

/**
 * Default {@link ImageBitmapToBlobEncoder} that draws the bitmap onto an {@link OffscreenCanvas} (or `HTMLCanvasElement` fallback) and encodes to a blob via `convertToBlob` / `toBlob`.
 *
 * @param input - Bitmap and target dimensions to encode.
 * @returns A blob with the encoded image, or `null` if encoding failed.
 */
export const DEFAULT_IMAGE_BITMAP_TO_BLOB_ENCODER: ImageBitmapToBlobEncoder = async (input) => {
  const { bitmap, targetWidth, targetHeight, mimeType, quality } = input;
  let canvas: OffscreenCanvas | HTMLCanvasElement;

  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(targetWidth, targetHeight);
  } else {
    const htmlCanvas = document.createElement('canvas');
    htmlCanvas.width = targetWidth;
    htmlCanvas.height = targetHeight;
    canvas = htmlCanvas;
  }

  const ctx = (canvas as OffscreenCanvas).getContext('2d') as Maybe<CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D>;

  if (!ctx) {
    throw new Error('Failed to acquire 2D canvas context for image compression.');
  }

  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

  let blob: Maybe<Blob>;

  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    blob = await canvas.convertToBlob({ type: mimeType, quality });
  } else {
    blob = await new Promise<Maybe<Blob>>((resolve) => {
      (canvas as HTMLCanvasElement).toBlob((b) => resolve(b), mimeType, quality);
    });
  }

  return blob;
};

function rewriteFileName(originalName: string, targetExtension: string): string {
  let result: string;

  if (targetExtension === '') {
    result = originalName;
  } else {
    const lastDot = originalName.lastIndexOf('.');
    const base = lastDot >= 0 ? originalName.slice(0, lastDot) : originalName;
    result = `${base}${targetExtension}`;
  }

  return result;
}

function determineStatus(resized: boolean, converted: boolean): ImageCompressionStatus {
  let status: ImageCompressionStatus;

  if (resized && converted) {
    status = 'resized_and_converted';
  } else if (resized) {
    status = 'resized';
  } else if (converted) {
    status = 'converted';
  } else {
    status = 'unchanged';
  }

  return status;
}

/**
 * Compresses an image `File` according to the supplied {@link DbxImageCompressionConfig}.
 *
 * Behavior:
 * - When the file is not a PNG/JPEG, or the config disables every compression path, returns the file unchanged.
 * - When the file fits inside `maxDimension` and no PNG→JPEG conversion is required, returns the file unchanged.
 * - Otherwise decodes via `createImageBitmap`, draws onto an {@link OffscreenCanvas} (or HTMLCanvasElement fallback), encodes the result using {@link DEFAULT_IMAGE_JPEG_QUALITY} or the configured `jpegQuality`, and wraps the blob into a new `File` with rewritten extension.
 * - Safety: if the encoded output is larger than the original, returns the original (compression is reported as `'unchanged'`).
 *
 * @param file - Source image file.
 * @param config - Compression configuration.
 * @param encoder - Optional injectable encoder used by tests to bypass real canvas APIs. Defaults to {@link DEFAULT_IMAGE_BITMAP_TO_BLOB_ENCODER}.
 * @returns Result describing the final file plus the {@link ImageCompressionStatus} for it.
 */
export async function compressImageFile(file: File, config: Maybe<DbxImageCompressionConfig>, encoder: ImageBitmapToBlobEncoder = DEFAULT_IMAGE_BITMAP_TO_BLOB_ENCODER): Promise<CompressImageFileResult> {
  const mimeType = (file.type ?? '').toLowerCase();
  const maxDimension = config?.maxDimension;
  const convertPngToJpeg = config?.convertPngToJpeg ?? false;
  const jpegQuality = config?.jpegQuality ?? DEFAULT_IMAGE_JPEG_QUALITY;
  const minSizeBytes: Maybe<FileSize> = config?.minSizeBytes;

  const isPng = mimeType === PNG_MIME_TYPE;
  const isJpeg = isJpegMime(mimeType);
  const isSupported = isPng || isJpeg;

  let result: CompressImageFileResult;

  if (!isSupported || config == null) {
    result = { file, mimeType: mimeType || file.type, compression: 'unchanged' };
  } else if ((maxDimension == null || maxDimension <= 0) && !(isPng && convertPngToJpeg)) {
    // No-op config for this file.
    result = { file, mimeType, compression: 'unchanged' };
  } else if (minSizeBytes != null && file.size <= minSizeBytes && !(isPng && convertPngToJpeg)) {
    // File is already small enough; skip when conversion is not required.
    result = { file, mimeType, compression: 'unchanged' };
  } else {
    let bitmap: Maybe<ImageBitmap> = null;

    try {
      bitmap = await createImageBitmap(file);
      const originalDimensions: CompressImageDimensions = { width: bitmap.width, height: bitmap.height };
      const scale = computeScale(bitmap.width, bitmap.height, maxDimension);
      const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
      const targetHeight = Math.max(1, Math.round(bitmap.height * scale));
      const needsResize = scale < 1;
      const needsConvert = isPng && convertPngToJpeg;

      if (!needsResize && !needsConvert) {
        result = { file, mimeType, compression: 'unchanged', originalDimensions };
      } else {
        const target = decideEncodeTarget(mimeType, convertPngToJpeg, needsResize);
        const blob = await encoder({ bitmap, targetWidth, targetHeight, mimeType: target.mimeType, quality: jpegQuality });

        if (blob == null || blob.size <= 0) {
          result = { file, mimeType, compression: 'unchanged', originalDimensions };
        } else if (blob.size >= file.size) {
          // Recompression grew the file; keep the original (common for tiny PNG → JPEG conversions).
          result = { file, mimeType, compression: 'unchanged', originalDimensions };
        } else {
          const nextName = needsConvert ? rewriteFileName(file.name, target.extension) : file.name;
          const nextFile = new File([blob], nextName, { type: target.mimeType, lastModified: file.lastModified });
          const status = determineStatus(needsResize, needsConvert);
          result = { file: nextFile, mimeType: target.mimeType, compression: status, originalDimensions };
        }
      }
    } finally {
      bitmap?.close?.();
    }
  }

  return result;
}
