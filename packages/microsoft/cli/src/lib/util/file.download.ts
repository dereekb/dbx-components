import { CliError } from '@dereekb/dbx-cli';
import { type MicrosoftGraphContext, type MicrosoftGraphRawRequestInput, microsoftGraphRequestStream } from '@dereekb/microsoft';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { type ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import type { Argv } from 'yargs';

/**
 * How long a streamed download may go without receiving a byte (including the wait for the response) before
 * it is aborted: 60 seconds.
 */
export const DEFAULT_MSGRAPH_CLI_DOWNLOAD_IDLE_TIMEOUT: Milliseconds = 60 * 1000;

/**
 * The suffix of the file a download is written to before it is renamed into place.
 */
export const MSGRAPH_CLI_DOWNLOAD_PARTIAL_SUFFIX = '.part';

/**
 * Adds `--idle-timeout <seconds>` to a downloading command.
 *
 * @param yargs - The command's yargs.
 * @returns The yargs with the option.
 */
export function msGraphCliIdleTimeoutOption<T>(yargs: Argv<T>) {
  return yargs.option('idle-timeout', { type: 'number', describe: `Abort when no bytes arrive for this many seconds (default ${DEFAULT_MSGRAPH_CLI_DOWNLOAD_IDLE_TIMEOUT / 1000})` });
}

/**
 * Converts `--idle-timeout` seconds to milliseconds.
 *
 * @param seconds - The option value.
 * @returns The timeout, or undefined for the default.
 * @throws {CliError} When the value is not a positive number.
 */
export function msGraphCliIdleTimeoutMs(seconds: Maybe<number>): Maybe<Milliseconds> {
  if (seconds != null && !(Number.isFinite(seconds) && seconds > 0)) {
    throw new CliError({ message: `--idle-timeout must be a positive number of seconds, got ${seconds}.`, code: 'INVALID_ARGUMENT' });
  }

  return seconds == null ? undefined : Math.round(seconds * 1000);
}

/**
 * Thrown by {@link downloadMsGraphCliFile} when no bytes arrived for the idle timeout. The partial file has
 * been removed.
 */
export class MsGraphCliDownloadStalledError extends Error {
  constructor(readonly idleTimeout: Milliseconds) {
    super(`The download stalled: no bytes arrived for ${Math.round(idleTimeout / 1000)} s, so it was aborted and the partial file removed.`);
    this.name = 'MsGraphCliDownloadStalledError';
  }
}

/**
 * Thrown by {@link downloadMsGraphCliFile} when the body ended before the declared `Content-Length`. The
 * partial file has been removed.
 */
export class MsGraphCliDownloadIncompleteError extends Error {
  constructor(
    readonly received: number,
    readonly expected: number
  ) {
    super(`The download ended after ${received} of ${expected} bytes; the partial file was removed.`);
    this.name = 'MsGraphCliDownloadIncompleteError';
  }
}

export interface MsGraphCliDownloadConfig {
  readonly graphContext: MicrosoftGraphContext;
  /**
   * The GET whose body is the file, e.g. a drive item's `/content` or a message's `/$value`.
   */
  readonly request: MicrosoftGraphRawRequestInput;
  /**
   * The file to write (mode 0600). It only appears once the whole body has arrived.
   */
  readonly out: string;
  /**
   * Aborts when no byte arrives for this long. Defaults to {@link DEFAULT_MSGRAPH_CLI_DOWNLOAD_IDLE_TIMEOUT}.
   * A slow but moving download is never cut off.
   */
  readonly idleTimeout?: Maybe<Milliseconds>;
}

export interface MsGraphCliDownloadResult {
  readonly file: string;
  readonly bytes: number;
  readonly contentType?: string;
}

/**
 * Streams a Graph response body to a file: chunks go to `<out>.part` as they arrive, so memory holds one
 * chunk at a time whatever the file size, and the file is renamed to `out` only once complete. A stall
 * (no bytes for the idle timeout), a short body, or any error removes the partial file.
 *
 * @param config - The request, the output file and the idle timeout.
 * @returns The written file, its size and content type.
 * @throws {MsGraphCliDownloadStalledError} When no bytes arrived for the idle timeout.
 * @throws {MsGraphCliDownloadIncompleteError} When the body ended before its `Content-Length`.
 */
export async function downloadMsGraphCliFile(config: MsGraphCliDownloadConfig): Promise<MsGraphCliDownloadResult> {
  const { graphContext, request, out } = config;
  const idleTimeout = config.idleTimeout ?? DEFAULT_MSGRAPH_CLI_DOWNLOAD_IDLE_TIMEOUT;
  const partial = `${out}${MSGRAPH_CLI_DOWNLOAD_PARTIAL_SUFFIX}`;
  const controller = new AbortController();
  let stalled = false;
  let timer: Maybe<ReturnType<typeof setTimeout>>;

  // restarted on every chunk; it covers the wait for the response too
  function rearmIdleTimer() {
    clearTimeout(timer ?? undefined);
    timer = setTimeout(() => {
      stalled = true;
      controller.abort();
    }, idleTimeout);
  }

  let bytes = 0;
  let result: MsGraphCliDownloadResult;
  rearmIdleTimer();

  try {
    const response = await microsoftGraphRequestStream(graphContext)({ ...request, signal: controller.signal });
    rearmIdleTimer();

    const counter = new Transform({
      transform(chunk: Uint8Array, _encoding, callback) {
        bytes += chunk.length;
        rearmIdleTimer();
        callback(null, chunk);
      }
    });

    const source = response.body ? Readable.fromWeb(response.body as unknown as NodeWebReadableStream<Uint8Array>) : Readable.from([]);
    await pipeline(source, counter, createWriteStream(partial, { mode: 0o600 }));

    if (response.contentLength != null && bytes !== response.contentLength) {
      throw new MsGraphCliDownloadIncompleteError(bytes, response.contentLength);
    }

    await rename(partial, out);
    const contentType = response.headers['content-type'];
    result = { file: out, bytes, ...(contentType ? { contentType } : {}) };
  } catch (error) {
    await rm(partial, { force: true });
    throw stalled ? new MsGraphCliDownloadStalledError(idleTimeout) : error;
  } finally {
    clearTimeout(timer ?? undefined);
  }

  return result;
}
