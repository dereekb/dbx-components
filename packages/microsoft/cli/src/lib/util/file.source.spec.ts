import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openMsGraphCliFileUploadSource } from './file.source';

describe('openMsGraphCliFileUploadSource()', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'msgraph-file-source-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports the size and reads exactly the requested ranges', async () => {
    const path = join(dir, 'data.bin');
    const content = new Uint8Array(1000).map((_, i) => i % 256);
    writeFileSync(path, content);

    const source = await openMsGraphCliFileUploadSource(path);

    try {
      expect(source.size).toBe(1000);
      expect(await source.readRange({ start: 0, end: 9 })).toEqual(content.slice(0, 10));
      expect(await source.readRange({ start: 990, end: 999 })).toEqual(content.slice(990, 1000));
    } finally {
      await source.close();
    }
  });

  it('returns only the bytes that exist when a range runs past the end of the file', async () => {
    const path = join(dir, 'short.bin');
    writeFileSync(path, new Uint8Array([1, 2, 3]));

    const source = await openMsGraphCliFileUploadSource(path);

    try {
      expect(await source.readRange({ start: 1, end: 9 })).toEqual(new Uint8Array([2, 3]));
    } finally {
      await source.close();
    }
  });

  it('refuses a directory', async () => {
    await expect(openMsGraphCliFileUploadSource(dir)).rejects.toThrow('is not a regular file');
  });
});
