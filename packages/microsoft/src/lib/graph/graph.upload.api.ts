import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type MicrosoftGraphContext } from './graph.config';
import { type MicrosoftGraphRawResponse, microsoftGraphRequestRaw } from './graph.raw.api';

/**
 * One byte range of an upload session: `start` and `end` are inclusive, as `Content-Range` writes them.
 */
export interface MicrosoftGraphUploadChunkRange {
  readonly start: number;
  readonly end: number;
}

/**
 * Splits `total` bytes into consecutive ranges of at most `chunkSize` bytes, in upload order.
 *
 * @param total - The file size in bytes.
 * @param chunkSize - The most bytes per range.
 * @returns The ranges. Empty for an empty file.
 * @throws {Error} When `chunkSize` is not a positive integer.
 */
export function microsoftGraphUploadChunkRanges(total: number, chunkSize: number): MicrosoftGraphUploadChunkRange[] {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new Error(`Upload chunk size must be a positive integer, got ${chunkSize}.`);
  }

  const ranges: MicrosoftGraphUploadChunkRange[] = [];

  for (let start = 0; start < total; start += chunkSize) {
    ranges.push({ start, end: Math.min(start + chunkSize, total) - 1 });
  }

  return ranges;
}

/**
 * Formats a `Content-Range` header value for one range of an upload.
 *
 * @param range - The range.
 * @param total - The file size in bytes.
 * @returns The header value, e.g. `bytes 0-327679/1000000`.
 */
export function microsoftGraphUploadContentRange(range: MicrosoftGraphUploadChunkRange, total: number): string {
  return `bytes ${range.start}-${range.end}/${total}`;
}

/**
 * Upload bytes read one range at a time, so a file never has to sit in memory whole. A file reader keeps an
 * upload to one chunk of memory, and lifts the 2 GiB ceiling of Node's `readFile`.
 */
export interface MicrosoftGraphUploadByteSource {
  /**
   * The total size in bytes.
   */
  readonly size: number;
  /**
   * Reads exactly the bytes of one range (`end` inclusive).
   */
  readonly readRange: (range: MicrosoftGraphUploadChunkRange) => Promise<Uint8Array>;
}

/**
 * The bytes to upload: in memory, or a {@link MicrosoftGraphUploadByteSource} read one range at a time.
 */
export type MicrosoftGraphUploadBytes = Uint8Array | MicrosoftGraphUploadByteSource;

/**
 * Returns the size of upload bytes, in memory or from a source.
 *
 * @param bytes - The bytes or source.
 * @returns The size in bytes.
 */
export function microsoftGraphUploadBytesSize(bytes: MicrosoftGraphUploadBytes): number {
  return bytes instanceof Uint8Array ? bytes.length : bytes.size;
}

/**
 * Reads one range of upload bytes: a view of in-memory bytes, or a read from the source.
 *
 * @param bytes - The bytes or source.
 * @param range - The range (`end` inclusive).
 * @returns The range's bytes.
 * @throws {Error} When a source returns a different number of bytes than the range holds.
 */
export async function readMicrosoftGraphUploadRange(bytes: MicrosoftGraphUploadBytes, range: MicrosoftGraphUploadChunkRange): Promise<Uint8Array> {
  const expected = range.end - range.start + 1;
  const chunk = bytes instanceof Uint8Array ? bytes.subarray(range.start, range.end + 1) : await bytes.readRange(range);

  if (chunk.length !== expected) {
    throw new Error(`Upload source returned ${chunk.length} bytes for range ${range.start}-${range.end}, expected ${expected}. Did the file change during the upload?`);
  }

  return chunk;
}

/**
 * The slowest upload rate the default chunk timeout allows for: 64 KiB/s (about 0.5 Mbit/s).
 */
export const MICROSOFT_GRAPH_UPLOAD_MIN_BYTES_PER_SECOND = 64 * 1024;

/**
 * Returns the default timeout of one upload PUT: the client's usual 30 seconds plus the time `byteCount`
 * takes at {@link MICROSOFT_GRAPH_UPLOAD_MIN_BYTES_PER_SECOND}. A flat 30 seconds would fail a 10 MiB chunk
 * on any link slower than about 2.8 Mbit/s.
 *
 * @param byteCount - The bytes the PUT carries.
 * @returns The timeout in milliseconds.
 */
export function microsoftGraphUploadTimeout(byteCount: number): Milliseconds {
  return 30 * 1000 + Math.ceil((byteCount / MICROSOFT_GRAPH_UPLOAD_MIN_BYTES_PER_SECOND) * 1000);
}

export interface MicrosoftGraphUploadSessionPutInput {
  /**
   * The session's pre-authenticated `uploadUrl`.
   */
  readonly uploadUrl: string;
  /**
   * The bytes, or a source each chunk is read from just before its PUT.
   */
  readonly bytes: MicrosoftGraphUploadBytes;
  /**
   * The most bytes per PUT. An Outlook attachment session takes up to 4 MB per request; a drive item session
   * takes multiples of 320 KiB under 60 MiB.
   */
  readonly chunkSize: number;
  /**
   * Overrides the client's timeout per chunk PUT. Defaults to the client's timeout.
   */
  readonly timeout?: Maybe<Milliseconds>;
  /**
   * Called after each chunk is accepted, with the bytes sent so far.
   */
  readonly onProgress?: Maybe<(sent: number, total: number) => void>;
}

/**
 * Uploads a file's bytes to an upload session, one chunk PUT after another, in order. A
 * {@link MicrosoftGraphUploadByteSource} is read one chunk at a time, just before that chunk's PUT, so memory
 * holds one chunk whatever the file size.
 *
 * Every chunk PUT goes through the raw path **without** an `Authorization` header: the session URL is
 * pre-authenticated and a bearer token on it is rejected.
 *
 * @param context - Fetch function each chunk is sent with. Its access token is never used.
 * @returns Function that uploads every chunk and resolves the last chunk's raw response (the created item,
 *   or an empty 201 with a `Location` for an Outlook attachment).
 * @throws {MicrosoftGraphError} When a chunk PUT fails.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession#upload-bytes-to-the-upload-session
 * @see https://learn.microsoft.com/en-us/graph/outlook-large-attachments
 */
export function microsoftGraphUploadSessionPut(context: MicrosoftGraphContext): (input: MicrosoftGraphUploadSessionPutInput) => Promise<Maybe<MicrosoftGraphRawResponse>> {
  const requestRaw = microsoftGraphRequestRaw(context);

  return async (input) => {
    const total = microsoftGraphUploadBytesSize(input.bytes);
    let last: Maybe<MicrosoftGraphRawResponse>;

    for (const range of microsoftGraphUploadChunkRanges(total, input.chunkSize)) {
      last = await requestRaw({
        method: 'PUT',
        path: input.uploadUrl,
        body: await readMicrosoftGraphUploadRange(input.bytes, range),
        headers: { 'Content-Range': microsoftGraphUploadContentRange(range, total) },
        authorize: false,
        timeout: input.timeout
      });

      input.onProgress?.(range.end + 1, total);
    }

    return last;
  };
}
