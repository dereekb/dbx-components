/**
 * The readiness vocabulary a strategy's `healthCheck` returns and every readiness aggregator reads: a severity, one
 * finding, and the verdict.
 *
 * Kept apart from the strategy contract so the contract and the provider-status module can both import it without
 * importing each other.
 */

import { type LlmStrategyId } from '../model/llm.value';

/**
 * Severity of a single {@link LlmStrategyHealthIssue}: a blocking `'error'` or an advisory `'warning'`.
 */
export type LlmStrategyHealthSeverity = 'error' | 'warning';

/**
 * One readiness finding from a strategy's `healthCheck`.
 */
export interface LlmStrategyHealthIssue {
  /**
   * `'error'` ⇒ blocks readiness; `'warning'` ⇒ advisory, never flips {@link LlmStrategyHealth.ready}.
   */
  readonly severity: LlmStrategyHealthSeverity;
  /**
   * A one-line, human-readable explanation (surfaced in the aggregated startup error / host log).
   */
  readonly message: string;
  /**
   * OPTIONAL identity of the specific UNDERLYING service this issue originated from — the child strategy's id. A
   * composite strategy wrapping several backends stamps the child's id, so a multi-issue verdict NAMES every
   * affected service rather than collapsing them into one opaque message. A LEAF strategy leaves it unset — there
   * the strategy id is already the `verifyLlmStrategies` report key. A nested composite preserves the deeper source
   * (it only stamps issues that arrive unattributed). Advisory attribution only; never a parsing contract.
   */
  readonly source?: LlmStrategyId;
}

/**
 * A strategy's self-reported readiness verdict. INVARIANT: `ready === false` carries ≥1 `'error'` issue;
 * `ready === true` MAY still carry `'warning'` issues (e.g. "using default model"). A `healthCheck` NEVER throws —
 * an internal failure is reported here as `{ ready: false }` + an `'error'` issue.
 */
export interface LlmStrategyHealth {
  /**
   * `true` exactly when the backend is usable for a real `complete` call.
   */
  readonly ready: boolean;
  /**
   * The findings — blocking errors and/or advisory warnings (empty ⇒ unconditionally ready).
   */
  readonly issues: ReadonlyArray<LlmStrategyHealthIssue>;
}
