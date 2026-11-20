/**
 * The STRUCTURED FAULT a completion dispatch rejects with when its send threw an error the retry policy does not
 * resend — recorded first like every other fault (an `unretryable` decode row, a failed-attempt row, the call record,
 * the decode-failure record and `onDispatchComplete`), then thrown so the caller still sees the failure.
 */

import { type FetchErrorClassification } from '@dereekb/util/fetch';
import { type LlmCapabilityKey } from '../model/llm.value';

/**
 * The fault kind an {@link LlmDispatchFaultError} carries — the decode class its rows were recorded under.
 */
export type LlmDispatchFaultKind = 'unretryable';

/**
 * The inputs of {@link LlmDispatchFaultError}.
 */
export interface LlmDispatchFaultErrorConfig {
  /**
   * The capability the dispatch served.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The 1-based attempt that failed.
   */
  readonly attempt: number;
  /**
   * The thrown value — becomes the ES2022 `Error.cause`.
   */
  readonly error: unknown;
  /**
   * The thrown value's bounded summary (`formatLlmErrorSummary`).
   */
  readonly summary: string;
  /**
   * Its classification — never `transient`, which is always resent.
   */
  readonly classification: Exclude<FetchErrorClassification, 'transient'>;
}

/**
 * A completion dispatch that failed with an error the retry policy does not resend: a `permanent` one (HTTP 400–404),
 * or an `unknown` one the host's `isRetryableUnknownError` did not vouch for. The call was recorded before this was
 * thrown; the original error is the ES2022 `cause`.
 */
export class LlmDispatchFaultError extends Error {
  /**
   * The decode class the failing attempt was recorded under.
   */
  readonly fault: LlmDispatchFaultKind;
  /**
   * The capability the dispatch served.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The 1-based attempt that failed.
   */
  readonly attempt: number;
  /**
   * The original error's bounded summary.
   */
  readonly summary: string;
  /**
   * The original error's classification.
   */
  readonly classification: Exclude<FetchErrorClassification, 'transient'>;

  constructor(config: LlmDispatchFaultErrorConfig) {
    // No `cause` class field: `useDefineForClassFields` would reset it to `undefined` after `super`.
    super(`llm dispatch '${config.capability}': attempt ${config.attempt} failed with a ${config.classification} error the retry policy does not resend: ${config.summary}`, { cause: config.error });
    this.name = 'LlmDispatchFaultError';
    this.fault = 'unretryable';
    this.capability = config.capability;
    this.attempt = config.attempt;
    this.summary = config.summary;
    this.classification = config.classification;
  }
}

/**
 * Whether a thrown value is an {@link LlmDispatchFaultError} — by class, or structurally by its `name` and `fault`
 * (an error that crossed a realm or a bundle boundary).
 *
 * @param error - The thrown value.
 * @returns `true` for a dispatch fault.
 */
export function isLlmDispatchFaultError(error: unknown): error is LlmDispatchFaultError {
  let result = error instanceof LlmDispatchFaultError;

  if (!result && error != null && typeof error === 'object') {
    const { name, fault } = error as { readonly name?: unknown; readonly fault?: unknown };
    result = name === 'LlmDispatchFaultError' && fault === 'unretryable';
  }

  return result;
}
