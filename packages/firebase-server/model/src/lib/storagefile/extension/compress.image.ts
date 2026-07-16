import { type Maybe } from '@dereekb/util';
import sharp from 'sharp';

/**
 * Format the compressed image buffer is encoded as.
 */
export type CompressImageBufferToTargetSizeFormat = 'jpeg' | 'png' | 'webp';

export const DEFAULT_COMPRESS_IMAGE_MAX_DIMENSION = 4096;
export const DEFAULT_COMPRESS_IMAGE_INITIAL_QUALITY = 85;
export const DEFAULT_COMPRESS_IMAGE_MIN_QUALITY = 50;
export const DEFAULT_COMPRESS_IMAGE_QUALITY_STEP = 10;
export const DEFAULT_COMPRESS_IMAGE_FORMAT: CompressImageBufferToTargetSizeFormat = 'jpeg';

/**
 * Number of channels in raw pixel data (1 = grayscale, 2 = grayscale+alpha, 3 = RGB, 4 = RGBA/CMYK).
 */
export type CompressImageRawPixelChannels = 1 | 2 | 3 | 4;

/**
 * Describes raw, uncompressed pixel data passed as the input buffer to
 * {@link compressImageBufferToTargetSize} (interleaved, 8 bits per channel).
 */
export interface CompressImageBufferRawPixelInput {
  /**
   * Width of the raw image in pixels.
   */
  readonly width: number;
  /**
   * Height of the raw image in pixels.
   */
  readonly height: number;
  /**
   * Number of channels in the raw pixel data.
   */
  readonly channels: CompressImageRawPixelChannels;
}

/**
 * Configuration for {@link compressImageBufferToTargetSize}.
 */
export interface CompressImageBufferToTargetSizeConfig {
  /**
   * Target maximum size in bytes for the output. Acts as a soft target — if the
   * smallest encoding still exceeds this, the best-effort result is returned with
   * `hitTarget: false`.
   */
  readonly targetSizeBytes: number;
  /**
   * Maximum dimension (longest side, in pixels) of the output image. Images larger
   * than this on either axis are scaled down preserving aspect ratio.
   *
   * Defaults to {@link DEFAULT_COMPRESS_IMAGE_MAX_DIMENSION}.
   */
  readonly maxDimension?: Maybe<number>;
  /**
   * Initial quality (1-100) to try when encoding. Stepped down by `qualityStep` until
   * the output fits `targetSizeBytes` or `minQuality` is reached. Ignored for PNG.
   *
   * Defaults to {@link DEFAULT_COMPRESS_IMAGE_INITIAL_QUALITY}.
   */
  readonly initialQuality?: Maybe<number>;
  /**
   * Minimum quality (1-100) the iterator will drop to. Defaults to {@link DEFAULT_COMPRESS_IMAGE_MIN_QUALITY}.
   */
  readonly minQuality?: Maybe<number>;
  /**
   * Quality decrement applied each iteration. Defaults to {@link DEFAULT_COMPRESS_IMAGE_QUALITY_STEP}.
   */
  readonly qualityStep?: Maybe<number>;
  /**
   * Output format. Defaults to {@link DEFAULT_COMPRESS_IMAGE_FORMAT}.
   */
  readonly format?: Maybe<CompressImageBufferToTargetSizeFormat>;
  /**
   * When provided, `input` is treated as raw uncompressed pixel data with these
   * dimensions instead of an encoded image. Raw input is always re-encoded to
   * `format` — the raw bytes are never returned as the "smaller original", so the
   * returned buffer is always a valid encoded image.
   */
  readonly rawPixelInput?: Maybe<CompressImageBufferRawPixelInput>;
}

/**
 * Result of {@link compressImageBufferToTargetSize}.
 */
export interface CompressImageBufferToTargetSizeResult {
  /**
   * Best-effort compressed image bytes. Falls back to the original input if no
   * encoding produced a smaller result.
   */
  readonly buffer: Buffer;
  readonly originalSizeBytes: number;
  readonly compressedSizeBytes: number;
  /**
   * Quality the returned buffer was encoded at. Zero for PNG (no quality knob) and
   * 100 when the original was returned unchanged.
   */
  readonly finalQuality: number;
  readonly finalWidth: number;
  readonly finalHeight: number;
  /**
   * Number of channels in the returned buffer (e.g. 1 = grayscale, 3 = RGB).
   */
  readonly finalChannels: number;
  /**
   * True if `compressedSizeBytes <= targetSizeBytes`.
   */
  readonly hitTarget: boolean;
}

/**
 * Compresses an image buffer toward a target byte size by resizing down to a max
 * dimension and iteratively lowering the encoder quality. Returns the best result
 * found; falls back to the original buffer if no encoding beat it.
 *
 * Throws on unreadable input — callers should catch errors and decide whether to
 * fall back to the original bytes.
 *
 * @param input - The image bytes to compress.
 * @param config - Target size and encoder parameters.
 * @returns The best-effort compressed result plus metadata about what was applied.
 *
 * @example
 * ```ts
 * const result = await compressImageBufferToTargetSize(buffer, {
 *   targetSizeBytes: 2 * 1024 * 1024,
 *   maxDimension: 2048
 * });
 * if (result.hitTarget) {
 *   await file.upload(result.buffer);
 * }
 * ```
 */
export async function compressImageBufferToTargetSize(input: Buffer, config: CompressImageBufferToTargetSizeConfig): Promise<CompressImageBufferToTargetSizeResult> {
  const { targetSizeBytes } = config;
  const maxDimension = config.maxDimension ?? DEFAULT_COMPRESS_IMAGE_MAX_DIMENSION;
  const initialQuality = config.initialQuality ?? DEFAULT_COMPRESS_IMAGE_INITIAL_QUALITY;
  const minQuality = config.minQuality ?? DEFAULT_COMPRESS_IMAGE_MIN_QUALITY;
  const qualityStep = config.qualityStep ?? DEFAULT_COMPRESS_IMAGE_QUALITY_STEP;
  const format = config.format ?? DEFAULT_COMPRESS_IMAGE_FORMAT;
  const rawPixelInput = config.rawPixelInput ?? undefined;

  const inputMetadata = rawPixelInput == null ? await sharp(input).metadata() : undefined;
  const originalWidth = rawPixelInput?.width ?? inputMetadata?.width ?? 0;
  const originalHeight = rawPixelInput?.height ?? inputMetadata?.height ?? 0;
  const originalSizeBytes = input.byteLength;

  const longestSide = Math.max(originalWidth, originalHeight);
  const resizeNeeded = longestSide > maxDimension && longestSide > 0;
  const scale = resizeNeeded ? maxDimension / longestSide : 1;
  const workingWidth = Math.max(1, Math.round(originalWidth * scale));
  const workingHeight = Math.max(1, Math.round(originalHeight * scale));

  let bestBuffer: Buffer = input;
  // raw input must always be re-encoded, so no encoding is compared against the raw byte size
  let bestSize = rawPixelInput == null ? originalSizeBytes : Number.MAX_SAFE_INTEGER;
  let bestQuality = 100;
  let bestWidth = originalWidth;
  let bestHeight = originalHeight;
  let hitTarget = rawPixelInput == null && bestSize <= targetSizeBytes && !resizeNeeded;

  if (!hitTarget) {
    const qualities = qualityIterationSteps({ format, initialQuality, minQuality, qualityStep });

    for (const quality of qualities) {
      const encoded = await encodeImage({ input, format, quality, resizeNeeded, workingWidth, workingHeight, rawPixelInput });

      if (encoded.byteLength < bestSize) {
        bestBuffer = encoded;
        bestSize = encoded.byteLength;
        bestQuality = quality;
        bestWidth = workingWidth;
        bestHeight = workingHeight;
      }

      if (bestSize <= targetSizeBytes) {
        hitTarget = true;
        break;
      }
    }
  }

  let finalChannels: number;

  if (bestBuffer === input) {
    finalChannels = rawPixelInput?.channels ?? inputMetadata?.channels ?? 0;
  } else {
    finalChannels = (await sharp(bestBuffer).metadata()).channels ?? 0;
  }

  const result: CompressImageBufferToTargetSizeResult = {
    buffer: bestBuffer,
    originalSizeBytes,
    compressedSizeBytes: bestBuffer.byteLength,
    finalQuality: bestQuality,
    finalWidth: bestWidth,
    finalHeight: bestHeight,
    finalChannels,
    hitTarget
  };
  return result;
}

interface QualityIterationStepsInput {
  readonly format: CompressImageBufferToTargetSizeFormat;
  readonly initialQuality: number;
  readonly minQuality: number;
  readonly qualityStep: number;
}

function qualityIterationSteps(input: QualityIterationStepsInput): number[] {
  const { format, initialQuality, minQuality, qualityStep } = input;
  const steps: number[] = [];

  // PNG has no quality knob; a single pass at 0 (sentinel) applies any requested resize.
  if (format === 'png') {
    steps.push(0);
  } else {
    for (let quality = initialQuality; quality >= minQuality; quality -= qualityStep) {
      steps.push(quality);
    }
  }

  return steps;
}

interface EncodeImageInput {
  readonly input: Buffer;
  readonly format: CompressImageBufferToTargetSizeFormat;
  readonly quality: number;
  readonly resizeNeeded: boolean;
  readonly workingWidth: number;
  readonly workingHeight: number;
  readonly rawPixelInput?: Maybe<CompressImageBufferRawPixelInput>;
}

async function encodeImage(input: EncodeImageInput): Promise<Buffer> {
  const pipeline = input.rawPixelInput == null ? sharp(input.input) : sharp(input.input, { raw: input.rawPixelInput });

  // grayscale raw input stays grayscale — sharp otherwise converts raw pipelines to sRGB on encode
  if (input.rawPixelInput?.channels === 1) {
    pipeline.toColourspace('b-w');
  }

  if (input.resizeNeeded) {
    pipeline.resize({
      width: input.workingWidth,
      height: input.workingHeight,
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  let result: Buffer;

  switch (input.format) {
    case 'jpeg':
      result = await pipeline.jpeg({ quality: input.quality, mozjpeg: true }).toBuffer();
      break;
    case 'webp':
      result = await pipeline.webp({ quality: input.quality }).toBuffer();
      break;
    case 'png':
      result = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      break;
  }

  return result;
}
