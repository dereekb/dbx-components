/**
 * **The decision transport seam — a backend that answers DECLARED questions instead of writing text.**
 *
 * The decision sibling of {@link LlmStrategy}. The two cannot be one interface: `LlmStrategy.complete` is
 * documented *"raw assembled prompt in, the raw model text out"*, and a decision call is
 * `(state, questions) -> answers` with no prompt string and no reply text anywhere in it. So this is a second
 * transport KIND registered alongside the first, not a mode on it — the data genuinely diverges.
 *
 * Everything ELSE is deliberately shared. Usage is reported as {@link LlmUsage}, so a decision call folds into the
 * same cost ledger as every completion with no new counting site. Ids are {@link LlmStrategyId} and the registry is
 * the same `createKeyedRegistry` shape, so an instance/transport split (`id` = the configured backend, `kind` = the
 * wire protocol) reads identically on both seams. Readiness is the same {@link LlmStrategyHealth} verdict, so one
 * aggregator serves both.
 *
 * **The guarantee this seam carries:** an answer that left its declared answer space is a FAULT, not a value. The
 * vendor constrains the output, but a network response is still a network response — `readLlmDecisionAnswers`
 * membership-checks every answer against the question that asked it (the four `LlmDecisionFaultKind`s, a 0.05
 * distribution-sum tolerance), and a strategy throws `LlmDecisionAnswerFaultError` rather than returning, so no
 * consumer downstream re-checks.
 *
 * **What every transport shares lives HERE**, not on one of them: the per-call ceiling
 * ({@link DEFAULT_LLM_DECISION_TIMEOUT_MS}), the transport error ({@link LlmDecisionTransportError}) and the retry
 * classifier ({@link isRetryableLlmDecisionError}). More than one gateway serves the same TypeSafe route, so a 429
 * on one is a 429 on the other and the retry posture above them must not drift.
 */

import { createKeyedRegistry, type KeyedRegistry, type Maybe, type Milliseconds } from '@dereekb/util';
import { type LlmModelId, type LlmStrategyId } from '../model/llm.value';
import { isAbortError, isRetryableLlmError } from '../strategy/llm.error';
import type { LlmCredentialProbeOptions, LlmStrategy } from '../strategy/llm.strategy';
import type { LlmStrategyHealth } from '../strategy/llm.strategy.health';
import type { LlmUsage } from '../strategy/llm.usage';
import type { LlmDecisionAnswers, LlmDecisionQuestions, LlmDecisionState } from './llm.decision.question';

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
 * Per-call options for {@link LlmDecisionStrategy.decide} — non-request concerns, the `LlmCompleteOptions`
 * precedent.
 */
export interface LlmDecideOptions {
  /**
   * An EXTERNAL cancellation signal. A transport combines it with its own per-call timeout.
   */
  readonly signal?: AbortSignal;
  /**
   * The per-call wall clock. Omitted ⇒ {@link DEFAULT_LLM_DECISION_TIMEOUT_MS}.
   */
  readonly timeout?: Milliseconds;
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
 * A backend that answers declared questions — one configured instance of one decision transport.
 */
export interface LlmDecisionStrategy {
  /**
   * The INSTANCE id the registry keys on and a provider binding names.
   */
  readonly id: LlmStrategyId;
  /**
   * The TRANSPORT this instance is served by (the wire protocol). Absent means {@link id} is also the kind, which
   * is true of a single-instance strategy and of every hand-built fake.
   */
  readonly kind?: LlmStrategyId;
  /**
   * A one-line description, surfaced when listing strategies and on an unknown-id error.
   */
  readonly describe: string;
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
  /**
   * OPTIONAL startup readiness probe — does THIS backend have what it needs to serve a real call? Each strategy
   * checks its OWN deps, so the caller never learns a transport's configuration rules.
   *
   * NETWORK-FREE by contract, exactly as its completion twin ({@link LlmStrategy.healthCheck}) is: it answers "is
   * this constructible", never "is this key live", and it reports rather than throws. The verdict is the same
   * {@link LlmStrategyHealth} shape, so one readiness aggregator serves completion and decision strategies alike.
   *
   * @returns This backend's readiness verdict.
   */
  healthCheck?(): Promise<LlmStrategyHealth>;
  /**
   * OPTIONAL live CREDENTIAL probe — the deliberately-NETWORKED other half of {@link healthCheck}, and the one gate
   * that catches a well-formed-but-REVOKED key before it degrades a whole armed run. Reports rather than throws,
   * the {@link LlmStrategy.credentialProbe} contract.
   *
   * @param options - The optional cancellation signal.
   * @returns The credential verdict.
   */
  credentialProbe?(options?: LlmCredentialProbeOptions): Promise<LlmStrategyHealth>;
}

/**
 * A {@link KeyedRegistry} of {@link LlmDecisionStrategy}, keyed by its instance `id`.
 */
export type LlmDecisionStrategyRegistry = KeyedRegistry<LlmDecisionStrategy, LlmStrategyId>;

/**
 * Build an {@link LlmDecisionStrategyRegistry} — the same id-keyed, last-wins shape as `makeLlmStrategyRegistry`, so an
 * id lookup reads identically on both seams.
 *
 * "Every instance of a transport" is `values().filter((strategy) => llmStrategyKind(strategy) === kind)`, and its
 * `.at(-1)` is the LAST registered instance of that kind. A host whose default is "the first configured strategy"
 * reads `values()[0]` instead.
 *
 * @param seed - The strategies to seed the registry with.
 * @returns The strategy registry.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmDecisionStrategyRegistry(seed: ReadonlyArray<LlmDecisionStrategy>): LlmDecisionStrategyRegistry {
  return createKeyedRegistry<LlmDecisionStrategy, LlmStrategyId>({ readKey: (strategy) => strategy.id, seed });
}

/**
 * The per-call wall clock a decision is given, on every transport.
 *
 * The strategy contract declares the default; each transport enforces it, merging a `makeTimeoutAbortSignal` timeout with the
 * caller's signal. Generous against the documented ~114ms on purpose: a decision sits on the latency-critical
 * path, so what is worth tuning is the RETRY posture above it, not this ceiling. A call that has taken this long
 * is not slow, it is broken.
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
   * The failure this wraps (a socket error) — the ES2022 `Error.cause`.
   */
  readonly cause?: unknown;
}

/**
 * A non-2xx answer from a decision route, or a transport-level failure reaching it — whichever gateway served it.
 *
 * It carries `status` so the SHARED {@link isRetryableLlmError} can classify it — that classifier already tolerates
 * a raw `{status}`, so the decision lane inherits the completion lane's retry posture (429 and the 5xx range retry;
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

  constructor(config: LlmDecisionTransportErrorConfig) {
    // No `cause` class field: `useDefineForClassFields` would reset it to `undefined` after `super`.
    super(config.message, config.cause === undefined ? undefined : { cause: config.cause });
    this.name = 'LlmDecisionTransportError';
    this.status = config.status;
    this.body = config.body;
  }
}

/**
 * Whether a decision throw is worth another attempt — the SHARED classifier, so this lane and the completion lane
 * cannot drift apart on what "retryable" means. An abort is never retryable here: the caller cancelled.
 *
 * A STATUS-LESS {@link LlmDecisionTransportError} (the route was never reached) is classified by its `cause`: a
 * retryable socket failure (a reset, a `fetch failed`) retries, an abort cause never does.
 *
 * No retry loop lives here; a caller or dispatcher decides whether to resend.
 *
 * @param error - The thrown value.
 * @returns Whether to retry.
 */
export function isRetryableLlmDecisionError(error: unknown): boolean {
  return !isAbortError(error) && (isRetryableLlmError(error) || (error instanceof LlmDecisionTransportError && error.status == null && error.cause != null && !isAbortError(error.cause) && isRetryableLlmError(error.cause)));
}
