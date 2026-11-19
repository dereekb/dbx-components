/**
 * `makeLlmDispatcher` — the library dispatcher: resolve → compose → send → decode → validate → record → follow-ups.
 *
 * Every call (root or chained follow-up) runs the same pipeline: mint the per-call context, park on the host pause
 * gate, resolve the model and strategy, compose the request, record the send, run the attempt stage (single-shot, or
 * the validated path when the call sets a `validate` / `critique`), record the call, and report the thread turn.
 */

import { type Maybe, mergeObjects } from '@dereekb/util';
import { type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { llmCapabilityVisionOf, LLM_REASONING_OFF } from '../model/llm.model.precedence';
import { resolveLlmDefaultModelTierKey, resolveLlmModelTier } from '../model/llm.model.tier';
import { DEFAULT_LLM_PROMPT_LAYOUT, type LlmPromptSlotRole, llmPromptSlotsOfRole, type LlmPromptLayout, type LlmPromptSlotId } from '../prompt/llm.prompt.layout';
import { makeLlmPromptCachePrefixWatch } from '../prompt/llm.prompt.cache.watch';
import { type LlmPromptRunParams, type LlmPromptRunResult, makeLlmPromptFactory } from '../prompt/llm.prompt.thread';
import { type LlmCallContext } from '../record/llm.call.context';
import { type LlmCallHostFields } from '../record/llm.call.record';
import { DEFAULT_LLM_REPLY_FAST_FIX_LIMITS, type LlmReplyFastFixLimits } from '../reply/llm.reply.fast.fix';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
import { llmBoundReplyFastFixOf } from './llm.dispatch.attempt';
import { llmDispatchCorrectionTextsOf } from './llm.dispatch.correction';
import { makeLlmDispatchDecisionLane } from './llm.dispatch.decision';
import { llmDecodeRetryModelOf } from './llm.dispatch.ladder';
import { type LlmDispatchRequest } from './llm.dispatch.request';
import { composeLlmDispatch, type LlmDispatchComposeSetup } from './llm.dispatch.compose';
import { isLlmDispatchCancelled, llmDispatchFallbackCallContextOf, llmDispatchSignalOf, llmTransportBackoffMs, parkLlmDispatchWhilePaused } from './llm.dispatch.control';
import { llmDispatchRecordFieldsOf, type LlmDispatchRecordSinks, isLlmDispatchTapsActive, recordLlmDispatch, recordLlmDispatchStart } from './llm.dispatch.record';
import { llmDispatchStrategySelectorOf, type LlmDispatchResolveSetup, resolveLlmDispatch } from './llm.dispatch.resolve';
import { type LlmDispatchAttemptsConfig, llmDispatchMaxAttemptsOf, runLlmDispatchAttempts, runSingleShotLlmDispatch } from './llm.dispatch.run';
import { type LlmDispatcher } from './llm.dispatcher';
import { type LlmDispatcherConfig, type LlmDispatchGap } from './llm.dispatcher.config';

/**
 * The id of a layout's first slot of `role`, else `fallback`.
 *
 * @param layout - The layout.
 * @param role - The slot role.
 * @param fallback - The id when the layout declares no such slot.
 * @returns The slot id.
 */
function llmPromptSlotIdOfRole(layout: LlmPromptLayout, role: LlmPromptSlotRole, fallback: LlmPromptSlotId): LlmPromptSlotId {
  return llmPromptSlotsOfRole(layout, role)[0]?.id ?? fallback;
}

/**
 * Build the library dispatcher.
 *
 * Construction resolves the default tier's slug (a tier map missing its default tier throws HERE), the decode-retry
 * tier's slug (an explicit unknown key throws HERE), the correction words, the layout's `follow-up` / `model-addendum`
 * / `correction` / `live` slot ids, the cache watch, the strategy selector and the decision lane (a `defaultModel` that
 * is not a decision model throws HERE). The recorder, the taps and the pause gate are held by reference.
 *
 * Attempts: a call with neither `validate` nor `critique` is single-shot (the result returned unchanged); a call with
 * either runs the BOUNDED retry loop — up to `maxAttempts` (default 2) attempts, each rejection re-asking with a
 * correction and one lever of the retry ladder, the fast-fix tier of the reply-repair lane when `replyFastFix` is
 * configured, and the request's critic after `validate` passes (root calls only).
 *
 * @param config - The strategies, model routing, prompt pieces and host hooks.
 * @returns The dispatcher.
 * @throws {Error} When the tier map does not hold the default tier or an explicit decode-retry tier, or when the
 *   decision lane's `defaultModel` is not a decision model.
 *
 * @example
 * ```ts
 * const dispatcher = makeLlmDispatcher({
 *   strategies: makeLlmStrategyRegistry([strategy]),
 *   defaultStrategyId: strategy.id,
 *   defaultMaxOutputTokens: DEFAULT_LLM_MAX_OUTPUT_TOKENS,
 *   modelTiers: { fast: 'acme/fast', strong: 'acme/strong' },
 *   descriptorOf: (capability) => DESCRIPTORS[capability],
 *   templateResolver: tieredLlmPromptTemplateResolver({ tiers: [{ source: 'defaults', templates }] })
 * });
 * const result = await dispatcher.dispatch({ capability: 'summarize', renderLiveContext: () => blocks });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmDispatcher<R extends LlmDispatchRequest = LlmDispatchRequest, X extends LlmDispatchResult = LlmDispatchResult, H extends LlmCallHostFields = LlmCallHostFields, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor, A extends object = object>(
  config: LlmDispatcherConfig<R, X, H, D, A>
): LlmDispatcher<R, X> {
  const { strategies, modelTiers, capabilityRoutes, descriptorOf, recorder, taps, pause, cancellationSignal, swallow, visionByModel } = config;
  const defaultTier = resolveLlmDefaultModelTierKey(config.defaultTier);
  const defaultTierModel = resolveLlmModelTier(modelTiers, defaultTier);
  const layout = config.layout ?? DEFAULT_LLM_PROMPT_LAYOUT;
  const resolveSetup: LlmDispatchResolveSetup<R, D> = {
    strategies,
    selectStrategy: llmDispatchStrategySelectorOf<R>({ selectStrategy: config.selectStrategy, providerByModel: config.providerByModel, defaultStrategyId: config.defaultStrategyId }),
    descriptorOf,
    capabilityRoutes,
    modelTiers,
    defaultTier,
    defaultTierModel,
    reasoningDefault: config.reasoningDefault ?? LLM_REASONING_OFF
  };
  const composeSetup: LlmDispatchComposeSetup<R, D> = {
    descriptorOf,
    templateResolver: config.templateResolver,
    layout,
    contributors: config.contributors,
    texts: config.texts,
    defaultReplyProtocol: config.defaultReplyProtocol,
    followUpSlotId: llmPromptSlotIdOfRole(layout, 'follow-up', 'follow-up'),
    modelAddendumSlotId: llmPromptSlotIdOfRole(layout, 'model-addendum', 'model-addendum'),
    promptCacheWatch: config.promptCacheWatch ?? makeLlmPromptCachePrefixWatch(),
    isRawJsonBlock: config.isRawJsonBlock
  };
  const escalateModel = llmDecodeRetryModelOf({ modelTiers, decodeRetryTier: config.decodeRetryTier });
  const corrections = llmDispatchCorrectionTextsOf(config.correctionTexts);
  const correctionSlotId = llmPromptSlotIdOfRole(layout, 'correction', 'correction');
  // mergeObjects: an explicit `undefined` override keeps its default (a spread would erase it).
  const fastFixLimits = mergeObjects<LlmReplyFastFixLimits>([DEFAULT_LLM_REPLY_FAST_FIX_LIMITS, config.fastFixLimits]);
  const transportBackoff = config.transportBackoff ?? llmTransportBackoffMs;
  // the fast fixer reaches the dispatcher through this holder, so a fixer call is an ordinary, recorded dispatch
  const selfDispatch: { dispatch: (request: R) => Promise<X> } = { dispatch: () => Promise.reject(new Error('llm dispatcher: dispatched before construction completed')) };
  const decisionLane = makeLlmDispatchDecisionLane<H, A>({ decisions: config.decisions, modelTiers, defaultTier, capabilityRoutes, recorder, pause, cancellationSignal, swallow, liveSlotId: llmPromptSlotIdOfRole(layout, 'live', 'live') });

  /**
   * Mint one dispatch's call context — nested under the request's parent, else the recorder's root, else a context
   * that does not time (reporting its swallows to the host sink when one is configured).
   *
   * @param request - The request.
   * @returns The call context.
   */
  function callContextOf(request: R): LlmCallContext<A> {
    const label = request.capability;
    const attribution = config.callAttributionOf?.({ request }) ?? undefined;
    const parented = request.callContext?.child(label, attribution == null ? undefined : { attribution }) as Maybe<LlmCallContext<A>>;
    let callContext: Maybe<LlmCallContext<A>> = parented ?? recorder?.newCallContext?.({ label, request, attribution });

    if (callContext == null) {
      callContext = llmDispatchFallbackCallContextOf<A>({ label, swallow, attribution: attribution as Maybe<A> });
    }

    return callContext;
  }

  const runPromptRequest = async (params: LlmPromptRunParams<R>): Promise<LlmPromptRunResult<X>> => {
    const { request, thread, followUp } = params;
    const capability = request.capability;
    const callContext = callContextOf(request);
    const partition = config.cachePartitionOf?.(request) ?? undefined;
    const signals = { cancellationSignal, request };
    const signal = llmDispatchSignalOf(signals);
    const onGap = (gap: LlmDispatchGap) => config.onGap?.({ gap, request, callContext });

    if (await parkLlmDispatchWhilePaused({ pause, signal, callContext })) {
      callContext.diag({ level: 'debug', code: 'llm-call-parked', fields: { capability, ...(partition == null ? {} : { partition }) }, message: 'dispatch parked on the host pause gate before sending' });
    }

    const resolved = resolveLlmDispatch<R, D>({ setup: resolveSetup, request, callContext });
    const composed = await composeLlmDispatch<R, D>({ setup: composeSetup, request, followUp, thread, resolved, callContext, partition, onRawJsonGap: onGap });
    const fields = llmDispatchRecordFieldsOf<R, H, A>({ recordFieldsOf: config.recordFieldsOf, request, callContext });
    const sinks: LlmDispatchRecordSinks<R, H, A> = { recorder, taps, onGap };
    const isFollowUp = followUp != null;
    recordLlmDispatchStart<R, H, A>({ sinks, request, resolved, composed, followUp: isFollowUp, fields });

    const { tier } = resolved;
    const critique = followUp == null ? request.critique : undefined;
    const { fastFix, fastFixUnavailable } = llmBoundReplyFastFixOf<R, X>({ replyFastFix: config.replyFastFix, request, protocol: composed.protocol, schemaHint: composed.baseRequest.responseSchemaHint, dispatch: (fixRequest) => selfDispatch.dispatch(fixRequest) });
    const attemptsConfig: LlmDispatchAttemptsConfig = {
      strategy: resolved.strategy,
      baseRequest: composed.baseRequest,
      protocol: composed.protocol,
      envelope: config.replyEnvelope,
      validate: composed.validate,
      callContext,
      signal,
      cancelled: () => isLlmDispatchCancelled(signals),
      pause,
      baseOutputBudget: composed.baseRequest.maxOutputTokens ?? config.defaultMaxOutputTokens,
      onDecodeAttempt: isLlmDispatchTapsActive(taps) ? (attempt, willRetry) => taps.emitDecodeFailure({ capability, ...(tier == null ? {} : { tier }), attempt, willRetry, ...fields('decode-failure') }) : undefined,
      maxAttempts: llmDispatchMaxAttemptsOf(composed.maxAttempts),
      resolvedModel: resolved.resolvedModel,
      escalateModel,
      critique,
      liveContext: composed.liveContext,
      lineLeverField: request.lineLeverField,
      fastFix,
      fastFixUnavailable,
      fastFixLimits,
      corrections,
      correctionSlotId,
      transportBackoff
    };
    const outcome = composed.validate == null && critique == null ? await runSingleShotLlmDispatch(attemptsConfig) : await runLlmDispatchAttempts(attemptsConfig);
    const { callProfile } = recordLlmDispatch<R, H, A>({ sinks, request, followUp: isFollowUp, callContext, resolved, composed, outcome, fields });
    const degenerate = outcome.decodeFailures.length > 0 && !outcome.recovered;
    const result = config.resultOf?.({ result: outcome.result, request, callContext, callProfile }) ?? (outcome.result as X);
    const { finalRequest } = outcome;

    return { result, sentTurn: { role: 'user', content: finalRequest.prompt, ...(finalRequest.cacheSegments == null ? {} : { cacheSegments: finalRequest.cacheSegments }) }, ...(degenerate ? { degenerate } : {}) };
  };

  const preparePrompt = makeLlmPromptFactory<R, X>({ runPromptRequest, degenerateThreadPlaceholder: config.degenerateThreadPlaceholder, threadTurnMaxChars: config.threadTurnMaxChars });

  const dispatch = async (request: R) => (await preparePrompt(request).execute()).result;
  selfDispatch.dispatch = dispatch;

  return {
    dispatch,
    preparePrompt,
    capabilityVision: (capability, override) => llmCapabilityVisionOf({ override, descriptor: descriptorOf(capability), route: capabilityRoutes?.get(capability), tiers: modelTiers, defaultTier, visionByModel }),
    ...decisionLane
  };
}
