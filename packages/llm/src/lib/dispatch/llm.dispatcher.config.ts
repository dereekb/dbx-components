/**
 * The configuration of `makeLlmDispatcher` — the strategies and model routing it resolves against, the prompt pieces
 * it composes with, and the host hooks (recorder, taps, gaps, swallow sink, host record / result fields, pause and
 * cancellation) that replace a host's internals.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmCapabilityDescriptor, type LlmCapabilityDescriptorOf } from '../capability/llm.capability.descriptor';
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
 * The inputs of {@link LlmDispatchRecorder.newCallContext}.
 *
 * @typeParam R - The host's request type.
 * @typeParam A - The call-context attribution type.
 */
export interface LlmDispatchCallContextParams<R extends LlmDispatchRequest = LlmDispatchRequest, A extends object = object> {
  /**
   * The context's label — the capability.
   */
  readonly label: string;
  /**
   * The request being dispatched.
   */
  readonly request: R;
  /**
   * The attribution override {@link LlmDispatcherConfig.callAttributionOf} returned, when it returned one.
   */
  readonly attribution?: Maybe<Partial<A>>;
}

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
   * Mint the ROOT call context of a dispatch that has no parent context of its own. Absent (or no recorder) ⇒ a
   * context that does not time.
   *
   * @param params - The label, the request and the attribution override.
   * @returns The dispatch's root call context.
   */
  newCallContext?(params: LlmDispatchCallContextParams<R, A>): LlmCallContext<A>;
  /**
   * Record that a call is about to be sent (before the first `strategy.complete`).
   *
   * @param record - The start record.
   */
  recordCallStart?(record: LlmCallStartRecord<H>): void;
  /**
   * Record one completed call — one per execution, root or follow-up.
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
 * The inputs of {@link LlmDispatcherDecisionConfig.newCallContext}.
 */
export interface LlmDispatchDecisionCallContextParams {
  /**
   * The context label (the consuming capability).
   */
  readonly label: string;
  /**
   * The decision request, widened to the library type.
   */
  readonly request: LlmDecisionDispatchRequest;
}

/**
 * The inputs of {@link LlmDispatcherDecisionConfig.recordFieldsOf}.
 */
export interface LlmDispatchDecisionRecordFieldsParams<A extends object = object> {
  /**
   * Which record the fields are for.
   */
  readonly kind: 'start' | 'call';
  /**
   * The decision request, widened to the library type.
   */
  readonly request: LlmDecisionDispatchRequest;
  /**
   * The decision's call context.
   */
  readonly callContext: LlmCallContext<A>;
}

/**
 * The decision lane of a dispatcher — absent (or an empty registry) ⇒ the dispatcher has no `decide`.
 */
export interface LlmDispatcherDecisionConfig<H extends LlmCallHostFields = LlmCallHostFields, A extends object = object> {
  /**
   * The decision strategies.
   */
  readonly strategies: LlmDecisionStrategyRegistry;
  /**
   * The strategy to serve decisions with. Absent ⇒ the first registered; named but unregistered ⇒ no lane.
   */
  readonly strategyId?: Maybe<LlmStrategyId>;
  /**
   * The decision model that replaces ONLY the default-tier rung (a text tier's slug never reaches a decision strategy).
   * Refused at construction unless it is a decision model.
   */
  readonly defaultModel: LlmModelId;
  /**
   * Mints a decision's root call context. Absent ⇒ a context that does not time (reporting its swallows to the
   * dispatcher's `swallow` sink).
   */
  readonly newCallContext?: Maybe<(params: LlmDispatchDecisionCallContextParams) => LlmCallContext<A>>;
  /**
   * The host's top-level fields of a decision's start / call record.
   */
  readonly recordFieldsOf?: Maybe<(params: LlmDispatchDecisionRecordFieldsParams<A>) => H>;
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
export interface LlmDispatchStrategySelection<R extends LlmDispatchRequest = LlmDispatchRequest> {
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
export type LlmDispatchStrategySelector<R extends LlmDispatchRequest = LlmDispatchRequest> = (selection: LlmDispatchStrategySelection<R>) => LlmStrategyId;

/**
 * The inputs of {@link LlmDispatcherConfig.callAttributionOf}.
 *
 * @typeParam R - The host's request type.
 */
export interface LlmDispatchCallAttributionParams<R extends LlmDispatchRequest = LlmDispatchRequest> {
  /**
   * The request being dispatched.
   */
  readonly request: R;
}

/**
 * The record a host-field read is for.
 */
export type LlmDispatchRecordKind = 'start' | 'call' | 'decode-failure';

/**
 * The inputs of {@link LlmDispatcherConfig.recordFieldsOf}.
 *
 * @typeParam R - The host's request type.
 * @typeParam A - The call-context attribution type.
 */
export interface LlmDispatchRecordFieldsParams<R extends LlmDispatchRequest = LlmDispatchRequest, A extends object = object> {
  /**
   * The record kind the fields are for.
   */
  readonly kind: LlmDispatchRecordKind;
  /**
   * The request being dispatched.
   */
  readonly request: R;
  /**
   * The dispatch's call context.
   */
  readonly callContext: LlmCallContext<A>;
}

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
   * The completion budget of a call whose descriptor / route / tier names none — the floor the retry ladder raises
   * from.
   */
  readonly defaultMaxOutputTokens: number;
  /**
   * The tier map. Must hold {@link defaultTier} — checked at construction.
   */
  readonly modelTiers: LlmModelTierMap;
  /**
   * The default tier. Defaults to `DEFAULT_LLM_MODEL_TIER`.
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
   * Replaces the default strategy policy entirely.
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
  readonly descriptorOf: LlmCapabilityDescriptorOf<D>;
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
   * The host's call-record writer.
   */
  readonly recorder?: Maybe<LlmDispatchRecorder<R, H, A>>;
  /**
   * The live taps — held by reference, so a tap attached after construction is seen.
   */
  readonly taps?: Maybe<LlmDispatchTapRegistry<H>>;
  /**
   * Receives every gap the dispatcher notices.
   */
  readonly onGap?: Maybe<(params: LlmDispatchGapParams<R, A>) => void>;
  /**
   * Where a dispatch with no call context of its own reports its swallows.
   */
  readonly swallow?: Maybe<LlmSwallowSink>;
  /**
   * The attribution override of a dispatch's call context — called once per dispatch.
   */
  readonly callAttributionOf?: Maybe<(params: LlmDispatchCallAttributionParams<R>) => Maybe<Partial<A>>>;
  /**
   * The host's top-level fields of each record kind — called at most once per kind per dispatch. Absent ⇒ none.
   */
  readonly recordFieldsOf?: Maybe<(params: LlmDispatchRecordFieldsParams<R, A>) => H>;
  /**
   * Builds the returned result. Absent ⇒ the library result as `X` — a host whose `X` adds required fields passes
   * this. Must keep `text` (a chained follow-up replays it).
   */
  readonly resultOf?: Maybe<(params: LlmDispatchResultParams<R, A>) => X>;
  // MARK: Retry
  /**
   * The tier a decode-class retry escalates the model to. Absent ⇒ `DEFAULT_LLM_DECODE_RETRY_TIER` when the tier map
   * holds it; `LLM_DECODE_RETRY_TIER_OFF` pins the model rung off; an explicit key missing from the map throws at
   * construction.
   */
  readonly decodeRetryTier?: Maybe<LlmModelTierKey>;
  /**
   * Overrides of the reprompt correction words, merged over `DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS`.
   */
  readonly correctionTexts?: Maybe<LlmDispatchCorrectionTextOverrides>;
  /**
   * The wait before a transport resend. Defaults to `llmTransportBackoffMs`.
   */
  readonly transportBackoff?: Maybe<LlmDispatchTransportBackoff>;
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
  readonly decisions?: Maybe<LlmDispatcherDecisionConfig<H, A>>;
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
