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

  const metadata = await sharp(input).metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;
  const originalSizeBytes = input.byteLength;

  const longestSide = Math.max(originalWidth, originalHeight);
  const resizeNeeded = longestSide > maxDimension && longestSide > 0;
  const scale = resizeNeeded ? maxDimension / longestSide : 1;
  const workingWidth = Math.max(1, Math.round(originalWidth * scale));
  const workingHeight = Math.max(1, Math.round(originalHeight * scale));

  let bestBuffer: Buffer = input;
  let bestSize = originalSizeBytes;
  let bestQuality = 100;
  let bestWidth = originalWidth;
  let bestHeight = originalHeight;
  let hitTarget = bestSize <= targetSizeBytes && !resizeNeeded;

  if (!hitTarget) {
    const qualities = qualityIterationSteps({ format, initialQuality, minQuality, qualityStep });

    for (const quality of qualities) {
      const encoded = await encodeImage({ input, format, quality, resizeNeeded, workingWidth, workingHeight });

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

  const result: CompressImageBufferToTargetSizeResult = {
    buffer: bestBuffer,
    originalSizeBytes,
    compressedSizeBytes: bestSize,
    finalQuality: bestQuality,
    finalWidth: bestWidth,
    finalHeight: bestHeight,
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
}

async function encodeImage(input: EncodeImageInput): Promise<Buffer> {
  const pipeline = sharp(input.input);

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
