import { CLI_DOWNLOAD_PARTIAL_SUFFIX, CliDownloadIncompleteError, CliDownloadStalledError, type CliDownloadSourceOpener, DEFAULT_CLI_DOWNLOAD_IDLE_TIMEOUT, cliIdleTimeoutMs, cliIdleTimeoutOption, downloadCliFile } from '@dereekb/dbx-cli';
import { type MicrosoftGraphContext, type MicrosoftGraphRawRequestInput, microsoftGraphRequestStream } from '@dereekb/microsoft';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import type { Argv } from 'yargs';

/**
 * Adds `--idle-timeout <seconds>` to a downloading command.
 *
 * @param yargs - The command's yargs.
 * @returns The yargs with the option.
 */
export function msGraphCliIdleTimeoutOption<T>(yargs: Argv<T>) {
  return cliIdleTimeoutOption(yargs);
}

/**
 * Converts `--idle-timeout` seconds to milliseconds.
 *
 * @param seconds - The option value.
 * @returns The timeout, or undefined for the default.
 * @throws {CliError} When the value is not a positive number.
 */
export function msGraphCliIdleTimeoutMs(seconds: Maybe<number>): Maybe<Milliseconds> {
  return cliIdleTimeoutMs(seconds);
}

/**
 * Returns a download opener that sends a Graph GET and resolves the streamed body once the response headers
 * arrive. `contentLength` is only set when the body is not content-encoded, so it counts the bytes the body yields.
 *
 * @param graphContext - The Graph context.
 * @param request - The GET whose body is the file, e.g. a drive item's `/content` or a message's `/$value`.
 * @returns The opener for `downloadCliFile`.
 */
export function msGraphCliStreamOpener(graphContext: MicrosoftGraphContext, request: MicrosoftGraphRawRequestInput): CliDownloadSourceOpener {
  const requestStream = microsoftGraphRequestStream(graphContext);

  return async (signal: AbortSignal) => {
    const response = await requestStream({ ...request, signal });
    return { body: response.body, contentLength: response.contentLength, contentType: response.headers['content-type'] };
  };
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
   * Aborts when no byte arrives for this long once the response has arrived. Defaults to
   * {@link DEFAULT_CLI_DOWNLOAD_IDLE_TIMEOUT}. A slow but moving download is never cut off.
   */
  readonly idleTimeout?: Maybe<Milliseconds>;
  /**
   * Cancels the download (e.g. Ctrl+C or a bulk run stopping). The partial file is removed.
   */
  readonly signal?: Maybe<AbortSignal>;
  /**
   * Where the body is written while it arrives. Defaults to `<out>.part`.
   */
  readonly partialPath?: Maybe<string>;
  /**
   * Sets the file's modification time, e.g. to the remote item's last-modified time.
   */
  readonly mtime?: Maybe<Date>;
}

export interface MsGraphCliDownloadResult {
  readonly file: string;
  readonly bytes: number;
  readonly contentType?: string;
}

/**
 * Streams a Graph response body to a file through the dbx-cli download engine: chunks go to `<out>.part` as
 * they arrive, so memory holds one chunk at a time whatever the file size, and the file is renamed to `out`
 * only once complete. A stall (no bytes for the idle timeout once the response arrived), a short body, a
 * cancel or any error removes the partial file.
 *
 * @param config - The request, the output file and the idle timeout.
 * @returns The written file, its size and content type.
 * @throws {CliDownloadStalledError} When no bytes arrived for the idle timeout.
 * @throws {CliDownloadIncompleteError} When the body ended before its `Content-Length`.
 * @throws {CliDownloadAbortedError} When the signal fired.
 */
export function downloadMsGraphCliFile(config: MsGraphCliDownloadConfig): Promise<MsGraphCliDownloadResult> {
  const { graphContext, request, out, idleTimeout, signal, partialPath, mtime } = config;
  return downloadCliFile({ open: msGraphCliStreamOpener(graphContext, request), out, idleTimeout, signal, partialPath, mtime });
}

// COMPAT: Deprecated aliases
// kept for consumers of the package index; the dbx-cli download engine owns these now, and the classes are the
// same classes, so `instanceof` checks against either name keep working.

/**
 * How long a streamed download may go without receiving a byte, once the response has arrived, before it is
 * aborted: 60 seconds.
 *
 * @deprecated Use {@link DEFAULT_CLI_DOWNLOAD_IDLE_TIMEOUT} from `@dereekb/dbx-cli`.
 */
export const DEFAULT_MSGRAPH_CLI_DOWNLOAD_IDLE_TIMEOUT: Milliseconds = DEFAULT_CLI_DOWNLOAD_IDLE_TIMEOUT;

/**
 * The suffix of the file a download is written to before it is renamed into place.
 *
 * @deprecated Use {@link CLI_DOWNLOAD_PARTIAL_SUFFIX} from `@dereekb/dbx-cli`.
 */
export const MSGRAPH_CLI_DOWNLOAD_PARTIAL_SUFFIX = CLI_DOWNLOAD_PARTIAL_SUFFIX;

/**
 * Thrown when no bytes arrived for the idle timeout. The partial file has been removed.
 *
 * @deprecated Use {@link CliDownloadStalledError} from `@dereekb/dbx-cli`; this is the same class.
 */
export const MsGraphCliDownloadStalledError = CliDownloadStalledError;
/**
 * @deprecated Use {@link CliDownloadStalledError} from `@dereekb/dbx-cli`.
 */
export type MsGraphCliDownloadStalledError = CliDownloadStalledError;

/**
 * Thrown when the body ended before the declared `Content-Length`. The partial file has been removed.
 *
 * @deprecated Use {@link CliDownloadIncompleteError} from `@dereekb/dbx-cli`; this is the same class.
 */
export const MsGraphCliDownloadIncompleteError = CliDownloadIncompleteError;
/**
 * @deprecated Use {@link CliDownloadIncompleteError} from `@dereekb/dbx-cli`.
 */
export type MsGraphCliDownloadIncompleteError = CliDownloadIncompleteError;
