import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstValueFrom, skip } from 'rxjs';
import { type ImageBitmapToBlobEncoder } from '@dereekb/dbx-web';
import { DbxFirebaseStorageFileUploadStore, type DbxFirebaseStorageFileUploadFileModifier } from './storagefile.upload.store';
import { dbxFirebaseStorageFileImageCompressionFileModifier } from '../container/storagefile.upload.image.compression.modifier';

function makeFile(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'text/plain' });
}

function makeStore(): DbxFirebaseStorageFileUploadStore {
  return new DbxFirebaseStorageFileUploadStore();
}

interface FakeBitmap {
  readonly width: number;
  readonly height: number;
  close: () => void;
}

function fakeBitmap(width: number, height: number): FakeBitmap {
  return { width, height, close: vi.fn() };
}

function fakeImageFile(name: string, type: string, size: number): File {
  const bytes = new Uint8Array(size).fill(0xff);
  return new File([bytes], name, { type });
}

function fakeEncoder(blobSize: number, blobType = 'image/jpeg'): ImageBitmapToBlobEncoder {
  return async () => new Blob([new Uint8Array(blobSize).fill(0)], { type: blobType });
}

function installCreateImageBitmap(returnedBitmap: FakeBitmap): void {
  const mock = vi.fn(async () => returnedBitmap as unknown as ImageBitmap);
  (globalThis as { createImageBitmap?: typeof createImageBitmap }).createImageBitmap = mock as unknown as typeof createImageBitmap;
}

describe('DbxFirebaseStorageFileUploadStore.files$', () => {
  it('emits the raw array unchanged when fileModifier is unset', async () => {
    const store = makeStore();
    const a = makeFile('a.txt');
    const b = makeFile('b.txt');

    store.setRawFiles([a, b]);

    const files = await firstValueFrom(store.files$);
    expect(files).toEqual([a, b]);
  });

  it('applies a sync modifier to each file (one call per file)', async () => {
    const store = makeStore();
    const a = makeFile('a.txt');
    const b = makeFile('b.txt');
    const transformed = new Map<File, File>([
      [a, makeFile('a-mod.txt')],
      [b, makeFile('b-mod.txt')]
    ]);
    const modifier = vi.fn<DbxFirebaseStorageFileUploadFileModifier>((file: File) => transformed.get(file) ?? file);

    store.setFileModifier(modifier);
    store.setRawFiles([a, b]);

    const files = await firstValueFrom(store.files$);
    expect(modifier).toHaveBeenCalledTimes(2);
    expect(files.map((f) => f.name)).toEqual(['a-mod.txt', 'b-mod.txt']);
  });

  it('awaits an async modifier and emits the resolved batch', async () => {
    const store = makeStore();
    const a = makeFile('a.txt');
    const modifier: DbxFirebaseStorageFileUploadFileModifier = async (file) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new File([await file.arrayBuffer()], `async-${file.name}`, { type: file.type });
    };

    store.setFileModifier(modifier);
    store.setRawFiles([a]);

    const files = await firstValueFrom(store.files$);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('async-a.txt');
  });

  it('re-emits files$ when the modifier is swapped, applying the new transform to the existing rawFiles', async () => {
    const store = makeStore();
    const a = makeFile('a.txt');
    const modA: DbxFirebaseStorageFileUploadFileModifier = (file) => new File([], `first-${file.name}`, { type: file.type });
    const modB: DbxFirebaseStorageFileUploadFileModifier = (file) => new File([], `second-${file.name}`, { type: file.type });

    store.setFileModifier(modA);
    store.setRawFiles([a]);

    const initial = await firstValueFrom(store.files$);
    expect(initial[0].name).toBe('first-a.txt');

    const nextEmission = firstValueFrom(store.files$.pipe(skip(1)));
    store.setFileModifier(modB);

    const next = await nextEmission;
    expect(next[0].name).toBe('second-a.txt');
  });

  it('emits [] when rawFiles is []', async () => {
    const store = makeStore();
    store.setRawFiles([]);

    const files = await firstValueFrom(store.files$);
    expect(files).toEqual([]);
  });

  it('does not emit while rawFiles is null/undefined', async () => {
    const store = makeStore();
    let emitted = false;
    const sub = store.files$.subscribe(() => {
      emitted = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(emitted).toBe(false);
    sub.unsubscribe();
  });

  it('setRawFiles is a no-op while isUploadHandlerWorking is true', async () => {
    const store = makeStore();
    const a = makeFile('a.txt');
    const b = makeFile('b.txt');

    store.setRawFiles([a]);
    store.setIsUploadHandlerWorking(true);
    store.setRawFiles([b]);

    const files = await firstValueFrom(store.files$);
    expect(files).toEqual([a]);
  });

  it('propagates a rejecting modifier as an error on files$ (fail-closed)', async () => {
    const store = makeStore();
    const a = makeFile('a.txt');
    const failure = new Error('boom');
    const modifier: DbxFirebaseStorageFileUploadFileModifier = async () => {
      throw failure;
    };

    store.setFileModifier(modifier);
    store.setRawFiles([a]);

    await expect(firstValueFrom(store.files$)).rejects.toBe(failure);
  });

  describe('with the image compression modifier factory', () => {
    const originalCreateImageBitmap = globalThis.createImageBitmap;

    beforeEach(() => {
      (globalThis as { createImageBitmap?: unknown }).createImageBitmap = undefined;
    });

    afterEach(() => {
      (globalThis as { createImageBitmap?: unknown }).createImageBitmap = originalCreateImageBitmap;
    });

    it('accepts the compression modifier factory', async () => {
      installCreateImageBitmap(fakeBitmap(500, 500));
      const encoder = fakeEncoder(2000, 'image/jpeg');
      const modifier = dbxFirebaseStorageFileImageCompressionFileModifier({
        compression: { maxDimension: 100, convertPngToJpeg: true },
        encoder
      });

      const store = makeStore();
      const pngFile = fakeImageFile('photo.png', 'image/png', 10_000);

      store.setFileModifier(modifier);
      store.setRawFiles([pngFile]);

      const files = await firstValueFrom(store.files$);
      expect(files).toHaveLength(1);
      expect(files[0].size).toBe(2000);
      expect(files[0].type).toBe('image/jpeg');
    });
  });
});
