import { describe, expect, it } from 'vitest';
import { FetchResponseError } from '@dereekb/util/fetch';
import { CliError } from '../util/output';
import { CliDownloadAbortedError, CliDownloadStalledError } from './download.file';
import { CliDownloadTaskFailedError, composeCliDownloadFailureClassifiers, defaultCliDownloadFailureClassifier } from './download.retry';
import { type CliBulkDownloadTask, runCliBulkDownload } from './download.run';

const classify = composeCliDownloadFailureClassifiers(defaultCliDownloadFailureClassifier);
const noWait = async () => undefined;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolves after `ms`, or rejects with an AbortError when the signal fires first.
 *
 * @param ms - How long the work takes.
 * @param signal - The task's signal.
 * @returns Resolves when the work is done.
 */
function work(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

function task(key: string, run: CliBulkDownloadTask['run'], bytes?: number): CliBulkDownloadTask {
  return { key, run, bytes };
}

describe('runCliBulkDownload()', () => {
  it('runs every task with at most `concurrency` in flight', async () => {
    let running = 0;
    let peak = 0;
    const doneKeys: string[] = [];
    const tasks = Array.from({ length: 8 }, (_, i) =>
      task(`t${i}`, async (signal) => {
        running += 1;
        peak = Math.max(peak, running);
        await work(10, signal);
        running -= 1;
        return 10;
      })
    );

    const result = await runCliBulkDownload({ tasks, concurrency: 3, classify, wait: noWait, onTaskDone: (t) => void doneKeys.push(t.key) });

    expect(result).toEqual({ done: 8, failed: 0, deferred: 0, bytes: 80, failedCodes: {} });
    expect(peak).toBe(3);
    expect(doneKeys.sort()).toEqual(tasks.map((t) => t.key).sort());
  });

  it('counts an item failure in failedCodes and keeps going', async () => {
    const failedKeys: string[] = [];
    const tasks = [task('a', async () => 1), task('missing', () => Promise.reject(new FetchResponseError(new Response(null, { status: 404 })))), task('c', async () => 2)];

    const result = await runCliBulkDownload({ tasks, concurrency: 1, classify, wait: noWait, onTaskFailed: (t, failure) => void failedKeys.push(`${t.key}:${failure.code}`) });

    expect(result).toEqual({ done: 2, failed: 1, deferred: 0, bytes: 3, failedCodes: { NOT_FOUND: 1 } });
    expect(failedKeys).toEqual(['missing:NOT_FOUND']);
  });

  it('retries a transient failure before counting the task done', async () => {
    let attempts = 0;
    const retries: string[] = [];
    const result = await runCliBulkDownload({
      tasks: [
        task('flaky', async () => {
          attempts += 1;

          if (attempts === 1) {
            throw new CliDownloadStalledError(10);
          }

          return 5;
        })
      ],
      concurrency: 1,
      classify,
      wait: noWait,
      onProgress: (progress) => {
        if (progress.retry) {
          retries.push(progress.retry.code);
        }
      }
    });

    expect(result.done).toBe(1);
    expect(attempts).toBe(2);
    expect(retries).toEqual(['TIMEOUT']);
  });

  it('aborts in-flight tasks on a fatal failure and awaits them before rethrowing', async () => {
    const abortedSeen: string[] = [];
    let settled = 0;
    const slow = (key: string) =>
      task(key, async (signal) => {
        try {
          await work(5_000, signal);
        } catch (error) {
          abortedSeen.push(key);
          // cleanup that must finish before the run returns
          await delay(20);
          settled += 1;
          throw error;
        }

        return 1;
      });

    const fatal = task('fatal', async () => {
      await delay(10);
      throw new FetchResponseError(new Response(null, { status: 401 }));
    });

    const error = await runCliBulkDownload({ tasks: [slow('s1'), slow('s2'), fatal, slow('s3')], concurrency: 3, classify, wait: noWait }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CliDownloadTaskFailedError);
    expect((error as CliDownloadTaskFailedError).failure).toEqual({ kind: 'fatal', code: 'UNAUTHORIZED' });
    expect(abortedSeen.length).toBe(2);
    expect(settled).toBe(2);
  });

  it('defers tasks past maxTasks', async () => {
    const tasks = Array.from({ length: 5 }, (_, i) => task(`t${i}`, async () => 1));
    const result = await runCliBulkDownload({ tasks, concurrency: 2, classify, wait: noWait, maxTasks: 3 });

    expect(result).toMatchObject({ done: 3, deferred: 2 });
  });

  it('defers a task whose expected bytes would pass maxBytes', async () => {
    const tasks = [task('a', async () => 60, 60), task('b', async () => 50, 50), task('c', async () => 30, 30)];
    const result = await runCliBulkDownload({ tasks, concurrency: 1, classify, wait: noWait, maxBytes: 100 });

    expect(result).toMatchObject({ done: 2, deferred: 1, bytes: 90 });
  });

  it('stops after too many failures in a row', async () => {
    let started = 0;
    const tasks = Array.from({ length: 10 }, (_, i) =>
      task(`t${i}`, () => {
        started += 1;
        return Promise.reject(new FetchResponseError(new Response(null, { status: 403 })));
      })
    );

    const error = await runCliBulkDownload({ tasks, concurrency: 1, classify, wait: noWait, maxConsecutiveFailures: 3 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).code).toBe('TOO_MANY_FAILURES');
    expect(started).toBe(3);
  });

  it('resets the failure streak on a success', async () => {
    const fail = () => Promise.reject(new FetchResponseError(new Response(null, { status: 403 })));
    const tasks = [task('f1', fail), task('f2', fail), task('ok', async () => 1), task('f3', fail), task('f4', fail)];

    const result = await runCliBulkDownload({ tasks, concurrency: 1, classify, wait: noWait, maxConsecutiveFailures: 3 });

    expect(result).toMatchObject({ done: 1, failed: 4, failedCodes: { HTTP_403: 4 } });
  });

  it('throws CliDownloadAbortedError when the signal fires, after in-flight tasks settle', async () => {
    const controller = new AbortController();
    let settled = 0;
    const tasks = Array.from({ length: 4 }, (_, i) =>
      task(`t${i}`, async (signal) => {
        try {
          await work(5_000, signal);
        } finally {
          settled += 1;
        }

        return 1;
      })
    );

    setTimeout(() => controller.abort(), 20);
    const error = await runCliBulkDownload({ tasks, concurrency: 2, classify, wait: noWait, signal: controller.signal }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CliDownloadAbortedError);
    expect(settled).toBe(2);
  });

  it('stops the run when a hook throws', async () => {
    const hookError = new Error('manifest write failed');
    const error = await runCliBulkDownload({
      tasks: [task('a', async () => 1), task('b', async () => 1)],
      concurrency: 1,
      classify,
      wait: noWait,
      onTaskDone: () => {
        throw hookError;
      }
    }).catch((e: unknown) => e);

    expect(error).toBe(hookError);
  });
});
