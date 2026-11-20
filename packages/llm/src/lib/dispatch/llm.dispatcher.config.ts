/**
 * The configuration of `makeLlmDispatcher` — the strategies and model routing it resolves against, the prompt pieces
 * it composes with, and the host hooks (recorder, taps, gaps, swallow sink, host record / result fields, pause and
 * cancellation) that replace a host's internals.
 */

import { type Maybe } from '@dereekb/util';
import { type IsRetryableUnknownErrorFunction } from '@dereekb/util/fetch';
import { type LlmCapabilityDescriptor, type LlmCapabilityDescriptorReader } from '../capability/llm.capability.descriptor';
import { type LlmDecisionDispatchRequest } from '../decision/llm.decision.descriptor';
import { type LlmDecisionStrategyRegistry } from '../decision/llm.decision.strategy';
import { type LlmModelProviderBindingMap } from '../model/config/llm.model.config.resolve';
import { type LlmCapabilityRoute, type LlmCompiledModelRouting } from '../model/llm.model.routing';
import { type LlmModelTierMap } from '../model/llm.model.tier';
import { type LlmCapabilityKey, type LlmModelId, type LlmModelTierKey, type LlmReasoningConfig, type LlmStrategyId } from '../model/llm.value';
import { type LlmModelVisionMap } from '../model/llm.model.wire';
import { type LlmPromptAssemblyTexts } from '../prompt/llm.prompt.assembly';
import { type LlmPromptCachePrefixWatch } from '../prompt/llm.prompt.cache.watch';
import { type LlmPromptContributor } from '../prompt/llm.prompt.contributor';
import { type LlmPromptLayout } from '../prompt/llm.prompt.layout';
import { type LlmPromptTemplateResolver } from '../prompt/llm.prompt.template';
import { type LlmCallContext, type LlmCallProfile } from '../record/llm.call.context';
import { type LlmCallHostFields, type LlmCallRecord, type LlmCallStartRecord, type LlmDecodeFailureRecord } from '../record/llm.call.record';
import { type LlmDispatchTapRegistry } from '../record/llm.dispatch.tap';
import { type LlmSwallowSink } from '../record/llm.swallow';
import { type LlmReplyEnvelopeKeys } from '../reply/llm.reply.envelope';
import { type LlmReplyFastFixer, type LlmReplyFastFixLimits } from '../reply/llm.reply.fast.fix';
import { type LlmReplyProtocol } from '../reply/llm.reply.protocol';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
import { type LlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { type LlmDispatchPauseSignal, type LlmDispatchTransportBackoff } from './llm.dispatch.control';
import { type LlmDispatchCorrectionTextOverrides } from './llm.dispatch.correction';
import { type LlmDispatchRequest } from './llm.dispatch.request';

/**
 * Which lane of a dispatcher a call runs on: a capability `completion` (`dispatch`) or a `decision` (`decide`).
 */
export type LlmDispatchLane = 'completion' | 'decision';

/**
 * The call a host hook is handed — the host's `R` on the completion lane, the decision request on the decision lane.
 * Narrow on `lane` before reading a lane-only request field; both requests share `LlmDispatchRequestBase`.
 *
 * @typeParam R - The host's request type.
 */
export type LlmDispatchLaneRequest<R extends LlmDispatchRequest = LlmDispatchRequest> =
  | {
      /**
       * The completion lane.
       */
      readonly lane: 'completion';
      /**
       * The request being dispatched.
       */
      readonly request: R;
    }
  | {
      /**
       * The decision lane.
       */
      readonly lane: 'decision';
      /**
       * The decision request, widened to the library type.
       */
      readonly request: LlmDecisionDispatchRequest;
    };

/**
 * The inputs of {@link LlmDispatchRecorder.newCallContext} — the lane and its request, plus the label and the
 * attribution override.
 *
 * @typeParam R - The host's request type.
 * @typeParam A - The call-context attribution type.
 */
export type LlmDispatchCallContextParams<R extends LlmDispatchRequest = LlmDispatchRequest, A extends object = object> = LlmDispatchLaneRequest<R> & {
  /**
   * The context's label — the capability (on a decision, the consuming capability).
   */
  readonly label: string;
  /**
   * The attribution override {@link LlmDispatcherConfig.callAttributionOf} returned, when it returned one.
   */
  readonly attribution?: Maybe<Partial<A>>;
};

/**
 * The host's call-record writer. Method syntax on purpose, so a host's narrower recorder stays assignable. The writer
 * owns any capture gate — the dispatcher always hands it the FULL record.
 *
 * @typeParam R - The host's request type.
 * @typeParam H - The host's top-level record fields.
 * @typeParam A - The call-context attribution type.
 */
export interface LlmDispatchRecorder<R extends LlmDispatchRequest = LlmDispatchRequest, H extends LlmCallHostFields = LlmCallHostFields, A extends object = object> {
  /**
   * Mint the ROOT call context of a call (a dispatch or a decision) that has no parent context of its own. Absent (or
   * no recorder) ⇒ a context that does not time.
   *
   * @param params - The lane and its request, the label and the attribution override.
   * @returns The dispatch's root call context.
   */
  newCallContext?(params: LlmDispatchCallContextParams<R, A>): LlmCallContext<A>;
  /**
   * Record that a call is about to be sent (before the first `strategy.complete` / `strategy.decide`).
   *
   * @param record - The start record.
   */
  recordCallStart?(record: LlmCallStartRecord<H>): void;
  /**
   * Record one completed call — one per execution, root or follow-up, and one per answered decision.
   *
   * @param record - The call record.
   */
  recordCall(record: LlmCallRecord<H>): void;
  /**
   * Record the one decode-failure record a dispatch with at least one decode row files.
   *
   * @param record - The decode-failure record.
   */
  recordDecodeFailure?(record: LlmDecodeFailureRecord<H>): void;
}

/**
 * A live-context block that looks like raw JSON reached a prompt (the descriptor did not declare `rawJsonContext`). The
 * prompt is still sent as assembled.
 */
export interface LlmDispatchRawJsonGap {
  readonly kind: 'prompt-raw-json';
  /**
   * The capability whose prompt carried it.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The FIRST offending block's key.
   */
  readonly block: string;
  /**
   * How many live blocks looked like raw JSON.
   */
  readonly blocks: number;
}

/**
 * A prompt's estimated tokens exceeded the request's `maxPromptTokens`. The call was still sent.
 */
export interface LlmDispatchOverBudgetGap {
  readonly kind: 'prompt-over-budget';
  /**
   * The capability whose prompt ran over.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The estimated prompt tokens (thread and schema included).
   */
  readonly estimatedPromptTokens: number;
  /**
   * The budget it ran over.
   */
  readonly maxPromptTokens: number;
}

/**
 * A root call's critic still rejected the reply when the attempt budget ran out — the rejected reply shipped anyway.
 */
export interface LlmDispatchCritiqueFailGap {
  readonly kind: 'critique-fail';
  /**
   * The critiqued capability.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The critic's LAST feedback.
   */
  readonly feedback: string;
  /**
   * The rejected reply that shipped.
   */
  readonly text: string;
}

/**
 * Something the dispatcher noticed that a host may want to file — never a reason to stop the call.
 */
export type LlmDispatchGap = LlmDispatchRawJsonGap | LlmDispatchOverBudgetGap | LlmDispatchCritiqueFailGap;

/**
 * The decision lane of a dispatcher — absent (or an empty registry) ⇒ the dispatcher has no `decide`.
 *
 * A decision shares the dispatcher's host hooks: its context is minted by `recorder.newCallContext` (or nests under
 * the request's `callContext`), and `callAttributionOf` / `recordFieldsOf` see it as `lane: 'decision'`.
 */
export interface LlmDispatcherDecisionConfig {
  /**
   * The decision strategies.
   */
  readonly strategies: LlmDecisionStrategyRegistry;
  /**
   * The strategy to serve decisions with. Absent ⇒ the first registered; named but unregistered ⇒ no lane.
   */
  readonly strategyId?: Maybe<LlmStrategyId>;
  /**
   * The decision model that replaces the default-tier rung — the model of a decision no per-call override, decision
   * route or descriptor names. A capability's COMPLETION route never serves its decisions (only a route that names a
   * decision model does), and a slug from any rung that is not a decision model throws before the decision is sent.
   * Refused at construction unless it is a decision model.
   */
  readonly defaultModel: LlmModelId;
  /**
   * Total sends one decision may make (the first plus resends). A send that fails with a retryable transport error
   * (`isRetryableLlmDecisionError`: a 408, a 429, a 5xx, a dropped socket, or an `unknown` error the dispatcher's
   * `isRetryableUnknownError` approved — never an abort, a timeout or an answer fault) is resent after the
   * dispatcher's `transportBackoff`. Absent ⇒ `DEFAULT_LLM_DISPATCH_MAX_ATTEMPTS` (2: one resend);
   * clamped to at least 1 (`1` never resends).
   */
  readonly maxAttempts?: Maybe<number>;
}

/**
 * The inputs of {@link LlmDispatcherConfig.onGap}.
 *
 * @typeParam R - The host's request type.
 * @typeParam A - The call-context attribution type.
 */
export interface LlmDispatchGapParams<R extends LlmDispatchRequest = LlmDispatchRequest, A extends object = object> {
  /**
   * The gap.
   */
  readonly gap: LlmDispatchGap;
  /**
   * The request it was noticed on.
   */
  readonly request: R;
  /**
   * The dispatch's call context — the host stamps its own gap meta from its attribution.
   */
  readonly callContext: LlmCallContext<A>;
}

/**
 * What a strategy selector sees.
 *
 * @typeParam R - The host's request type.
 */
export interface LlmDispatchStrategySelectorParams<R extends LlmDispatchRequest = LlmDispatchRequest> {
  /**
   * The request being dispatched.
   */
  readonly request: R;
  /**
   * The capability.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The RESOLVED (concrete) model slug.
   */
  readonly model: LlmModelId;
  /**
   * The resolved tier, when the model came from one.
   */
  readonly tier?: LlmModelTierKey;
  /**
   * The capability's route, when one is configured.
   */
  readonly route?: LlmCapabilityRoute;
}

/**
 * Picks the strategy id a dispatch is sent through.
 *
 * @typeParam R - The host's request type.
 */
export type LlmDispatchStrategySelector<R extends LlmDispatchRequest = LlmDispatchRequest> = (selection: LlmDispatchStrategySelectorParams<R>) => LlmStrategyId;

/**
 * The inputs of {@link LlmDispatcherConfig.callAttributionOf} — the lane and its request.
 *
 * @typeParam R - The host's request type.
 */
export type LlmDispatchCallAttributionParams<R extends LlmDispatchRequest = LlmDispatchRequest> = LlmDispatchLaneRequest<R>;

/**
 * The record a host-field read is for.
 */
export type LlmDispatchRecordKind = 'start' | 'call' | 'decode-failure';

/**
 * The inputs of {@link LlmDispatcherConfig.recordFieldsOf} — the lane and its request, plus the record kind and the
 * call context. A decision only ever asks for `kind: 'start' | 'call'`.
 *
 * @typeParam R - The host's request type.
 * @typeParam A - The call-context attribution type.
 */
export type LlmDispatchRecordFieldsParams<R extends LlmDispatchRequest = LlmDispatchRequest, A extends object = object> = LlmDispatchLaneRequest<R> & {
  /**
   * The record kind the fields are for.
   */
  readonly kind: LlmDispatchRecordKind;
  /**
   * The call's context.
   */
  readonly callContext: LlmCallContext<A>;
};

/**
 * The inputs of {@link LlmDispatcherConfig.resultOf}.
 *
 * @typeParam R - The host's request type.
 * @typeParam A - The call-context attribution type.
 */
export interface LlmDispatchResultParams<R extends LlmDispatchRequest = LlmDispatchRequest, A extends object = object> {
  /**
   * The library's dispatch result.
   */
  readonly result: LlmDispatchResult;
  /**
   * The request being dispatched.
   */
  readonly request: R;
  /**
   * The dispatch's call context.
   */
  readonly callContext: LlmCallContext<A>;
  /**
   * The dispatch's profile snapshot — present iff the call context times.
   */
  readonly callProfile?: Maybe<LlmCallProfile<A>>;
}

/**
 * The configuration of `makeLlmDispatcher`.
 *
 * @typeParam R - The host's request type.
 * @typeParam X - The host's dispatch result type.
 * @typeParam H - The host's top-level record fields.
 * @typeParam D - The host's capability descriptor type.
 * @typeParam A - The call-context attribution type.
 */
export interface LlmDispatcherConfig<R extends LlmDispatchRequest = LlmDispatchRequest, X extends LlmDispatchResult = LlmDispatchResult, H extends LlmCallHostFields = LlmCallHostFields, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor, A extends object = object> {
  // MARK: Resolve
  /**
   * The registered strategies. A dispatch whose selected id is not registered throws (never a fallback instance).
   */
  readonly strategies: LlmStrategyRegistry;
  /**
   * The strategy id of a dispatch no route or model binding claims.
   */
  readonly defaultStrategyId: LlmStrategyId;
  /**
   * The cap a dispatch SENDS when no route, descriptor or tier names one — the floor the retry ladder raises from.
   * Behind a dispatcher a strategy's own `maxOutputTokens` default never applies (every dispatched request names its
   * cap), so pass the cap the strategy would otherwise use (normally `DEFAULT_LLM_MAX_OUTPUT_TOKENS`) to send the
   * same `max_tokens` a direct strategy call sends.
   */
  readonly defaultMaxOutputTokens: number;
  /**
   * The tier map. Must hold {@link defaultTier} — checked at construction.
   */
  readonly modelTiers: LlmModelTierMap;
  /**
   * The default tier. Trimmed; blank or absent ⇒ `DEFAULT_LLM_MODEL_TIER` (`resolveLlmDefaultModelTierKey`).
   */
  readonly defaultTier?: Maybe<LlmModelTierKey>;
  /**
   * The compiled per-capability routes.
   */
  readonly capabilityRoutes?: Maybe<LlmCompiledModelRouting>;
  /**
   * Per-slug provider bindings (route provider › per-slug binding › {@link defaultStrategyId}).
   */
  readonly providerByModel?: Maybe<LlmModelProviderBindingMap>;
  /**
   * Replaces the default strategy policy entirely. Completion lane only: a decision is served by the decision block's
   * own strategy.
   */
  readonly selectStrategy?: Maybe<LlmDispatchStrategySelector<R>>;
  /**
   * The reasoning floor. Defaults to `LLM_REASONING_OFF`.
   */
  readonly reasoningDefault?: Maybe<LlmReasoningConfig>;
  /**
   * Per-slug vision flags — read by `capabilityVision`.
   */
  readonly visionByModel?: Maybe<LlmModelVisionMap>;
  // MARK: Compose
  /**
   * Looks up a capability's descriptor (absent ⇒ an unregistered capability).
   */
  readonly descriptorOf: LlmCapabilityDescriptorReader<D>;
  /**
   * Resolves the prompt templates of a call.
   */
  readonly templateResolver: LlmPromptTemplateResolver<R, D>;
  /**
   * The prompt layout. Defaults to `DEFAULT_LLM_PROMPT_LAYOUT`.
   */
  readonly layout?: Maybe<LlmPromptLayout>;
  /**
   * The prompt contributors, in placement order. Defaults to none.
   */
  readonly contributors?: Maybe<ReadonlyArray<LlmPromptContributor<R, D>>>;
  /**
   * Overrides of the library's prompt texts.
   */
  readonly texts?: Maybe<Partial<LlmPromptAssemblyTexts>>;
  /**
   * The reply protocol of a call that names none and whose descriptor names none.
   */
  readonly defaultReplyProtocol?: Maybe<LlmReplyProtocol>;
  /**
   * The envelope keys a `json-envelope` reply is read through. Defaults to `DEFAULT_LLM_REPLY_ENVELOPE_KEYS`.
   */
  readonly replyEnvelope?: Maybe<LlmReplyEnvelopeKeys>;
  /**
   * The cache-prefix watch. Defaults to one per dispatcher.
   */
  readonly promptCacheWatch?: Maybe<LlmPromptCachePrefixWatch>;
  /**
   * The cache-watch partition of a request (one baseline per capability per partition) — also the `partition` field of
   * the dispatcher's breadcrumbs.
   */
  readonly cachePartitionOf?: Maybe<(request: R) => Maybe<string | number>>;
  /**
   * Whether a live-context block looks like raw JSON. Absent ⇒ no raw-JSON watch.
   */
  readonly isRawJsonBlock?: Maybe<(text: string) => boolean>;
  // MARK: Follow-ups
  /**
   * The assistant turn a degenerate reply is replayed as. Defaults to `DEFAULT_LLM_DEGENERATE_THREAD_PLACEHOLDER`.
   */
  readonly degenerateThreadPlaceholder?: Maybe<string>;
  /**
   * The cap on a replayed assistant turn. Defaults to `DEFAULT_LLM_THREAD_TURN_MAX_CHARS`.
   */
  readonly threadTurnMaxChars?: Maybe<number>;
  // MARK: Record
  /**
   * The host's call-record writer — serves both lanes: a decision writes its start and call records here too.
   */
  readonly recorder?: Maybe<LlmDispatchRecorder<R, H, A>>;
  /**
   * The live taps — held by reference, so a tap attached after construction is seen. A decision fires `onDispatch`
   * and `onDispatchComplete` too (never `onDecodeFailure`).
   */
  readonly taps?: Maybe<LlmDispatchTapRegistry<H>>;
  /**
   * Receives every gap the dispatcher notices. Completion lane only.
   */
  readonly onGap?: Maybe<(params: LlmDispatchGapParams<R, A>) => void>;
  /**
   * Where a call (a dispatch or a decision) with no call context of its own reports its swallows.
   */
  readonly swallow?: Maybe<LlmSwallowSink>;
  /**
   * The attribution override of a call's context — called once per dispatch and once per decision, with the lane.
   */
  readonly callAttributionOf?: Maybe<(params: LlmDispatchCallAttributionParams<R>) => Maybe<Partial<A>>>;
  /**
   * The host's top-level fields of each record kind — called at most once per kind per dispatch or decision, with the
   * lane. Absent ⇒ none.
   */
  readonly recordFieldsOf?: Maybe<(params: LlmDispatchRecordFieldsParams<R, A>) => H>;
  /**
   * Builds the returned result. Absent ⇒ the library result as `X` — a host whose `X` adds required fields passes
   * this. Must keep `text` (a chained follow-up replays it). Completion lane only: a decision returns its answers.
   */
  readonly resultOf?: Maybe<(params: LlmDispatchResultParams<R, A>) => X>;
  // MARK: Retry
  /**
   * The tier a decode-class retry escalates the model to. Absent or blank ⇒ `DEFAULT_LLM_DECODE_RETRY_TIER` when the
   * tier map holds it; an off value (`off` / `none`, any case — `LLM_OFF_VALUES`) pins the model rung off; an explicit
   * key missing from the map throws at construction.
   */
  readonly decodeRetryTier?: Maybe<LlmModelTierKey>;
  /**
   * Overrides of the reprompt correction words, merged over `DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS`.
   */
  readonly correctionTexts?: Maybe<LlmDispatchCorrectionTextOverrides>;
  /**
   * The wait before a transport resend, on either lane (a completion's or a decision's), handed the failed attempt and
   * what its send threw (`{ attempt, error }`). Defaults to `llmTransportBackoffMs`: the server's `retry-after-ms` /
   * `Retry-After` when the error carries one of at most `LLM_TRANSPORT_RETRY_AFTER_MAX_MS`, else a jittered
   * exponential step.
   */
  readonly transportBackoff?: Maybe<LlmDispatchTransportBackoff>;
  /**
   * Decides a send error the classifier (`classifyLlmError`) reads as `unknown` — on either lane. `true` resends it as
   * a transport failure under the attempt budget; `false` or no answer fails the call at once (a completion rejects
   * with `LlmDispatchFaultError` after the call is recorded; a decision rethrows its error). Never asked about a
   * `transient` error (always resent) or a `permanent` one (never resent), nor on the single-shot path (which never
   * resends). Must not throw: a throw propagates unchanged.
   */
  readonly isRetryableUnknownError?: Maybe<IsRetryableUnknownErrorFunction>;
  // MARK: Lanes
  /**
   * The fast-fix tier of the reply-repair lane — one cheap repair call on a mangled JSON reply before any re-ask.
   * Absent ⇒ the deterministic tier only.
   */
  readonly replyFastFix?: Maybe<LlmReplyFastFixer<R, X>>;
  /**
   * The fast-fix limits, merged over `DEFAULT_LLM_REPLY_FAST_FIX_LIMITS`.
   */
  readonly fastFixLimits?: Maybe<Partial<LlmReplyFastFixLimits>>;
  /**
   * The decision lane. Absent (or an empty registry) ⇒ no `decide`.
   */
  readonly decisions?: Maybe<LlmDispatcherDecisionConfig>;
  // MARK: Control
  /**
   * The host pause gate.
   */
  readonly pause?: Maybe<LlmDispatchPauseSignal>;
  /**
   * The dispatcher-wide cancellation signal, combined with each request's own `signal`.
   */
  readonly cancellationSignal?: Maybe<AbortSignal>;
}
