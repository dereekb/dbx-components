import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { compressImageBufferToTargetSize } from './compress.image';

/**
 * Creates a JPEG with random-noise content. Random noise is high-entropy so JPEG
 * cannot compress it well — useful for forcing the compressor to iterate through
 * quality steps.
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

  it('resizes down when the input exceeds maxDimension', async () => {
    const input = await makeNoiseJpeg(4000, 3000, 95);

    const result = await compressImageBufferToTargetSize(input, {
      targetSizeBytes: 500 * 1024,
      maxDimension: 1024
    });

    expect(Math.max(result.finalWidth, result.finalHeight)).toBeLessThanOrEqual(1024);
    expect(result.compressedSizeBytes).toBeLessThan(result.originalSizeBytes);
  });

  it('lowers quality when resize alone is not enough to hit the target', async () => {
    const input = await makeNoiseJpeg(2000, 2000, 100);

    const result = await compressImageBufferToTargetSize(input, {
      targetSizeBytes: 200 * 1024,
      maxDimension: 2000,
      initialQuality: 85,
      minQuality: 50,
      qualityStep: 10
    });

    expect(result.compressedSizeBytes).toBeLessThan(result.originalSizeBytes);
    expect(result.finalQuality).toBeLessThanOrEqual(85);
    expect(result.finalQuality).toBeGreaterThanOrEqual(50);
  });

  it('returns hitTarget=false when even minQuality cannot hit the target', async () => {
    const input = await makeNoiseJpeg(3000, 3000, 100);

    const result = await compressImageBufferToTargetSize(input, {
      targetSizeBytes: 10 * 1024, // unreachably small
      maxDimension: 3000,
      initialQuality: 60,
      minQuality: 50,
      qualityStep: 10
    });

    expect(result.hitTarget).toBe(false);
    expect(result.compressedSizeBytes).toBeLessThan(result.originalSizeBytes);
  });

  it('encodes PNG output when format is set to png', async () => {
    const input = await makeNoiseJpeg(1500, 1500, 90);

    const result = await compressImageBufferToTargetSize(input, {
      targetSizeBytes: 5 * 1024 * 1024,
      maxDimension: 512,
      format: 'png'
    });

    expect(result.finalWidth).toBeLessThanOrEqual(512);

    const outMetadata = await sharp(result.buffer).metadata();
    expect(outMetadata.format).toBe('png');
  });
});
