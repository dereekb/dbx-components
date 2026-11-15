import { exponentialBackoffDelay, type Maybe, type Milliseconds } from '@dereekb/util';
import { FetchResponseError, FetchTimeoutError, parseRetryAfterHeader } from '@dereekb/util/fetch';
import { CliDownloadAbortedError, CliDownloadIncompleteError, CliDownloadStalledError } from './download.file';

/**
 * How a failed task is handled:
 * - `throttled`: the server asked to slow down; retried after its wait.
 * - `transient`: a stall, a short body, a network error or a 5xx; retried with backoff.
 * - `item`: this item cannot be downloaded (404, 403, …); not retried, the run goes on.
 * - `fatal`: nothing else will work either (credentials rejected, disk full); the run stops.
 * - `aborted`: the run was cancelled; the run stops.
 */
export type CliDownloadFailureKind = 'throttled' | 'transient' | 'item' | 'fatal' | 'aborted';

/**
 * A classified task failure. The code is a CLI error code (`RATE_LIMITED`, `NOT_FOUND`, …) and never names an item.
 */
export interface CliDownloadFailure {
  readonly kind: CliDownloadFailureKind;
  readonly code: string;
  /**
   * How long the server asked to wait before retrying.
   */
  readonly retryAfter?: Maybe<Milliseconds>;
}

/**
 * Classifies an error, or returns undefined to let the next classifier decide.
 */
export type CliDownloadFailureClassifier = (error: unknown) => Maybe<CliDownloadFailure>;

/**
 * A classifier that always answers.
 */
export type CliDownloadFailureClassifyFunction = (error: unknown) => CliDownloadFailure;

/**
 * The failure of a cancelled task.
 */
export const CLI_DOWNLOAD_ABORTED_FAILURE: CliDownloadFailure = { kind: 'aborted', code: 'ABORTED' };

/**
 * The failure the composed classifier falls back to.
 */
export const CLI_DOWNLOAD_UNKNOWN_FAILURE: CliDownloadFailure = { kind: 'item', code: 'ERROR' };

const CLI_DOWNLOAD_NETWORK_ERROR_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'EPIPE', 'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'ECONNABORTED']);
const CLI_DOWNLOAD_DISK_FULL_ERROR_CODES = new Set(['ENOSPC', 'EDQUOT']);
const CLI_DOWNLOAD_WRITE_FAILED_ERROR_CODES = new Set(['EROFS', 'EACCES', 'EPERM']);

function errorCodeOf(error: unknown): Maybe<string> {
  const code = (error as Maybe<{ readonly code?: unknown }>)?.code;
  return typeof code === 'string' ? code : undefined;
}

function classifyFetchResponseError(error: FetchResponseError): CliDownloadFailure {
  const { status } = error.response;
  const retryAfter = parseRetryAfterHeader(error.response.headers.get('retry-after'));
  let result: CliDownloadFailure;

  if (status === 429) {
    result = { kind: 'throttled', code: 'RATE_LIMITED', retryAfter };
  } else if (status === 408 || status >= 500) {
    result = { kind: 'transient', code: 'SERVICE_UNAVAILABLE', retryAfter };
  } else if (status === 404) {
    result = { kind: 'item', code: 'NOT_FOUND' };
  } else if (status === 401) {
    result = { kind: 'fatal', code: 'UNAUTHORIZED' };
  } else {
    result = { kind: 'item', code: `HTTP_${status}` };
  }

  return result;
}

function classifyNodeError(error: unknown): Maybe<CliDownloadFailure> {
  const code = errorCodeOf(error);
  const causeCode = errorCodeOf((error as Maybe<{ readonly cause?: unknown }>)?.cause);
  const name = (error as Maybe<{ readonly name?: unknown }>)?.name;
  const isNetworkCode = (value: Maybe<string>) => value != null && (CLI_DOWNLOAD_NETWORK_ERROR_CODES.has(value) || value.startsWith('UND_ERR_'));
  let result: Maybe<CliDownloadFailure>;

  if (code != null && CLI_DOWNLOAD_DISK_FULL_ERROR_CODES.has(code)) {
    result = { kind: 'fatal', code: 'DISK_FULL' };
  } else if (code != null && CLI_DOWNLOAD_WRITE_FAILED_ERROR_CODES.has(code)) {
    result = { kind: 'fatal', code: 'WRITE_FAILED' };
  } else if (name === 'AbortError' || name === 'TimeoutError') {
    result = { kind: 'transient', code: 'TIMEOUT' };
  } else if (isNetworkCode(code) || isNetworkCode(causeCode) || (error instanceof TypeError && error.message === 'fetch failed')) {
    result = { kind: 'transient', code: 'NETWORK' };
  }

  return result;
}

/**
 * Classifies the errors any download can hit, whatever the API: the engine's own stall, short-body and
 * cancel errors, a `FetchResponseError` by status (with its `Retry-After`), client timeouts, network errors,
 * and disk errors. Returns undefined for anything else, so an API-specific classifier composed before it
 * (see {@link composeCliDownloadFailureClassifiers}) handles its own errors first.
 *
 * @param error - The error a task threw.
 * @returns The failure, or undefined when the error is not one it knows.
 */
export const defaultCliDownloadFailureClassifier: CliDownloadFailureClassifier = (error: unknown) => {
  let result: Maybe<CliDownloadFailure>;

  if (error instanceof CliDownloadAbortedError) {
    result = CLI_DOWNLOAD_ABORTED_FAILURE;
  } else if (error instanceof CliDownloadStalledError) {
    result = { kind: 'transient', code: 'TIMEOUT' };
  } else if (error instanceof CliDownloadIncompleteError) {
    result = { kind: 'transient', code: 'DOWNLOAD_INCOMPLETE' };
  } else if (error instanceof FetchTimeoutError) {
    result = { kind: 'transient', code: 'TIMEOUT' };
  } else if (error instanceof FetchResponseError) {
    result = classifyFetchResponseError(error);
  } else {
    result = classifyNodeError(error);
  }

  return result;
};

/**
 * Chains classifiers: the first one that answers wins, and an error none of them knows is an `item` failure
 * with code `ERROR`. Put API-specific classifiers first and {@link defaultCliDownloadFailureClassifier} last.
 *
 * @param classifiers - The classifiers, in order.
 * @returns A classifier that always answers.
 */
export function composeCliDownloadFailureClassifiers(...classifiers: CliDownloadFailureClassifier[]): CliDownloadFailureClassifyFunction {
  return (error: unknown) => {
    let result: Maybe<CliDownloadFailure>;

    for (const classifier of classifiers) {
      result = classifier(error);

      if (result != null) {
        break;
      }
    }

    return result ?? CLI_DOWNLOAD_UNKNOWN_FAILURE;
  };
}

/**
 * How a task is retried.
 */
export interface CliDownloadRetryConfig {
  /**
   * The most attempts, the first included. Defaults to 4.
   */
  readonly maxAttempts?: Maybe<number>;
  /**
   * The backoff before the first retry. Defaults to 1 second.
   */
  readonly initialDelay?: Maybe<Milliseconds>;
  /**
   * The longest backoff. Defaults to 60 seconds.
   */
  readonly maxDelay?: Maybe<Milliseconds>;
  /**
   * The longest server-requested wait honored; a longer `retryAfter` is shortened to it. Defaults to 5 minutes.
   */
  readonly maxRetryAfter?: Maybe<Milliseconds>;
}

export const DEFAULT_CLI_DOWNLOAD_MAX_ATTEMPTS = 4;
export const DEFAULT_CLI_DOWNLOAD_RETRY_INITIAL_DELAY: Milliseconds = 1000;
export const DEFAULT_CLI_DOWNLOAD_RETRY_MAX_DELAY: Milliseconds = 60 * 1000;
export const DEFAULT_CLI_DOWNLOAD_MAX_RETRY_AFTER: Milliseconds = 5 * 60 * 1000;

/**
 * Input to {@link runCliTaskWithRetry}.
 */
export interface RunCliTaskWithRetryInput<T> {
  /**
   * The task. It must honor the signal. `attempt` is 1 for the first try.
   */
  readonly task: (signal: AbortSignal, attempt: number) => Promise<T>;
  readonly classify: CliDownloadFailureClassifyFunction;
  readonly retry?: Maybe<CliDownloadRetryConfig>;
  /**
   * Cancels the task and any wait between attempts.
   */
  readonly signal?: Maybe<AbortSignal>;
  /**
   * Waits between attempts. Defaults to a timer the signal cancels; a spec passes a fake.
   */
  readonly wait?: Maybe<(ms: Milliseconds) => Promise<unknown>>;
  /**
   * Called before each wait, e.g. to report a retry.
   */
  readonly onRetry?: Maybe<(failure: CliDownloadFailure, attempt: number, delay: Milliseconds) => void>;
}

/**
 * Thrown by {@link runCliTaskWithRetry} when a task failed for good: it was not retryable, ran out of
 * attempts, or was cancelled. `cause` is the last error the task threw.
 */
export class CliDownloadTaskFailedError extends Error {
  constructor(
    readonly failure: CliDownloadFailure,
    cause: unknown
  ) {
    super(`The task failed (${failure.code}).`, { cause });
    this.name = 'CliDownloadTaskFailedError';
  }
}

function waitUnlessAborted(ms: Milliseconds, signal: Maybe<AbortSignal>): Promise<void> {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };

    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

/**
 * Runs a task, retrying `transient` and `throttled` failures: exponential backoff with equal jitter (1 s
 * doubling to 60 s by default), or the server's `retryAfter` when the failure carries one (up to 5 minutes).
 * `item`, `fatal` and `aborted` failures are not retried.
 *
 * @param input - The task, classifier, retry limits and signal.
 * @returns The task's result.
 * @throws {CliDownloadTaskFailedError} When the task failed for good.
 */
export async function runCliTaskWithRetry<T>(input: RunCliTaskWithRetryInput<T>): Promise<T> {
  const { task, classify, signal, onRetry } = input;
  const maxAttempts = Math.max(1, input.retry?.maxAttempts ?? DEFAULT_CLI_DOWNLOAD_MAX_ATTEMPTS);
  const initialDelay = input.retry?.initialDelay ?? DEFAULT_CLI_DOWNLOAD_RETRY_INITIAL_DELAY;
  const maxDelay = input.retry?.maxDelay ?? DEFAULT_CLI_DOWNLOAD_RETRY_MAX_DELAY;
  const maxRetryAfter = input.retry?.maxRetryAfter ?? DEFAULT_CLI_DOWNLOAD_MAX_RETRY_AFTER;
  const wait = input.wait ?? ((ms: Milliseconds) => waitUnlessAborted(ms, signal));
  const taskSignal = signal ?? new AbortController().signal;
  let attempt = 1;
  let result: Maybe<{ readonly value: T }>;

  while (result == null) {
    if (taskSignal.aborted) {
      throw new CliDownloadTaskFailedError(CLI_DOWNLOAD_ABORTED_FAILURE, new CliDownloadAbortedError());
    }

    try {
      result = { value: await task(taskSignal, attempt) };
    } catch (error) {
      const failure = taskSignal.aborted ? CLI_DOWNLOAD_ABORTED_FAILURE : classify(error);
      const isRetryable = (failure.kind === 'transient' || failure.kind === 'throttled') && attempt < maxAttempts;

      if (!isRetryable) {
        throw new CliDownloadTaskFailedError(failure, error);
      }

      const delay = failure.retryAfter == null ? exponentialBackoffDelay({ attempt, initialDelay, maxDelay }) : Math.min(failure.retryAfter, maxRetryAfter);
      onRetry?.(failure, attempt, delay);
      await wait(delay);
      attempt += 1;
    }
  }

  return result.value;
}
