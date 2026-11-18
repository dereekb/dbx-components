/**
 * The dispatcher's control stage — the host pause gate a dispatch parks on before it sends, and the cancellation
 * signal it forwards to every strategy call (the dispatcher's own signal combined with the request's).
 */

import { type Maybe } from '@dereekb/util';
import { type LlmCallContext } from '../record/llm.call.context';
import { type LlmDispatchRequest } from './llm.dispatch.request';

/**
 * A host pause gate. While {@link isPaused} reads `true`, a dispatch parks BEFORE it sends (nothing is billed while
 * parked) and resumes when {@link waitUntilResumed} resolves.
 */
export interface LlmDispatchPauseSignal {
  /**
   * Whether the host is paused right now.
   *
   * @returns `true` while paused.
   */
  isPaused(): boolean;
  /**
   * Resolve once the host resumes — or once `signal` aborts, so a cancelled dispatch never stays parked.
   *
   * @param signal - The dispatch's cancellation signal, when it has one.
   * @returns A promise that settles on resume (or abort).
   */
  waitUntilResumed(signal?: AbortSignal): Promise<void>;
}

/**
 * The inputs of {@link parkLlmDispatchWhilePaused}.
 */
export interface ParkLlmDispatchWhilePausedConfig {
  /**
   * The host pause gate. Absent ⇒ never parks.
   */
  readonly pause?: Maybe<LlmDispatchPauseSignal>;
  /**
   * The dispatch's cancellation signal — an abort ends the park.
   */
  readonly signal?: Maybe<AbortSignal>;
  /**
   * Where the `paused` span lands.
   */
  readonly callContext: LlmCallContext;
}

/**
 * Wait for an abort on `signal`, returning the wait and a release that detaches its listener.
 *
 * @param signal - The signal to watch.
 * @returns The abort wait and its release.
 */
function abortWaitOf(signal: AbortSignal): { readonly wait: Promise<void>; readonly release: () => void } {
  let release: () => void = () => undefined;
  const wait = new Promise<void>((resolve) => {
    const onAbort = () => resolve();
    signal.addEventListener('abort', onAbort, { once: true });
    release = () => signal.removeEventListener('abort', onAbort);
  });
  return { wait, release };
}

/**
 * Wait for the host to resume, ending early on an abort. A rejection from the host gate while the signal is aborted
 * reads as an ended park (the send then sees the aborted signal); any other rejection propagates.
 *
 * @param pause - The host gate.
 * @param signal - The cancellation signal, when there is one.
 */
async function waitForResumeOrAbort(pause: LlmDispatchPauseSignal, signal: Maybe<AbortSignal>): Promise<void> {
  if (signal == null) {
    await pause.waitUntilResumed();
  } else if (!signal.aborted) {
    const aborted = abortWaitOf(signal);

    try {
      await Promise.race([pause.waitUntilResumed(signal), aborted.wait]);
    } catch (error) {
      if (!signal.aborted) {
        throw error;
      }
    } finally {
      aborted.release();
    }
  }
}

/**
 * Park a dispatch on the host pause gate. Records a `paused` span on the call context ONLY when it actually parks, and
 * resolves on resume OR abort.
 *
 * @param config - The gate, the cancellation signal and the call context.
 * @returns Whether the dispatch parked.
 */
export async function parkLlmDispatchWhilePaused(config: ParkLlmDispatchWhilePausedConfig): Promise<boolean> {
  const { pause, signal, callContext } = config;
  let parked = false;

  if (pause?.isPaused() === true) {
    parked = true;
    await callContext.timeAsync('paused', () => waitForResumeOrAbort(pause, signal));
  }

  return parked;
}

/**
 * The two cancellation sources of one dispatch.
 */
export interface LlmDispatchSignalsConfig {
  /**
   * The dispatcher-wide cancellation signal (a host's run abort).
   */
  readonly cancellationSignal?: Maybe<AbortSignal>;
  /**
   * The request — its own `signal` aborts this dispatch alone.
   */
  readonly request: Pick<LlmDispatchRequest, 'signal'>;
}

/**
 * The signal a dispatch forwards to its strategy calls — the dispatcher's and the request's combined
 * (`AbortSignal.any`) when both exist, else whichever exists.
 *
 * @param config - The dispatcher signal and the request.
 * @returns The forwarded signal, or `undefined` when neither exists.
 */
export function llmDispatchSignalOf(config: LlmDispatchSignalsConfig): Maybe<AbortSignal> {
  const { cancellationSignal, request } = config;
  const requestSignal = request.signal;
  let signal: Maybe<AbortSignal>;

  if (cancellationSignal != null && requestSignal != null) {
    signal = AbortSignal.any([cancellationSignal, requestSignal]);
  } else {
    signal = cancellationSignal ?? requestSignal;
  }

  return signal;
}

/**
 * Whether a dispatch is CANCELLED — either signal aborted. A cancelled dispatch's abort drops the beat instead of
 * throwing.
 *
 * @param config - The dispatcher signal and the request.
 * @returns `true` when either signal is aborted.
 */
export function isLlmDispatchCancelled(config: LlmDispatchSignalsConfig): boolean {
  return config.cancellationSignal?.aborted === true || config.request.signal?.aborted === true;
}
