/**
 * `makeLlmDispatcher` — the library dispatcher: resolve → compose → send → decode → validate → record → follow-ups.
 *
 * Every call (root or chained follow-up) runs the same pipeline: mint the per-call context, park on the host pause
 * gate, resolve the model and strategy, compose the request, record the send, run the attempt stage (single-shot, or
 * the validated path when the call sets a `validate` / `critique`), record the call, and report the thread turn.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { llmCapabilityVisionOf, LLM_REASONING_OFF } from '../model/llm.model.precedence';
import { DEFAULT_LLM_MODEL_TIER, resolveLlmModelTier } from '../model/llm.model.tier';
import { DEFAULT_LLM_PROMPT_LAYOUT, type LlmPromptSlotRole, llmPromptSlotsOfRole, type LlmPromptLayout, type LlmPromptSlotId } from '../prompt/llm.prompt.layout';
import { makeLlmPromptCachePrefixWatch } from '../prompt/llm.prompt.cache.watch';
import { type LlmPromptRunParams, type LlmPromptRunResult, makeLlmPromptFactory } from '../prompt/llm.prompt.thread';
import { type LlmCallContext, makeLlmCallContext, noopLlmCallContext } from '../record/llm.call.context';
import { type LlmCallHostFields } from '../record/llm.call.record';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
import { type LlmDispatchRequest } from './llm.dispatch.request';
import { composeLlmDispatch, type LlmDispatchComposeSetup } from './llm.dispatch.compose';
import { isLlmDispatchCancelled, llmDispatchSignalOf, parkLlmDispatchWhilePaused } from './llm.dispatch.control';
import { llmDispatchRecordFieldsOf, type LlmDispatchRecordSinks, isLlmDispatchTapsActive, recordLlmDispatch, recordLlmDispatchStart } from './llm.dispatch.record';
import { llmDispatchStrategySelectorOf, type LlmDispatchResolveSetup, resolveLlmDispatch } from './llm.dispatch.resolve';
import { type LlmDispatchAttemptsConfig, runLlmDispatchAttempts, runSingleShotLlmDispatch } from './llm.dispatch.run';
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
 * Construction resolves the default tier's slug (a tier map missing its default tier throws HERE), the layout's
 * `follow-up` / `model-addendum` slot ids, the cache watch and the strategy selector. The recorder, the taps and the
 * pause gate are held by reference.
 *
 * Single attempt: a call with neither `validate` nor `critique` is single-shot (the result returned unchanged); a call
 * with either runs the validated path with ONE attempt (stamped `attempts` / `decodeStatus` / `decodeOutcome`). A
 * request `critique` routes the call onto the validated path, but no critic is called and `maxAttempts` is not read yet.
 *
 * @param config - The strategies, model routing, prompt pieces and host hooks.
 * @returns The dispatcher.
 * @throws {Error} When the tier map does not hold the default tier.
 *
 * @example
 * ```ts
 * const dispatcher = makeLlmDispatcher({
 *   strategies: makeLlmStrategyRegistry([strategy]),
 *   defaultStrategyId: strategy.id,
 *   defaultMaxOutputTokens: 4096,
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
  const defaultTier = config.defaultTier ?? DEFAULT_LLM_MODEL_TIER;
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
      callContext = swallow == null ? noopLlmCallContext<A>() : makeLlmCallContext<A>({ label, timing: false, attribution: attribution as A, onSwallow: (site, cause) => swallow(site, cause) });
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
      onDecodeAttempt: isLlmDispatchTapsActive(taps) ? (attempt, willRetry) => taps.emitDecodeFailure({ capability, ...(tier == null ? {} : { tier }), attempt, willRetry, ...fields('decode-failure') }) : undefined
    };
    const outcome = composed.validate == null && critique == null ? await runSingleShotLlmDispatch(attemptsConfig) : await runLlmDispatchAttempts(attemptsConfig);
    const { callProfile } = recordLlmDispatch<R, H, A>({ sinks, request, followUp: isFollowUp, callContext, resolved, composed, outcome, fields });
    const degenerate = outcome.decodeFailures.length > 0 && !outcome.recovered;
    const result = config.resultOf?.({ result: outcome.result, request, callContext, callProfile }) ?? (outcome.result as X);
    const { finalRequest } = outcome;

    return { result, sentTurn: { role: 'user', content: finalRequest.prompt, ...(finalRequest.cacheSegments == null ? {} : { cacheSegments: finalRequest.cacheSegments }) }, ...(degenerate ? { degenerate } : {}) };
  };

  const preparePrompt = makeLlmPromptFactory<R, X>({ runPromptRequest, degenerateThreadPlaceholder: config.degenerateThreadPlaceholder, threadTurnMaxChars: config.threadTurnMaxChars });

  return {
    dispatch: async (request: R) => (await preparePrompt(request).execute()).result,
    preparePrompt,
    capabilityVision: (capability, override) => llmCapabilityVisionOf({ override, descriptor: descriptorOf(capability), route: capabilityRoutes?.get(capability), tiers: modelTiers, defaultTier, visionByModel })
  };
}
