import { describe, expect, it } from 'vitest';
import { MICROSOFT_GRAPH_UPLOAD_MIN_BYTES_PER_SECOND, microsoftGraphUploadBytesSize, microsoftGraphUploadTimeout, readMicrosoftGraphUploadRange } from './graph.upload.api';

describe('upload bytes', () => {
  it('sizes and slices in-memory bytes and byte sources alike', async () => {
    const bytes = new Uint8Array([10, 11, 12, 13]);
    const source = { size: 4, readRange: async (range: { start: number; end: number }) => bytes.slice(range.start, range.end + 1) };

    expect(microsoftGraphUploadBytesSize(bytes)).toBe(4);
    expect(microsoftGraphUploadBytesSize(source)).toBe(4);
    expect(await readMicrosoftGraphUploadRange(bytes, { start: 1, end: 2 })).toEqual(new Uint8Array([11, 12]));
    expect(await readMicrosoftGraphUploadRange(source, { start: 1, end: 2 })).toEqual(new Uint8Array([11, 12]));
  });

  it('refuses a source that returns a short range, e.g. a file truncated mid-upload', async () => {
    const source = { size: 10, readRange: async () => new Uint8Array(3) };
    await expect(readMicrosoftGraphUploadRange(source, { start: 0, end: 9 })).rejects.toThrow('returned 3 bytes for range 0-9, expected 10');
  });
});

describe('microsoftGraphUploadTimeout()', () => {
  it('gives 30 seconds plus the time the bytes take at the minimum rate', () => {
    expect(microsoftGraphUploadTimeout(0)).toBe(30_000);
    expect(microsoftGraphUploadTimeout(MICROSOFT_GRAPH_UPLOAD_MIN_BYTES_PER_SECOND)).toBe(31_000);
    // a default 10 MiB drive chunk: 160 s at 64 KiB/s, plus 30 s
    expect(microsoftGraphUploadTimeout(10 * 1024 * 1024)).toBe(190_000);
  });
});
