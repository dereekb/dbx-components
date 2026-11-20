/**
 * The dispatcher's control stage — the host pause gate a dispatch parks on before it sends, and the cancellation
 * signal it forwards to every strategy call (the dispatcher's own signal combined with the request's).
 */

import { exponentialBackoffDelay, type Maybe, mergeAbortSignals, type Milliseconds, waitForPromiseUnlessAborted } from '@dereekb/util';
import { readFetchErrorRetryAfter } from '@dereekb/util/fetch';
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
    // Ends early on an abort. A rejection from the host gate while the signal is aborted reads as an ended park (the
    // send then sees the aborted signal); any other rejection propagates.
    await callContext.timeAsync('paused', () => waitForPromiseUnlessAborted(() => pause.waitUntilResumed(signal ?? undefined), signal));
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
 * (`@dereekb/util` `mergeAbortSignals`) when both exist, else whichever exists (the same instance).
 *
 * @param config - The dispatcher signal and the request.
 * @returns The forwarded signal, or `undefined` when neither exists.
 */
export function llmDispatchSignalOf(config: LlmDispatchSignalsConfig): Maybe<AbortSignal> {
  return mergeAbortSignals([config.cancellationSignal, config.request.signal]);
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
 * The longest server-requested wait (`retry-after-ms` / `Retry-After`) the default backoff honors — the openai SDK's own
 * ceiling. A longer wait falls back to the exponential step; a host that wants to honor it passes its own
 * `transportBackoff`.
 */
export const LLM_TRANSPORT_RETRY_AFTER_MAX_MS: Milliseconds = 60_000;

/**
 * What a transport backoff is handed: the failed attempt and what its send threw.
 */
export interface LlmDispatchTransportBackoffInput {
  /**
   * The 1-based ordinal of the attempt whose send failed.
   */
  readonly attempt: number;
  /**
   * The thrown value — an SDK error with `headers`, an `LlmDecisionTransportError`, …
   */
  readonly error: unknown;
}

/**
 * The wait before the resend that follows a transport failure.
 */
export type LlmDispatchTransportBackoff = (input: LlmDispatchTransportBackoffInput) => Milliseconds;

/**
 * The default transport backoff — the server's requested wait (`@dereekb/util/fetch` `readFetchErrorRetryAfter`:
 * `retry-after-ms`, else `Retry-After`) when one is readable off the error and at most
 * {@link LLM_TRANSPORT_RETRY_AFTER_MAX_MS}; else `@dereekb/util` `exponentialBackoffDelay` from
 * {@link LLM_TRANSPORT_RETRY_BASE_DELAY_MS}, capped at {@link LLM_TRANSPORT_RETRY_MAX_DELAY_MS}, with equal jitter (the
 * wait lands in `[½, 1] ×` the exponential step).
 *
 * @param input - The failed attempt's 1-based ordinal and what its send threw.
 * @param random - The jitter source (`[0, 1)`).
 * @returns The wait.
 *
 * @example
 * ```ts
 * llmTransportBackoffMs({ attempt: 1, error: { headers: new Headers({ 'retry-after': '2' }) } }); // 2000
 * llmTransportBackoffMs({ attempt: 2, error: new Error('socket hang up') }, () => 0); // 500 (½ × 1000)
 * ```
 */
export function llmTransportBackoffMs(input: LlmDispatchTransportBackoffInput, random: () => number = Math.random): Milliseconds {
  const { attempt, error } = input;
  const requested = readFetchErrorRetryAfter(error);
  return requested != null && requested <= LLM_TRANSPORT_RETRY_AFTER_MAX_MS ? requested : exponentialBackoffDelay({ attempt, initialDelay: LLM_TRANSPORT_RETRY_BASE_DELAY_MS, maxDelay: LLM_TRANSPORT_RETRY_MAX_DELAY_MS, random });
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
