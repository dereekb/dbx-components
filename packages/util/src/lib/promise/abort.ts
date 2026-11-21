import { type Milliseconds } from '../date/date';
import { type Maybe } from '../value/maybe.type';

/**
 * Waits `ms`, waking EARLY (and never rejecting) when `signal` aborts.
 *
 * Resolves at once when `ms` is not positive (0, negative or NaN) or the signal is already aborted. Each path tears the
 * other down, so neither a fired timer nor an abort leaves a listener or timer behind.
 *
 * @param ms - How long to wait.
 * @param signal - Optional signal that ends the wait early.
 * @returns A promise that resolves after the wait or on abort, whichever comes first.
 *
 * @dbxUtil
 * @dbxUtilCategory promise
 * @dbxUtilTags wait, delay, sleep, abort, signal, cancel, timeout, backoff
 * @dbxUtilRelated wait-for-ms, wait-for-promise-unless-aborted
 *
 * @example
 * ```ts
 * const controller = new AbortController();
 * await waitForMsUnlessAborted(1000, controller.signal); // resolves after 1s, or as soon as controller.abort() runs
 * ```
 */
export async function waitForMsUnlessAborted(ms: Milliseconds, signal?: Maybe<AbortSignal>): Promise<void> {
  if (ms > 0 && signal?.aborted !== true) {
    await new Promise<void>((resolve) => {
      const handle: { timer?: ReturnType<typeof setTimeout> } = {};
      const onAbort = (): void => {
        clearTimeout(handle.timer);
        resolve();
      };

      handle.timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);

      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}

/**
 * Starts a promise and waits for it, ending early with `undefined` when `signal` aborts.
 *
 * - With no signal, it is `await start()`.
 * - With an already-aborted signal, it resolves `undefined` without calling `start`.
 * - Otherwise it races `start()` against the abort: an abort resolves `undefined`; a rejection from `start()` is rethrown
 *   unless the signal has aborted by then, in which case it also resolves `undefined`. A late rejection is never left
 *   unhandled, and the abort listener is always removed.
 *
 * @param start - Starts the work to wait for.
 * @param signal - Optional signal that ends the wait early.
 * @returns The work's value, or `undefined` when the signal aborted first.
 * @throws {unknown} The work's rejection when it rejects before the signal aborts.
 *
 * @dbxUtil
 * @dbxUtilCategory promise
 * @dbxUtilTags wait, abort, signal, cancel, race, promise
 * @dbxUtilRelated wait-for-ms-unless-aborted, merge-abort-signals
 *
 * @example
 * ```ts
 * const value = await waitForPromiseUnlessAborted(() => gate.waitUntilOpen(), signal);
 * // value is undefined when signal aborted before the gate opened
 * ```
 */
export async function waitForPromiseUnlessAborted<T>(start: () => PromiseLike<T>, signal?: Maybe<AbortSignal>): Promise<Maybe<T>> {
  let result: Maybe<T>;

  if (signal == null) {
    result = await start();
  } else if (!signal.aborted) {
    let release: () => void = () => undefined;
    const aborted = new Promise<undefined>((resolve) => {
      const onAbort = () => resolve(undefined);
      signal.addEventListener('abort', onAbort, { once: true });
      release = () => signal.removeEventListener('abort', onAbort);
    });

    try {
      result = await Promise.race([start(), aborted]);
    } catch (error) {
      if (!signal.aborted) {
        throw error;
      }
    } finally {
      release();
    }
  }

  return result;
}

/**
 * Combines optional abort signals into one that aborts when any input aborts, with that input's `reason`.
 *
 * - Nullish entries are dropped; no signals returns `undefined` and exactly one returns that SAME instance.
 * - Two or more use `AbortSignal.any` (in input order) when the runtime has it, else an `AbortController` fallback that
 *   aborts with the first already-aborted input's reason, or on the first input to abort later.
 *
 * @param signals - The signals to combine.
 * @returns The combined signal, or `undefined` when there are none.
 *
 * @dbxUtil
 * @dbxUtilCategory promise
 * @dbxUtilTags abort, signal, merge, combine, any, cancel
 * @dbxUtilRelated make-timeout-abort-signal, wait-for-promise-unless-aborted
 *
 * @example
 * ```ts
 * const signal = mergeAbortSignals([runSignal, request.signal]); // aborts when either aborts
 * mergeAbortSignals([undefined, runSignal]) === runSignal; // true
 * ```
 */
export function mergeAbortSignals(signals: ReadonlyArray<Maybe<AbortSignal>>): Maybe<AbortSignal> {
  const present = signals.filter((x): x is AbortSignal => x != null);
  let result: Maybe<AbortSignal>;

  if (present.length <= 1) {
    result = present[0];
  } else if (typeof AbortSignal.any === 'function') {
    result = AbortSignal.any([...present]);
  } else {
    result = mergeAbortSignalsWithController(present);
  }

  return result;
}

/**
 * The {@link mergeAbortSignals} fallback for runtimes without `AbortSignal.any`.
 *
 * @param signals - Two or more signals.
 * @returns A controller-backed signal that aborts with the first input's reason.
 */
function mergeAbortSignalsWithController(signals: readonly AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const alreadyAborted = signals.find((x) => x.aborted);

  if (alreadyAborted == null) {
    const onAbort = (event: Event) => {
      const source = event.target as AbortSignal;

      if (!controller.signal.aborted) {
        controller.abort(source.reason);
      }

      signals.forEach((x) => x.removeEventListener('abort', onAbort));
    };

    signals.forEach((x) => x.addEventListener('abort', onAbort, { once: true }));
  } else {
    controller.abort(alreadyAborted.reason);
  }

  return controller.signal;
}

/**
 * A cancellation seam an options bag carries.
 */
export interface AbortSignalRef {
  /**
   * An external cancellation signal.
   */
  readonly signal?: AbortSignal | undefined;
}

/**
 * Configuration for {@link makeTimeoutAbortSignal}.
 */
export interface MakeTimeoutAbortSignalConfig {
  /**
   * How long until the signal aborts with a `TimeoutError`. A timeout of 0 aborts on the next tick; it never means "no
   * timeout".
   */
  readonly timeout: Milliseconds;
  /**
   * Optional caller signal that also aborts the result, with its own reason.
   */
  readonly signal?: Maybe<AbortSignal>;
}

/**
 * Creates a signal that aborts with a `TimeoutError` `DOMException` after `timeout`, or earlier when the optional caller
 * signal aborts.
 *
 * Uses `AbortSignal.timeout` when the runtime has it, else a `setTimeout`-driven controller (its timer is `unref()`ed
 * where supported), then combines it with the caller signal through {@link mergeAbortSignals} (timeout first). Runtime
 * APIs are read at call time, and an error they throw propagates to the caller.
 *
 * @param config - The timeout and the optional caller signal.
 * @returns The signal to pass to the timed call.
 *
 * @dbxUtil
 * @dbxUtilCategory promise
 * @dbxUtilTags abort, signal, timeout, fetch, cancel, deadline
 * @dbxUtilRelated merge-abort-signals, wait-for-ms-unless-aborted
 *
 * @example
 * ```ts
 * const response = await fetch(url, { signal: makeTimeoutAbortSignal({ timeout: 15_000, signal: callerSignal }) });
 * ```
 */
export function makeTimeoutAbortSignal(config: MakeTimeoutAbortSignalConfig): AbortSignal {
  const { timeout, signal } = config;
  let timeoutSignal: AbortSignal;

  if (typeof AbortSignal.timeout === 'function') {
    timeoutSignal = AbortSignal.timeout(timeout);
  } else {
    const controller = new AbortController();
    const timer: unknown = setTimeout(() => controller.abort(new DOMException('signal timed out', 'TimeoutError')), timeout);

    // Node timers keep the process alive; browsers return a number.
    if (typeof timer === 'object' && timer != null && 'unref' in timer && typeof timer.unref === 'function') {
      timer.unref();
    }

    timeoutSignal = controller.signal;
  }

  return mergeAbortSignals([timeoutSignal, signal]) ?? timeoutSignal;
}
