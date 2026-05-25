import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ImageBitmapToBlobEncoder } from '@dereekb/dbx-web';
import { dbxFirebaseStorageFileImageCompressionFileModifier } from './storagefile.upload.image.compression.modifier';

interface FakeBitmap {
  readonly width: number;
  readonly height: number;
  close: () => void;
}

function fakeBitmap(width: number, height: number): FakeBitmap {
  return { width, height, close: vi.fn() };
}

function fakeFile(name: string, type: string, size: number): File {
  const bytes = new Uint8Array(size).fill(0xff);
  return new File([bytes], name, { type });
}

function fakeEncoder(blobSize: number, blobType = 'image/jpeg'): ImageBitmapToBlobEncoder {
  return async () => new Blob([new Uint8Array(blobSize).fill(0)], { type: blobType });
}

function installCreateImageBitmap(returnedBitmap: FakeBitmap): void {
  const mock = vi.fn(async () => returnedBitmap);
  (globalThis as { createImageBitmap?: unknown }).createImageBitmap = mock;
}

describe('dbxFirebaseStorageFileImageCompressionFileModifier()', () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;

  beforeEach(() => {
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = undefined;
  });

  afterEach(() => {
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = originalCreateImageBitmap;
  });

  it('returns a non-image file unchanged', async () => {
    const modifier = dbxFirebaseStorageFileImageCompressionFileModifier({ compression: { maxDimension: 1000, convertPngToJpeg: true } });
    const file = new File([new Uint8Array([1, 2, 3])], 'note.txt', { type: 'text/plain' });

    const result = await modifier(file);

    expect(result).toBe(file);
  });

  it('converts a PNG to JPEG when convertPngToJpeg is enabled', async () => {
    installCreateImageBitmap(fakeBitmap(500, 500));
    const modifier = dbxFirebaseStorageFileImageCompressionFileModifier({
      compression: { convertPngToJpeg: true },
      encoder: fakeEncoder(2000, 'image/jpeg')
    });
    const file = fakeFile('photo.png', 'image/png', 10_000);

    const result = await modifier(file);

    expect(result).not.toBe(file);
    expect(result.type).toBe('image/jpeg');
    expect(result.name.endsWith('.jpg')).toBe(true);
  });

  it('propagates a rejection from compressImageFile (fail-closed)', async () => {
    const modifier = dbxFirebaseStorageFileImageCompressionFileModifier({ compression: { maxDimension: 100 } });
    const file = fakeFile('image.png', 'image/png', 10_000);

    await expect(modifier(file)).rejects.toThrow();
  });

  describe('log option', () => {
    it('invokes a custom logger function for every outcome (including unchanged)', async () => {
      const logger = vi.fn();
      const modifier = dbxFirebaseStorageFileImageCompressionFileModifier({ compression: { maxDimension: 1000 }, log: logger });
      const file = fakeFile('note.txt', 'text/plain', 100);

      const result = await modifier(file);

      expect(result).toBe(file);
      expect(logger).toHaveBeenCalledTimes(1);
      const [loggedInput, loggedResult] = logger.mock.calls[0];
      expect(loggedInput).toBe(file);
      expect(loggedResult.compression).toBe('unchanged');
    });

    it('logs to console.info only when compression status is not unchanged (log=true)', async () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
      try {
        installCreateImageBitmap(fakeBitmap(2000, 2000));
        const modifier = dbxFirebaseStorageFileImageCompressionFileModifier({
          compression: { maxDimension: 1000 },
          encoder: fakeEncoder(2000, 'image/jpeg'),
          log: true
        });
        const file = fakeFile('big.jpg', 'image/jpeg', 10_000);

        await modifier(file);

        expect(infoSpy).toHaveBeenCalledTimes(1);
        const [, payload] = infoSpy.mock.calls[0];
        expect(payload).toMatchObject({
          status: 'resized',
          originalSize: 10_000,
          finalSize: 2000,
          originalDimensions: { width: 2000, height: 2000 },
          finalDimensions: { width: 1000, height: 1000 }
        });
      } finally {
        infoSpy.mockRestore();
      }
    });

    it('does not log to console.info when result is unchanged (log=true)', async () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
      try {
        const modifier = dbxFirebaseStorageFileImageCompressionFileModifier({ compression: { maxDimension: 1000 }, log: true });
        const file = fakeFile('note.txt', 'text/plain', 100);

        await modifier(file);

        expect(infoSpy).not.toHaveBeenCalled();
      } finally {
        infoSpy.mockRestore();
      }
    });

    it('does not log when log is unset', async () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
      try {
        installCreateImageBitmap(fakeBitmap(2000, 2000));
        const modifier = dbxFirebaseStorageFileImageCompressionFileModifier({
          compression: { maxDimension: 1000 },
          encoder: fakeEncoder(2000, 'image/jpeg')
        });
        const file = fakeFile('big.jpg', 'image/jpeg', 10_000);

        await modifier(file);

        expect(infoSpy).not.toHaveBeenCalled();
      } finally {
        infoSpy.mockRestore();
      }
    });
  });
});
