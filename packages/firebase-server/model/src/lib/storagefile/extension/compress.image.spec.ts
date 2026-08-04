import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { compressImageBufferToTargetSize } from './compress.image';

/**
 * Image encoding is CPU-bound, and a constrained CI container runs `mozjpeg` several times slower
 * than a dev machine. The fixtures below are sized so a run costs well under a second locally, so
 * this is headroom against a slow runner rather than the expected budget.
 */
const ENCODING_TEST_TIMEOUT_MS = 30 * 1000;

/**
 * Creates a JPEG with random-noise content. Random noise is high-entropy so JPEG
 * cannot compress it well — useful for forcing the compressor to iterate through
 * quality steps.
 *
 * Dimensions are deliberately kept small: every quality step re-encodes the whole image, so cost
 * scales with pixel count while none of the assertions depend on the image being large.
 */
async function makeNoiseJpeg(width: number, height: number, quality = 100): Promise<Buffer> {
  const channels = 3;
  const buffer = Buffer.alloc(width * height * channels);
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  return sharp(buffer, { raw: { width, height, channels } }).jpeg({ quality }).toBuffer();
}

async function makeSolidColorPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 }
    }
  })
    .png()
    .toBuffer();
}

describe('compressImageBufferToTargetSize()', () => {
  it('returns the original buffer when the input is already under the target', async () => {
    const input = await makeSolidColorPng(200, 200);

    const result = await compressImageBufferToTargetSize(input, {
      targetSizeBytes: 10 * 1024 * 1024
    });

    expect(result.hitTarget).toBe(true);
    expect(result.compressedSizeBytes).toBe(input.byteLength);
    expect(result.buffer).toBe(input);
    expect(result.originalSizeBytes).toBe(input.byteLength);
  });

  it(
    'resizes down when the input exceeds maxDimension',
    async () => {
      const input = await makeNoiseJpeg(1600, 1200, 95);

      const result = await compressImageBufferToTargetSize(input, {
        targetSizeBytes: 500 * 1024,
        maxDimension: 1024
      });

      expect(Math.max(result.finalWidth, result.finalHeight)).toBeLessThanOrEqual(1024);
      expect(result.compressedSizeBytes).toBeLessThan(result.originalSizeBytes);
    },
    ENCODING_TEST_TIMEOUT_MS
  );

  it(
    'lowers quality when resize alone is not enough to hit the target',
    async () => {
      // maxDimension matches the input, so resizing contributes nothing and quality has to do the work
      const input = await makeNoiseJpeg(600, 600, 100);

      const result = await compressImageBufferToTargetSize(input, {
        // sits between what this fixture encodes to at the initial quality and at minQuality, so the
        // target is only reachable after stepping down — but is still reachable before the floor
        targetSizeBytes: 140 * 1024,
        maxDimension: 600,
        initialQuality: 85,
        minQuality: 50,
        qualityStep: 10
      });

      expect(result.compressedSizeBytes).toBeLessThan(result.originalSizeBytes);
      expect(result.hitTarget).toBe(true);
      expect(result.finalQuality).toBeLessThan(85);
      expect(result.finalQuality).toBeGreaterThanOrEqual(50);
    },
    ENCODING_TEST_TIMEOUT_MS
  );

  it(
    'returns hitTarget=false when even minQuality cannot hit the target',
    async () => {
      const input = await makeNoiseJpeg(600, 600, 100);

      const result = await compressImageBufferToTargetSize(input, {
        targetSizeBytes: 10 * 1024, // unreachably small
        maxDimension: 600,
        initialQuality: 60,
        minQuality: 50,
        qualityStep: 10
      });

      expect(result.hitTarget).toBe(false);
      expect(result.compressedSizeBytes).toBeLessThan(result.originalSizeBytes);
    },
    ENCODING_TEST_TIMEOUT_MS
  );

  it(
    'encodes PNG output when format is set to png',
    async () => {
      const input = await makeNoiseJpeg(800, 800, 90);

      const result = await compressImageBufferToTargetSize(input, {
        targetSizeBytes: 5 * 1024 * 1024,
        // PNG cannot compress noise, so this has to stay small enough that the encoded PNG comes out
        // smaller than the JPEG input — otherwise the original wins and no resize is reported
        maxDimension: 256,
        format: 'png'
      });

      expect(result.finalWidth).toBeLessThanOrEqual(256);

      const outMetadata = await sharp(result.buffer).metadata();
      expect(outMetadata.format).toBe('png');
    },
    ENCODING_TEST_TIMEOUT_MS
  );
});
