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

export interface MicrosoftGraphUploadSessionPutInput {
  /**
   * The session's pre-authenticated `uploadUrl`.
   */
  readonly uploadUrl: string;
  readonly bytes: Uint8Array;
  /**
   * The most bytes per PUT. An Outlook attachment session takes up to 4 MB per request; a drive item session
   * takes multiples of 320 KiB under 60 MiB.
   */
  readonly chunkSize: number;
  /**
   * Overrides the client's timeout per chunk PUT.
   */
  readonly timeout?: Maybe<Milliseconds>;
  /**
   * Called after each chunk is accepted, with the bytes sent so far.
   */
  readonly onProgress?: Maybe<(sent: number, total: number) => void>;
}

/**
 * Uploads a file's bytes to an upload session, one chunk PUT after another, in order.
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
    const total = input.bytes.length;
    let last: Maybe<MicrosoftGraphRawResponse>;

    for (const range of microsoftGraphUploadChunkRanges(total, input.chunkSize)) {
      last = await requestRaw({
        method: 'PUT',
        path: input.uploadUrl,
        body: input.bytes.subarray(range.start, range.end + 1),
        headers: { 'Content-Range': microsoftGraphUploadContentRange(range, total) },
        authorize: false,
        timeout: input.timeout
      });

      input.onProgress?.(range.end + 1, total);
    }

    return last;
  };
}
