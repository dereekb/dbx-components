import { type Maybe, type Milliseconds } from '@dereekb/util';
import { createWriteStream } from 'node:fs';
import { rename, rm, utimes } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { type ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { CLI_PRIVATE_FILE_MODE } from './download.fs';

/**
 * How long a streamed download may go without receiving a byte, once the response has arrived, before it is
 * aborted: 60 seconds.
 */
export const DEFAULT_CLI_DOWNLOAD_IDLE_TIMEOUT: Milliseconds = 60 * 1000;

/**
 * The suffix of the file a download is written to before it is renamed into place.
 */
export const CLI_DOWNLOAD_PARTIAL_SUFFIX = '.part';

/**
 * An opened download: the response body and what its headers declared.
 */
export interface CliDownloadSource {
  /**
   * The body. Null or undefined for an empty body.
   */
  readonly body: Maybe<ReadableStream<Uint8Array>>;
  /**
   * The declared length. Pass it only when it counts the bytes the body yields (not for a content-encoded
   * body), since a body that ends short of it is refused.
   */
  readonly contentLength?: Maybe<number>;
  readonly contentType?: Maybe<string>;
}

/**
 * Opens a download, e.g. sends the GET and resolves once the response headers arrive. It must honor the
 * signal: it fires when the caller cancels or the body stalls.
 */
export type CliDownloadSourceOpener = (signal: AbortSignal) => Promise<CliDownloadSource>;

/**
 * Configuration for {@link downloadCliFile}.
 */
export interface DownloadCliFileConfig {
  readonly open: CliDownloadSourceOpener;
  /**
   * The file to write. It only appears once the whole body has arrived. Its directory must exist.
   */
  readonly out: string;
  /**
   * Where the body is written while it arrives. Defaults to `<out>.part`. It must be on the same file system
   * as `out` (e.g. a staging folder inside the download directory), so the final rename is atomic.
   */
  readonly partialPath?: Maybe<string>;
  /**
   * Aborts when no byte arrives for this long. Defaults to {@link DEFAULT_CLI_DOWNLOAD_IDLE_TIMEOUT}. The
   * timer starts when `open` resolves, so the wait for the response headers is bounded by the transport's
   * own timeout, not this one. A slow but moving download is never cut off.
   */
  readonly idleTimeout?: Maybe<Milliseconds>;
  /**
   * Cancels the download, e.g. on Ctrl+C. The partial file is removed and {@link CliDownloadAbortedError} thrown.
   */
  readonly signal?: Maybe<AbortSignal>;
  /**
   * The file's mode. Defaults to {@link CLI_PRIVATE_FILE_MODE}.
   */
  readonly mode?: Maybe<number>;
  /**
   * Sets the file's access and modification times, e.g. to the remote item's last-modified time.
   */
  readonly mtime?: Maybe<Date>;
  /**
   * Called with the size of every chunk written.
   */
  readonly onChunk?: Maybe<(bytes: number) => void>;
}

/**
 * Result of {@link downloadCliFile}.
 */
export interface DownloadCliFileResult {
  readonly file: string;
  readonly bytes: number;
  readonly contentType?: string;
}

/**
 * Thrown by {@link downloadCliFile} when no bytes arrived for the idle timeout. The partial file has been
 * removed.
 */
export class CliDownloadStalledError extends Error {
  constructor(readonly idleTimeout: Milliseconds) {
    super(`The download stalled: no bytes arrived for ${Math.round(idleTimeout / 1000)} s, so it was aborted and the partial file removed.`);
    this.name = 'CliDownloadStalledError';
  }
}

/**
 * Thrown by {@link downloadCliFile} when the body ended before its declared length. The partial file has
 * been removed.
 */
export class CliDownloadIncompleteError extends Error {
  constructor(
    readonly received: number,
    readonly expected: number
  ) {
    super(`The download ended after ${received} of ${expected} bytes; the partial file was removed.`);
    this.name = 'CliDownloadIncompleteError';
  }
}

/**
 * Thrown when a download, or a whole bulk run, was cancelled through the caller's signal (e.g. Ctrl+C). Any
 * partial file has been removed.
 */
export class CliDownloadAbortedError extends Error {
  constructor(message = 'The download was cancelled; the partial file was removed.') {
    super(message);
    this.name = 'CliDownloadAbortedError';
  }
}

/**
 * Streams a download to a file: chunks go to a partial file as they arrive, so memory holds one chunk at a
 * time whatever the file size, and the file is renamed into place only once complete. A stall (no bytes for
 * the idle timeout), a short body, a cancel or any other error removes the partial file.
 *
 * @param config - The opener, output file and options.
 * @returns The written file, its size and content type.
 * @throws {CliDownloadStalledError} When no bytes arrived for the idle timeout.
 * @throws {CliDownloadIncompleteError} When the body ended before its declared length.
 * @throws {CliDownloadAbortedError} When the caller's signal fired.
 */
export async function downloadCliFile(config: DownloadCliFileConfig): Promise<DownloadCliFileResult> {
  const { open, out, signal, onChunk, mtime } = config;
  const idleTimeout = config.idleTimeout ?? DEFAULT_CLI_DOWNLOAD_IDLE_TIMEOUT;
  const partial = config.partialPath ?? `${out}${CLI_DOWNLOAD_PARTIAL_SUFFIX}`;
  const idleController = new AbortController();
  const downloadSignal = signal ? AbortSignal.any([signal, idleController.signal]) : idleController.signal;
  let stalled = false;
  let timer: Maybe<ReturnType<typeof setTimeout>>;

  // armed once the response arrives (the transport's own timeout covers the wait for it), then restarted on every chunk
  function rearmIdleTimer() {
    clearTimeout(timer ?? undefined);
    timer = setTimeout(() => {
      stalled = true;
      idleController.abort();
    }, idleTimeout);
  }

  let bytes = 0;
  let result: DownloadCliFileResult;

  try {
    signal?.throwIfAborted();
    // a stale partial from a crashed run would keep its old mode
    await rm(partial, { force: true });
    const source = await open(downloadSignal);
    rearmIdleTimer();

    const counter = new Transform({
      transform(chunk: Uint8Array, _encoding, callback) {
        bytes += chunk.length;
        rearmIdleTimer();
        onChunk?.(chunk.length);
        callback(null, chunk);
      }
    });

    const body = source.body ? Readable.fromWeb(source.body as unknown as NodeWebReadableStream<Uint8Array>) : Readable.from([]);
    await pipeline(body, counter, createWriteStream(partial, { mode: config.mode ?? CLI_PRIVATE_FILE_MODE }), { signal: downloadSignal });
    clearTimeout(timer ?? undefined);

    if (source.contentLength != null && bytes !== source.contentLength) {
      throw new CliDownloadIncompleteError(bytes, source.contentLength);
    }

    if (mtime) {
      await utimes(partial, mtime, mtime);
    }

    await rename(partial, out);
    result = { file: out, bytes, ...(source.contentType ? { contentType: source.contentType } : {}) };
  } catch (error) {
    await rm(partial, { force: true });

    if (stalled) {
      throw new CliDownloadStalledError(idleTimeout);
    } else if (signal?.aborted) {
      throw new CliDownloadAbortedError();
    }

    throw error;
  } finally {
    clearTimeout(timer ?? undefined);
  }

  return result;
}
