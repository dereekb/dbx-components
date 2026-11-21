/**
 * The dispatcher's compose stage — the root request (the layout-driven assembly, the schema hints, the raw-JSON and
 * cache-prefix watches) or a chained follow-up request (one segment over the replayed thread), plus the prompt-token
 * estimate every call is recorded with.
 */

import { type Maybe, type PartialWithUndefined, type HexString } from '@dereekb/util';
import { hardenLlmResponseSchemaHint } from '../capability/llm.capability.schema';
import { type LlmCapabilityDescriptor, type LlmCapabilityDescriptorReader } from '../capability/llm.capability.descriptor';
import { composeLlmCapabilityPrompt, type LlmPromptAssemblyTexts, type LlmPromptLiveContextSegmentOrigin } from '../prompt/llm.prompt.assembly';
import { estimateLlmRequestPromptTokens } from '../prompt/llm.prompt.budget';
import { type LlmPromptCachePrefixWatch } from '../prompt/llm.prompt.cache.watch';
import { toLlmPromptSupplements, type LlmPromptContributor } from '../prompt/llm.prompt.contributor';
import { type LlmPromptLayout, type LlmPromptSlotId } from '../prompt/llm.prompt.layout';
import { joinLlmLiveContextBlocks, LLM_FLAT_LIVE_CONTEXT_BLOCK_KEY } from '../prompt/llm.prompt.live.context';
import { type LlmPromptSegment } from '../prompt/llm.prompt.segment';
import { type LlmPromptTemplateResolver } from '../prompt/llm.prompt.template';
import { type LlmPromptFollowUp } from '../prompt/llm.prompt.thread';
import { type LlmCallContext } from '../record/llm.call.context';
import { type LlmCallSupplement } from '../record/llm.call.record';
import { type LlmReplyProtocol, resolveLlmReplyProtocol } from '../reply/llm.reply.protocol';
import { type LlmValueValidator } from '../reply/llm.reply.validator';
import { type LlmRequest, type LlmThreadTurn } from '../strategy/llm.strategy';
import { type LlmDispatchRequest } from './llm.dispatch.request';
import { type LlmResolvedDispatch } from './llm.dispatch.resolve';
import { type LlmDispatchRawJsonGap } from './llm.dispatcher.config';
import { type LlmTokenCount } from '../model/llm.value';

/**
 * The per-dispatcher inputs of the compose stage, fixed at construction.
 *
 * @typeParam R - The host's request type.
 * @typeParam D - The host's capability descriptor type.
 */
export interface LlmDispatchComposeSetup<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> {
  readonly descriptorOf: LlmCapabilityDescriptorReader<D>;
  readonly templateResolver: LlmPromptTemplateResolver<R, D>;
  readonly layout: LlmPromptLayout;
  readonly contributors?: Maybe<ReadonlyArray<LlmPromptContributor<R, D>>>;
  readonly texts?: Maybe<PartialWithUndefined<LlmPromptAssemblyTexts>>;
  readonly defaultReplyProtocol?: Maybe<LlmReplyProtocol>;
  /**
   * The segment id of a follow-up turn — the layout's `follow-up` slot id.
   */
  readonly followUpSlotId: LlmPromptSlotId;
  /**
   * The separator appended after a follow-up turn's content — the layout's `follow-up` slot's `lastSeparator ??
   * separator` (`''` when the layout declares none).
   */
  readonly followUpSeparator: string;
  /**
   * The segment id the model addendum lands under — the layout's `model-addendum` slot id.
   */
  readonly modelAddendumSlotId: LlmPromptSlotId;
  readonly promptCacheWatch: LlmPromptCachePrefixWatch;
  readonly isRawJsonBlock?: Maybe<(text: string) => boolean>;
}

/**
 * The inputs of {@link composeLlmDispatch}.
 *
 * @typeParam R - The host's request type.
 * @typeParam D - The host's capability descriptor type.
 */
export interface ComposeLlmDispatchConfig<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> {
  readonly setup: LlmDispatchComposeSetup<R, D>;
  readonly request: R;
  /**
   * The chained follow-up turn — absent on a root call.
   */
  readonly followUp?: Maybe<LlmPromptFollowUp>;
  /**
   * The already-exchanged thread a follow-up replays.
   */
  readonly thread: ReadonlyArray<LlmThreadTurn>;
  readonly resolved: LlmResolvedDispatch<D>;
  readonly callContext: LlmCallContext;
  /**
   * The cache-watch partition.
   */
  readonly partition?: Maybe<string | number>;
  /**
   * Receives the raw-JSON gap, when the watch finds one.
   */
  readonly onRawJsonGap: (gap: LlmDispatchRawJsonGap) => void;
}

/**
 * What the compose stage built.
 */
export interface LlmComposedDispatch {
  /**
   * The call's reply protocol.
   */
  readonly protocol: LlmReplyProtocol;
  /**
   * The request the first attempt sends.
   */
  readonly baseRequest: LlmRequest;
  /**
   * The segments the call record carries.
   */
  readonly segments: ReadonlyArray<LlmPromptSegment>;
  /**
   * The contributor placements, as call-record supplement rows (root only).
   */
  readonly supplements: ReadonlyArray<LlmCallSupplement>;
  /**
   * The joined live context the root rendered (`''` on a follow-up) — a critic's subject.
   */
  readonly liveContext: string;
  /**
   * The cache watch's hash of the root's cache prefix (absent on a follow-up).
   */
  readonly cachePrefixHash?: HexString;
  /**
   * The estimated prompt tokens — the replayed thread and the billed schema included.
   */
  readonly estimatedPromptTokens: LlmTokenCount;
  /**
   * The value validator of this call — the request's on the root, the follow-up's on a follow-up.
   */
  readonly validate?: LlmValueValidator | undefined;
  /**
   * The attempt budget of this call, as asked — the request's on the root, the follow-up's on a follow-up (clamped by
   * the attempt stage).
   */
  readonly maxAttempts?: number | undefined;
}

/**
 * The schema hints of a root call — none on a `line` call; an explicit request hint is HARDENED (and projected with its
 * prose for the contract); else the descriptor's.
 */
interface LlmDispatchSchemaHints {
  readonly responseSchemaHint?: unknown;
  readonly contractSchemaHint?: unknown;
}

/**
 * Resolve a root call's schema hints.
 *
 * @param request - The request.
 * @param descriptor - The capability's descriptor.
 * @param protocol - The call's reply protocol.
 * @returns The hints.
 */
function llmDispatchSchemaHintsOf(request: LlmDispatchRequest, descriptor: Maybe<LlmCapabilityDescriptor>, protocol: LlmReplyProtocol): LlmDispatchSchemaHints {
  let hints: LlmDispatchSchemaHints = {};

  if (protocol === 'line') {
    // a line call carries no schema
  } else if (request.responseSchemaHint == null) {
    hints = { responseSchemaHint: descriptor?.responseSchemaHint(), contractSchemaHint: descriptor?.contractSchemaHint() };
  } else {
    hints = { responseSchemaHint: hardenLlmResponseSchemaHint(request.responseSchemaHint), contractSchemaHint: hardenLlmResponseSchemaHint(request.responseSchemaHint, { describe: true }) };
  }

  return hints;
}

/**
 * The wire fields every request of a dispatch shares — always the resolved slug and the resolved cap.
 *
 * @param request - The request.
 * @param resolved - The resolved dispatch.
 * @returns The shared fields.
 */
function llmDispatchWireFieldsOf(request: LlmDispatchRequest, resolved: LlmResolvedDispatch): Pick<LlmRequest, 'capability' | 'meta' | 'model' | 'maxOutputTokens' | 'reasoning'> {
  const { resolvedModel, maxOutputTokens, reasoning } = resolved;
  return { capability: request.capability, ...(request.meta == null ? {} : { meta: request.meta }), model: resolvedModel, maxOutputTokens, reasoning };
}

/**
 * Watch a root prompt's live segments for raw JSON — one gap naming the first offending block and the count.
 *
 * @param config - The compose config.
 * @param segments - The assembled segments.
 */
function watchLlmDispatchRawJson<R extends LlmDispatchRequest, D extends LlmCapabilityDescriptor>(config: ComposeLlmDispatchConfig<R, D>, segments: ReadonlyArray<LlmPromptSegment>): void {
  const { isRawJsonBlock } = config.setup;

  if (isRawJsonBlock != null && config.resolved.descriptor?.rawJsonContext !== true) {
    const rawJsonBlocks = segments.filter((segment) => segment.origin.kind === 'live-context' && isRawJsonBlock(segment.promptSegment));
    const first = rawJsonBlocks[0];

    if (first != null) {
      const origin = first.origin as LlmPromptLiveContextSegmentOrigin;
      config.onRawJsonGap({ kind: 'prompt-raw-json', capability: config.request.capability, block: origin.block ?? LLM_FLAT_LIVE_CONTEXT_BLOCK_KEY, blocks: rawJsonBlocks.length });
    }
  }
}

/**
 * Observe a root prompt's cache prefix — a moved prefix files a (not-once) `prefix-changed` breadcrumb.
 *
 * @param config - The compose config.
 * @param segments - The assembled segments.
 * @returns The prefix hash.
 */
function watchLlmDispatchCachePrefix<R extends LlmDispatchRequest, D extends LlmCapabilityDescriptor>(config: ComposeLlmDispatchConfig<R, D>, segments: ReadonlyArray<LlmPromptSegment>): string {
  const { request, partition, callContext } = config;
  const capability = request.capability;
  const observation = config.setup.promptCacheWatch.observe({ capability, partition, segments });

  if (observation.changed) {
    callContext.diag({
      level: 'debug',
      code: 'prefix-changed',
      fields: {
        capability,
        ...(partition == null ? {} : { partition }),
        ...(observation.previousHash == null ? {} : { previousHash: observation.previousHash }),
        hash: observation.hash,
        prefixChars: observation.prefixChars,
        ...(observation.firstDifferingSegmentId == null ? {} : { firstDifferingSegmentId: observation.firstDifferingSegmentId }),
        ...(observation.firstDifferingSegmentKey == null ? {} : { firstDifferingSegmentKey: observation.firstDifferingSegmentKey }),
        ...(observation.appendedSegmentId == null ? {} : { appendedSegmentId: observation.appendedSegmentId })
      },
      message: "the cacheable prompt prefix moved since this partition's previous dispatch of this capability"
    });
  }

  return observation.hash;
}

/**
 * The composed request before its token estimate.
 */
type LlmComposedDispatchBase = Omit<LlmComposedDispatch, 'estimatedPromptTokens'>;

/**
 * Compose a ROOT call — the layout-driven assembly, the addendum breadcrumb, the raw-JSON and cache watches.
 *
 * @param config - The compose config.
 * @param protocol - The call's reply protocol.
 * @returns The composed root request.
 */
async function composeLlmRootDispatch<R extends LlmDispatchRequest, D extends LlmCapabilityDescriptor>(config: ComposeLlmDispatchConfig<R, D>, protocol: LlmReplyProtocol): Promise<LlmComposedDispatchBase> {
  const { setup, request, resolved, callContext } = config;
  const { descriptor, resolvedModel } = resolved;
  const capability = request.capability;
  const hints = llmDispatchSchemaHintsOf(request, descriptor, protocol);
  const composed = await composeLlmCapabilityPrompt<R, D>({
    request,
    layout: setup.layout,
    descriptorOf: setup.descriptorOf,
    descriptor,
    templateResolver: setup.templateResolver,
    contributors: setup.contributors,
    model: resolvedModel,
    contractSchemaHint: hints.contractSchemaHint,
    defaultReplyProtocol: setup.defaultReplyProtocol,
    texts: setup.texts,
    callContext
  });
  const { segments } = composed;
  const addendum = segments.find((segment) => segment.id === setup.modelAddendumSlotId);

  if (addendum != null) {
    callContext.diag({ level: 'debug', code: 'model-prompt-addendum', fields: { capability, model: resolvedModel, chars: addendum.promptSegment.length }, message: 'per-model prompt addendum prepended to the cacheable prefix', once: `model-prompt-addendum:${capability}:${resolvedModel}` });
  }

  watchLlmDispatchRawJson(config, segments);
  const cachePrefixHash = watchLlmDispatchCachePrefix(config, segments);
  const attachments = request.attachments;
  const baseRequest: LlmRequest = {
    segments,
    prompt: composed.prompt,
    cacheSegments: composed.cacheSegments,
    ...llmDispatchWireFieldsOf(request, resolved),
    ...(hints.responseSchemaHint == null ? {} : { responseSchemaHint: hints.responseSchemaHint }),
    ...(attachments == null || attachments.length === 0 ? {} : { attachments })
  };

  return {
    protocol,
    baseRequest,
    segments,
    supplements: toLlmPromptSupplements(composed.contributions, composed.cut),
    liveContext: joinLlmLiveContextBlocks(composed.liveContext),
    cachePrefixHash,
    validate: request.validate,
    maxAttempts: request.maxAttempts
  };
}

/**
 * Compose a chained FOLLOW-UP call — no assembly: one segment carrying the follow-up's content over the replayed
 * thread, no cache split, no attachments; the follow-up's own (hardened) hint, else the root's.
 *
 * @param config - The compose config.
 * @param followUp - The follow-up turn.
 * @param protocol - The call's reply protocol.
 * @returns The composed follow-up request.
 */
function composeLlmFollowUpDispatch<R extends LlmDispatchRequest, D extends LlmCapabilityDescriptor>(config: ComposeLlmDispatchConfig<R, D>, followUp: LlmPromptFollowUp, protocol: LlmReplyProtocol): LlmComposedDispatchBase {
  const { setup, request, resolved, thread } = config;
  const capability = request.capability;
  const responseSchemaHint = followUp.responseSchemaHint == null ? llmDispatchSchemaHintsOf(request, resolved.descriptor, protocol).responseSchemaHint : hardenLlmResponseSchemaHint(followUp.responseSchemaHint);
  const origin = { kind: 'follow-up', capability };
  const content = followUp.content + setup.followUpSeparator;
  const segments: ReadonlyArray<LlmPromptSegment> = [{ id: setup.followUpSlotId, promptSegment: content, origin, reason: 'a chained follow-up turn over the already-exchanged thread', volatile: true }];
  const baseRequest: LlmRequest = {
    segments,
    prompt: content,
    thread,
    ...llmDispatchWireFieldsOf(request, resolved),
    ...(responseSchemaHint == null ? {} : { responseSchemaHint })
  };

  return { protocol, baseRequest, segments, supplements: [], liveContext: '', validate: followUp.validate, maxAttempts: followUp.maxAttempts };
}

/**
 * Compose one call — root or follow-up — and estimate its prompt tokens (ALWAYS, over the prompt, the replayed thread
 * and the billed schema).
 *
 * @param config - The setup, the request / follow-up / thread, the resolved dispatch, the call context, the partition
 *   and the raw-JSON gap sink.
 * @returns The composed call.
 */
export async function composeLlmDispatch<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor>(config: ComposeLlmDispatchConfig<R, D>): Promise<LlmComposedDispatch> {
  const { setup, request, followUp, resolved } = config;
  const protocol = resolveLlmReplyProtocol({ request, descriptor: resolved.descriptor, defaultReplyProtocol: setup.defaultReplyProtocol });
  const composed = followUp == null ? await composeLlmRootDispatch(config, protocol) : composeLlmFollowUpDispatch(config, followUp, protocol);
  const { baseRequest } = composed;
  const estimatedPromptTokens = estimateLlmRequestPromptTokens({ prompt: baseRequest.prompt, thread: baseRequest.thread, responseSchemaHint: baseRequest.responseSchemaHint });

  return { ...composed, estimatedPromptTokens };
}
