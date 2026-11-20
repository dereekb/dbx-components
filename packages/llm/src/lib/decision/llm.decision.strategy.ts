/**
 * **The decision transport seam — a backend that answers DECLARED questions instead of writing text.**
 *
 * The decision sibling of {@link LlmStrategy}. The two cannot be one interface: `LlmStrategy.complete` is
 * documented *"raw assembled prompt in, the raw model text out"*, and a decision call is
 * `(state, questions) -> answers` with no prompt string and no reply text anywhere in it. So this is a second
 * transport KIND registered alongside the first, not a mode on it — the data genuinely diverges.
 *
 * Everything ELSE is deliberately shared. Both contracts extend {@link LlmStrategyBase} — identity (`id` / `kind`),
 * a description, and the two readiness seams — so one registry factory (`makeLlmStrategyRegistry`) builds a decision
 * registry too, an instance/transport split (`id` = the configured backend, `kind` = the wire protocol) reads
 * identically on both seams, and the readiness aggregators (`verifyLlmStrategies` / `probeLlmCredentials`, worded by
 * {@link LLM_DECISION_STRATEGY_READINESS_LANE}) serve both. Usage is reported as {@link LlmUsage}, so a decision call
 * folds into the same cost ledger as every completion with no new counting site.
 *
 * **The guarantee this seam carries:** an answer that left its declared answer space is a FAULT, not a value. The
 * vendor constrains the output, but a network response is still a network response — `readLlmDecisionAnswers`
 * membership-checks every answer against the question that asked it (the four `LlmDecisionFaultKind`s, a 0.05
 * distribution-sum tolerance), and a strategy throws `LlmDecisionAnswerFaultError` rather than returning, so no
 * consumer downstream re-checks.
 *
 * **What every transport shares lives HERE**, not on one of them: the per-call ceiling
 * ({@link DEFAULT_LLM_DECISION_TIMEOUT_MS}), the transport error ({@link LlmDecisionTransportError}) and the retry
 * classifier ({@link isRetryableLlmDecisionError}) the dispatcher's decision lane resends by. More than one gateway
 * serves the same TypeSafe route, so a 429 on one is a 429 on the other and the retry posture above them must not
 * drift. The System One transport (`makeLlmSystemOneDecisionStrategy`) enforces them for every such gateway.
 */

import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type LlmModelId } from '../model/llm.value';
import { type IsRetryableUnknownErrorFunction } from '@dereekb/util/fetch';
import { classifyLlmError, isLlmAbortError, isRetryableLlmErrorClassification } from '../strategy/llm.error';
import { LlmDecisionAnswerFaultError } from './llm.decision.answer';
import type { LlmCompleteOptions, LlmStrategyBase } from '../strategy/llm.strategy';
import type { LlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import type { LlmReadinessLane } from '../strategy/llm.strategy.readiness';
import type { LlmUsage } from '../strategy/llm.usage';
import { type LlmDecisionAnswers, LlmDecisionDeclarationError, type LlmDecisionQuestions, type LlmDecisionState } from './llm.decision.question';

/**
 * One decision call: a state, the questions to evaluate against it, and which model answers.
 *
 * The questions travel as a SET on purpose — the backend ingests the state once and evaluates every question
 * against it independently, so the set is both the batching unit and the cost unit.
 */
export interface LlmDecisionRequest<Q extends LlmDecisionQuestions = LlmDecisionQuestions> {
  /**
   * The content to judge.
   */
  readonly state: LlmDecisionState;
  /**
   * The declared questions.
   */
  readonly questions: Q;
  /**
   * The decision model that should answer.
   */
  readonly model: LlmModelId;
}

/**
 * Per-call options for {@link LlmDecisionStrategy.decide} — the completion lane's non-request concerns
 * ({@link LlmCompleteOptions}: the external cancellation `signal`, which a transport combines with its own per-call
 * timeout), plus the decision wall clock.
 */
export interface LlmDecideOptions extends LlmCompleteOptions {
  /**
   * The per-call wall clock. Omitted ⇒ the transport's own (by default {@link DEFAULT_LLM_DECISION_TIMEOUT_MS}).
   */
  readonly timeoutMs?: Milliseconds;
}

/**
 * What one decision call answered, and what it cost.
 *
 * `model` is the VERSIONED id that actually answered, which is not necessarily the one requested — an alias moves
 * when a release ships. Record it rather than the request's `model` whenever a reading is being compared across
 * runs, exactly as a run artifact records the resolved id rather than the configured one.
 */
export interface LlmDecisionResult<Q extends LlmDecisionQuestions = LlmDecisionQuestions> {
  /**
   * The versioned model id that actually answered.
   */
  readonly model: LlmModelId;
  /**
   * The answers, membership-checked against the declared questions.
   */
  readonly answers: LlmDecisionAnswers<Q>;
  /**
   * What the call cost, when the gateway reported it.
   */
  readonly usage?: LlmUsage;
  /**
   * The upstream endpoint that served it, when the gateway echoed one — the completion `provider` twin, so a
   * decision's telemetry row carries the same provenance a completion's does.
   */
  readonly provider?: string;
  /**
   * The gateway's own id for this call, when it returned one — what a telemetry row records as its
   * `generationId`, and the handle a cost reconciliation is looked up by.
   */
  readonly generationId?: string;
}

/**
 * A backend that answers declared questions — one configured instance of one decision transport. Its identity and
 * its two readiness seams (`healthCheck`, network-free; `credentialProbe`, networked) are {@link LlmStrategyBase}'s,
 * with the same contracts as on a completion strategy.
 */
export interface LlmDecisionStrategy extends LlmStrategyBase {
  /**
   * Run the call. Declared questions in, typed answers out.
   *
   * Throws rather than returning a partial result when the answers cannot be read: a decision whose answer space
   * was violated is not a decision, and a caller that wants a fallback expresses it as a verdict of its own rather
   * than by reading half an answer set.
   *
   * @param request - The state, the questions and the model.
   * @param options - Optional per-call concerns.
   * @returns The answers and the usage.
   */
  decide<Q extends LlmDecisionQuestions>(request: LlmDecisionRequest<Q>, options?: LlmDecideOptions): Promise<LlmDecisionResult<Q>>;
}

/**
 * A registry of {@link LlmDecisionStrategy}, keyed by its instance `id` — the decision lane's
 * {@link LlmStrategyRegistry}. Build one with `makeLlmStrategyRegistry(decisionStrategies)`.
 */
export type LlmDecisionStrategyRegistry = LlmStrategyRegistry<LlmDecisionStrategy>;

/**
 * The decision lane's wording for the readiness aggregators — pass it as `lane` to `verifyLlmStrategies` /
 * `probeLlmCredentials` over an {@link LlmDecisionStrategyRegistry}, so the report names a "decision strategy".
 */
export const LLM_DECISION_STRATEGY_READINESS_LANE: LlmReadinessLane = { singular: 'LLM decision strategy', plural: 'LLM decision strategies' };

/**
 * The per-call wall clock a decision is given, on every transport.
 *
 * The strategy contract declares the default; the System One transport (`makeLlmSystemOneDecisionStrategy`) enforces it,
 * merging a `makeTimeoutAbortSignal` timeout with the caller's signal. Generous against the documented ~114ms on
 * purpose: a decision sits on the latency-critical path, so what is worth tuning is the RETRY posture above it (the
 * dispatcher's bounded decision resend), not this ceiling. A call that has taken this long is not slow, it is broken.
 */
export const DEFAULT_LLM_DECISION_TIMEOUT_MS: Milliseconds = 10_000;

/**
 * Config for {@link LlmDecisionTransportError}.
 */
export interface LlmDecisionTransportErrorConfig {
  /**
   * The error message.
   */
  readonly message: string;
  /**
   * The HTTP status, when the route answered.
   */
  readonly status?: Maybe<number>;
  /**
   * The response body, when one was read.
   */
  readonly body?: Maybe<string>;
  /**
   * The response headers, when the route answered — the dispatcher's default transport backoff reads
   * `retry-after-ms` / `Retry-After` off them. Never persisted.
   */
  readonly headers?: Maybe<Headers>;
  /**
   * The failure this wraps (a socket error) — the ES2022 `Error.cause`.
   */
  readonly cause?: unknown;
}

/**
 * A non-2xx answer from a decision route, or a transport-level failure reaching it — whichever gateway served it.
 *
 * It carries `status` so the SHARED {@link classifyLlmError} can classify it — that classifier already reads a raw
 * `{status}`, so the decision lane inherits the completion lane's retry posture (408, 429 and the 5xx range retry;
 * a 400 never does) rather than declaring a second, drifting one.
 *
 * A transport-level failure has no status, so a transport wraps it with the socket error as its `cause` (the ES2022
 * `Error.cause`): {@link isRetryableLlmDecisionError} reads that cause, so a reset socket reads retryable.
 */
export class LlmDecisionTransportError extends Error {
  /**
   * The HTTP status, when the route answered.
   */
  readonly status: Maybe<number>;
  /**
   * The response body, when one was read.
   */
  readonly body: Maybe<string>;
  /**
   * The response headers, when the route answered (`retry-after-ms` / `Retry-After` live here). Never persisted.
   */
  readonly headers: Maybe<Headers>;

  constructor(config: LlmDecisionTransportErrorConfig) {
    // No `cause` class field: `useDefineForClassFields` would reset it to `undefined` after `super`.
    super(config.message, config.cause === undefined ? undefined : { cause: config.cause });
    this.name = 'LlmDecisionTransportError';
    this.status = config.status;
    this.body = config.body;
    this.headers = config.headers;
  }
}

/**
 * Whether a decision throw is worth another attempt — the SHARED classifier ({@link classifyLlmError}) and resend rule
 * ({@link isRetryableLlmErrorClassification}), so this lane and the completion lane cannot drift apart on what
 * "retryable" means: `transient` resends, `permanent` never does, and `unknown` resends only on the host's `true`.
 *
 * An abort or timeout, an answer fault ({@link LlmDecisionAnswerFaultError}) and a declaration fault
 * ({@link LlmDecisionDeclarationError}) are NEVER resent here and never reach `isRetryableUnknownError`.
 *
 * A STATUS-LESS {@link LlmDecisionTransportError} (the route was never reached) is classified by its `cause`: a
 * network failure (a reset, a `fetch failed`) retries, an abort cause never does. The host function receives the
 * THROWN error (the wrapper, which carries the cause).
 *
 * The rule the dispatcher's decision lane resends by (one bounded resend by default, `decisions.maxAttempts`). No
 * retry loop lives here: a direct `strategy.decide()` / `decision.decide()` is never retried.
 *
 * @param error - The thrown value.
 * @param isRetryableUnknownError - The host's call on an `unknown` error (`LlmDispatcherConfig.isRetryableUnknownError`).
 * @returns Whether to retry.
 */
export function isRetryableLlmDecisionError(error: unknown, isRetryableUnknownError?: Maybe<IsRetryableUnknownErrorFunction>): boolean {
  const subject = error instanceof LlmDecisionTransportError && error.status == null && error.cause != null ? error.cause : error;
  let retryable = false;

  if (!isLlmAbortError(error) && !isLlmAbortError(subject) && !(error instanceof LlmDecisionAnswerFaultError) && !(error instanceof LlmDecisionDeclarationError)) {
    retryable = isRetryableLlmErrorClassification(classifyLlmError(subject), error, isRetryableUnknownError);
  }

  return retryable;
}
