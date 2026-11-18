/**
 * The dispatcher's control stage — the host pause gate a dispatch parks on before it sends, and the cancellation
 * signal it forwards to every strategy call (the dispatcher's own signal combined with the request's).
 */

import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type LlmCallContext, makeLlmCallContext, noopLlmCallContext } from '../record/llm.call.context';
import { type LlmSwallowSink } from '../record/llm.swallow';
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

// MARK: Transport backoff
/**
 * The first transport-retry backoff, before jitter.
 */
export const LLM_TRANSPORT_RETRY_BASE_DELAY_MS: Milliseconds = 500;

/**
 * The cap of the exponential transport-retry backoff, before jitter.
 */
export const LLM_TRANSPORT_RETRY_MAX_DELAY_MS: Milliseconds = 8_000;

/**
 * The wait before an identical resend after the transport failure of the 1-based `attempt`.
 */
export type LlmDispatchTransportBackoff = (attempt: number) => Milliseconds;

/**
 * The default transport backoff — exponential from {@link LLM_TRANSPORT_RETRY_BASE_DELAY_MS}, capped at
 * {@link LLM_TRANSPORT_RETRY_MAX_DELAY_MS}, with half-jitter (the wait lands in `[½, 1] ×` the exponential step).
 *
 * @param attempt - The 1-based ordinal of the attempt whose transport failed.
 * @param random - The jitter source (`[0, 1)`).
 * @returns The wait.
 */
export function llmTransportBackoffMs(attempt: number, random: () => number = Math.random): Milliseconds {
  const exponential = Math.min(LLM_TRANSPORT_RETRY_MAX_DELAY_MS, LLM_TRANSPORT_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1));
  return Math.round(exponential * (0.5 + random() * 0.5));
}

/**
 * Wait `ms`, waking EARLY (never rejecting) on an abort. Returns at once for `ms <= 0` or a pre-aborted signal. Each path
 * tears the other down, so neither a fired timer nor an abort leaves a listener attached.
 *
 * @param ms - The wait.
 * @param signal - The cancellation signal.
 */
export async function delayLlmDispatch(ms: Milliseconds, signal?: Maybe<AbortSignal>): Promise<void> {
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

// MARK: Fallback context
/**
 * The inputs of {@link llmDispatchFallbackCallContextOf}.
 */
export interface LlmDispatchFallbackCallContextConfig<A extends object = object> {
  /**
   * The context label.
   */
  readonly label: string;
  /**
   * Where the context reports its swallows. Absent ⇒ a no-op context.
   */
  readonly swallow?: Maybe<LlmSwallowSink>;
  /**
   * The context's attribution.
   */
  readonly attribution?: Maybe<A>;
}

/**
 * The call context of a dispatch (or decision) nothing else minted one for — a context that does not time, reporting its
 * swallows to the host sink when one is configured, else a no-op context.
 *
 * @param config - The label, the swallow sink and the attribution.
 * @returns The context.
 */
export function llmDispatchFallbackCallContextOf<A extends object = object>(config: LlmDispatchFallbackCallContextConfig<A>): LlmCallContext<A> {
  const { label, swallow, attribution } = config;
  return swallow == null ? noopLlmCallContext<A>() : makeLlmCallContext<A>({ label, timing: false, attribution: attribution as A, onSwallow: (site, cause) => swallow(site, cause) });
}
