import { type Maybe, type Milliseconds, performTasksInParallelFunction, type PromiseOrValue } from '@dereekb/util';
import { CliError } from '../util/output';
import { CliDownloadAbortedError } from './download.file';
import { type CliDownloadFailure, type CliDownloadFailureClassifyFunction, type CliDownloadRetryConfig, CliDownloadTaskFailedError, runCliTaskWithRetry } from './download.retry';

/**
 * How many item failures in a row stop a bulk run: 10.
 */
export const DEFAULT_CLI_BULK_DOWNLOAD_MAX_CONSECUTIVE_FAILURES = 10;

/**
 * One item of a bulk download, e.g. one file or one message.
 */
export interface CliBulkDownloadTask {
  /**
   * Identifies the task to the caller's hooks. It is never printed.
   */
  readonly key: string;
  /**
   * Expected bytes; checked against `maxBytes` before the task starts.
   */
  readonly bytes?: Maybe<number>;
  /**
   * Does the item's work and resolves the bytes written. It must honor the signal and clean up after itself
   * on failure, since a failed attempt may be retried.
   */
  readonly run: (signal: AbortSignal, attempt: number) => Promise<number>;
}

/**
 * Progress of a bulk run. Counts only.
 */
export interface CliBulkDownloadProgress {
  readonly done: number;
  readonly failed: number;
  readonly deferred: number;
  readonly total: number;
  readonly bytes: number;
  /**
   * Set when a task is about to wait before a retry.
   */
  readonly retry?: Maybe<{ readonly code: string; readonly delay: Milliseconds }>;
}

/**
 * Configuration for {@link runCliBulkDownload}.
 */
export interface CliBulkDownloadRunConfig {
  readonly tasks: readonly CliBulkDownloadTask[];
  /**
   * How many tasks run at once.
   */
  readonly concurrency: number;
  readonly classify: CliDownloadFailureClassifyFunction;
  readonly retry?: Maybe<CliDownloadRetryConfig>;
  /**
   * Cancels the run, e.g. on Ctrl+C.
   */
  readonly signal?: Maybe<AbortSignal>;
  /**
   * The most tasks started; the rest are deferred.
   */
  readonly maxTasks?: Maybe<number>;
  /**
   * The most bytes; a task whose expected bytes would pass it is deferred.
   */
  readonly maxBytes?: Maybe<number>;
  /**
   * How many item failures in a row stop the run. Defaults to {@link DEFAULT_CLI_BULK_DOWNLOAD_MAX_CONSECUTIVE_FAILURES}.
   */
  readonly maxConsecutiveFailures?: Maybe<number>;
  /**
   * Called when a task succeeded, e.g. to record it in the manifest. An error it throws stops the run.
   */
  readonly onTaskDone?: Maybe<(task: CliBulkDownloadTask, bytes: number) => PromiseOrValue<void>>;
  /**
   * Called when a task failed for good with an `item`, `transient` or `throttled` failure; the run goes on.
   * An error it throws stops the run.
   */
  readonly onTaskFailed?: Maybe<(task: CliBulkDownloadTask, failure: CliDownloadFailure) => PromiseOrValue<void>>;
  readonly onProgress?: Maybe<(progress: CliBulkDownloadProgress) => void>;
  /**
   * Waits between retries. A spec passes a fake.
   */
  readonly wait?: Maybe<(ms: Milliseconds) => Promise<unknown>>;
}

/**
 * Result of {@link runCliBulkDownload}.
 */
export interface CliBulkDownloadRunResult {
  readonly done: number;
  readonly failed: number;
  /**
   * Tasks not started because of `maxTasks` / `maxBytes`.
   */
  readonly deferred: number;
  readonly bytes: number;
  /**
   * Failed tasks by failure code.
   */
  readonly failedCodes: Readonly<Record<string, number>>;
}

/**
 * Runs a bulk download's tasks, `concurrency` at a time, each through {@link runCliTaskWithRetry}.
 *
 * - An `item` failure, or a `transient` / `throttled` one that outlived its retries, is counted (in
 *   `failedCodes`) and the run goes on.
 * - A `fatal` failure, the run's signal, `maxConsecutiveFailures` item failures in a row, or an error thrown
 *   by a hook stop the run: in-flight tasks are cancelled and awaited (so no partial file or manifest write
 *   outlives the run), then the error is rethrown.
 *
 * @param config - The tasks, concurrency, classifier and hooks.
 * @returns The counts.
 * @throws {CliDownloadAbortedError} When the run's signal fired.
 * @throws {CliDownloadTaskFailedError} When a task failed fatally; `failure.code` and `cause` say why.
 * @throws {CliError} `TOO_MANY_FAILURES` when too many tasks failed in a row.
 */
export async function runCliBulkDownload(config: CliBulkDownloadRunConfig): Promise<CliBulkDownloadRunResult> {
  const { tasks, classify, retry, maxTasks, maxBytes, onTaskDone, onTaskFailed, onProgress, wait } = config;
  const maxConsecutiveFailures = config.maxConsecutiveFailures ?? DEFAULT_CLI_BULK_DOWNLOAD_MAX_CONSECUTIVE_FAILURES;
  const runController = new AbortController();
  const signal = config.signal ? AbortSignal.any([config.signal, runController.signal]) : runController.signal;
  const failedCodes: Record<string, number> = {};
  const inFlight = new Set<Promise<void>>();
  const total = tasks.length;
  let done = 0;
  let failed = 0;
  let deferred = 0;
  let bytes = 0;
  let started = 0;
  let reservedBytes = 0;
  let consecutiveFailures = 0;
  let stopError: Maybe<{ readonly error: unknown }>;

  function progress(retryProgress?: CliBulkDownloadProgress['retry']) {
    onProgress?.({ done, failed, deferred, total, bytes, ...(retryProgress ? { retry: retryProgress } : {}) });
  }

  function stop(error: unknown): never {
    stopError ??= { error };
    runController.abort();
    throw error;
  }

  function isOverBudget(expected: number): boolean {
    return (maxTasks != null && started >= maxTasks) || (maxBytes != null && reservedBytes + expected > maxBytes);
  }

  async function onFailure(task: CliBulkDownloadTask, error: unknown): Promise<void> {
    const failure = error instanceof CliDownloadTaskFailedError ? error.failure : classify(error);

    if (signal.aborted || failure.kind === 'fatal' || failure.kind === 'aborted') {
      stop(error);
    }

    failed += 1;
    consecutiveFailures += 1;
    failedCodes[failure.code] = (failedCodes[failure.code] ?? 0) + 1;
    await onTaskFailed?.(task, failure);

    if (consecutiveFailures >= maxConsecutiveFailures) {
      stop(new CliError({ message: `Stopped after ${consecutiveFailures} failures in a row (last: ${failure.code}).`, code: 'TOO_MANY_FAILURES', suggestion: 'Check the connection and access, then re-run to resume.', data: { failedCodes: { ...failedCodes } } }));
    }
  }

  async function performTask(task: CliBulkDownloadTask): Promise<void> {
    const expected = task.bytes ?? 0;
    let taskBytes: Maybe<number>;
    let taskError: Maybe<{ readonly error: unknown }>;
    reservedBytes += expected;

    try {
      taskBytes = await runCliTaskWithRetry({ task: task.run, classify, retry, signal, wait, onRetry: (failure, _attempt, delay) => progress({ code: failure.code, delay }) });
    } catch (error) {
      taskError = { error };
    }

    reservedBytes += (taskBytes ?? 0) - expected;

    try {
      if (taskError) {
        await onFailure(task, taskError.error);
      } else {
        done += 1;
        consecutiveFailures = 0;
        bytes += taskBytes ?? 0;
        await onTaskDone?.(task, taskBytes ?? 0);
      }
    } catch (error) {
      stop(error);
    }

    progress();
  }

  function taskFactory(task: CliBulkDownloadTask): Promise<void> {
    let promise: Promise<void>;

    if (signal.aborted) {
      promise = Promise.resolve();
    } else if (isOverBudget(task.bytes ?? 0)) {
      deferred += 1;
      progress();
      promise = Promise.resolve();
    } else {
      started += 1;
      promise = performTask(task);
      inFlight.add(promise);
      const settle = () => {
        inFlight.delete(promise);
      };
      void promise.then(settle, settle);
    }

    return promise;
  }

  try {
    await performTasksInParallelFunction<CliBulkDownloadTask>({ maxParallelTasks: Math.max(1, config.concurrency), taskFactory })([...tasks]);
  } catch (error) {
    stopError ??= { error };
    runController.abort();
  }

  // performTasksInParallel rejects on the first error without awaiting the tasks still running
  await Promise.allSettled(inFlight);

  if (config.signal?.aborted) {
    throw new CliDownloadAbortedError('The download was cancelled; finished files were kept and partial files removed.');
  } else if (stopError) {
    throw stopError.error;
  }

  return { done, failed, deferred, bytes, failedCodes };
}
