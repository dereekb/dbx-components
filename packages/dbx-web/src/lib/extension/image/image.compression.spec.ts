import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compressImageFile, type ImageBitmapToBlobEncoder } from './image.compression';

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

type CreateImageBitmapMock = ReturnType<typeof vi.fn>;

function installCreateImageBitmap(returnedBitmap: FakeBitmap): CreateImageBitmapMock {
  const mock = vi.fn(async () => returnedBitmap as unknown as ImageBitmap);
  (globalThis as { createImageBitmap?: typeof createImageBitmap }).createImageBitmap = mock as unknown as typeof createImageBitmap;
  return mock;
}

describe('compressImageFile()', () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;

  beforeEach(() => {
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = undefined;
  });

  afterEach(() => {
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = originalCreateImageBitmap;
  });

  it('returns the file unchanged when config is null', async () => {
    const file = fakeFile('a.jpg', 'image/jpeg', 1000);
    const result = await compressImageFile(file, null);
    expect(result.file).toBe(file);
    expect(result.compression).toBe('unchanged');
  });

  it('returns the file unchanged when source is not a supported image', async () => {
    const file = fakeFile('a.gif', 'image/gif', 1000);
    const result = await compressImageFile(file, { maxDimension: 100 });
    expect(result.file).toBe(file);
    expect(result.compression).toBe('unchanged');
  });

  it('returns the file unchanged when maxDimension is unset and PNG→JPEG conversion is off', async () => {
    const file = fakeFile('a.png', 'image/png', 1000);
    const result = await compressImageFile(file, { convertPngToJpeg: false });
    expect(result.file).toBe(file);
    expect(result.compression).toBe('unchanged');
  });

  it('resizes a large JPEG and reports compression=resized', async () => {
    installCreateImageBitmap(fakeBitmap(4000, 3000));
    const file = fakeFile('big.jpg', 'image/jpeg', 10_000);
    const result = await compressImageFile(file, { maxDimension: 1000 }, fakeEncoder(2000));

    expect(result.compression).toBe('resized');
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.originalDimensions).toEqual({ width: 4000, height: 3000 });
    expect(result.finalDimensions).toEqual({ width: 1000, height: 750 });
    expect(result.file).not.toBe(file);
    expect(result.file.size).toBe(2000);
    expect(result.file.name).toBe('big.jpg');
  });

  it('converts a PNG to JPEG with rewritten extension when convertPngToJpeg=true', async () => {
    installCreateImageBitmap(fakeBitmap(500, 500));
    const file = fakeFile('photo.png', 'image/png', 10_000);
    const result = await compressImageFile(file, { convertPngToJpeg: true }, fakeEncoder(5000, 'image/jpeg'));

    expect(result.compression).toBe('converted');
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.file.name).toBe('photo.jpg');
    expect(result.file.type).toBe('image/jpeg');
  });

  it('reports resized_and_converted when both resize and PNG→JPEG conversion run', async () => {
    installCreateImageBitmap(fakeBitmap(4000, 3000));
    const file = fakeFile('photo.png', 'image/png', 10_000);
    const result = await compressImageFile(file, { maxDimension: 1000, convertPngToJpeg: true }, fakeEncoder(5000, 'image/jpeg'));

    expect(result.compression).toBe('resized_and_converted');
    expect(result.file.name).toBe('photo.jpg');
  });

  it('falls back to the original file when re-encoding produces a larger blob', async () => {
    installCreateImageBitmap(fakeBitmap(50, 50));
    const file = fakeFile('tiny.png', 'image/png', 500);
    const result = await compressImageFile(file, { convertPngToJpeg: true }, fakeEncoder(2000, 'image/jpeg'));

    expect(result.compression).toBe('unchanged');
    expect(result.file).toBe(file);
    expect(result.originalDimensions).toEqual({ width: 50, height: 50 });
  });

  it('honors minSizeBytes by skipping work for already-small files when no conversion is needed', async () => {
    const file = fakeFile('small.jpg', 'image/jpeg', 100);
    const result = await compressImageFile(file, { maxDimension: 1000, minSizeBytes: 500 });
    expect(result.file).toBe(file);
    expect(result.compression).toBe('unchanged');
  });

  it('does not skip when conversion is required even if file is under minSizeBytes', async () => {
    installCreateImageBitmap(fakeBitmap(50, 50));
    const file = fakeFile('small.png', 'image/png', 100);
    const result = await compressImageFile(file, { convertPngToJpeg: true, minSizeBytes: 500 }, fakeEncoder(50, 'image/jpeg'));
    expect(result.compression).toBe('converted');
  });
});
