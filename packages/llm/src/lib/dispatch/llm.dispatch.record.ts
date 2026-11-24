/**
 * The dispatcher's record stage — the send-time start record, the completed call record, the one decode-failure
 * record, their fan-out to the host recorder and the live taps, and the over-budget gap. The host-field reader and
 * the start record serve both lanes (a completion and a decision).
 */

import { type Maybe } from '@dereekb/util';
import { type LlmCapabilityKey, type LlmModelId, type LlmModelTierKey, type LlmTokenCount } from '../model/llm.value';
import { toLlmCallPhases } from '../record/llm.call.attempt';
import { type LlmCallContext, type LlmCallProfile } from '../record/llm.call.context';
import { type LlmCallHostFields, type LlmCallRecord, type LlmCallStartRecord } from '../record/llm.call.record';
import { llmDecodeContextExcerpt } from '../record/llm.decode.failure';
import { llmPromptCacheHash } from '../prompt/llm.prompt.hash';
import { type LlmDispatchTapRegistry } from '../record/llm.dispatch.tap';
import { type LlmStrategyBase } from '../strategy/llm.strategy';
import { llmStrategyKind } from '../strategy/llm.strategy.registry';
import { type LlmComposedDispatch } from './llm.dispatch.compose';
import { type LlmDispatchOutcome } from './llm.dispatch.outcome';
import { type LlmDispatchRequest } from './llm.dispatch.request';
import { type LlmResolvedDispatch } from './llm.dispatch.resolve';
import { type LlmDispatchGap, type LlmDispatchLaneRequest, type LlmDispatchRecorder, type LlmDispatchRecordFieldsParams, type LlmDispatchRecordKind } from './llm.dispatcher.config';

/**
 * The host's top-level fields of each record kind for ONE dispatch or decision.
 *
 * @typeParam H - The host's top-level record fields.
 */
export type LlmDispatchRecordFields<H extends LlmCallHostFields = LlmCallHostFields> = (kind: LlmDispatchRecordKind) => H;

/**
 * The inputs of {@link makeLlmDispatchRecordFields}.
 *
 * @typeParam R - The host's request type.
 * @typeParam H - The host's top-level record fields.
 * @typeParam A - The call-context attribution type.
 * @typeParam E - The host's decision-request fields.
 */
export interface LlmDispatchRecordFieldsConfig<R extends LlmDispatchRequest = LlmDispatchRequest, H extends LlmCallHostFields = LlmCallHostFields, A extends object = object, E extends object = object> {
  /**
   * The host hook — absent ⇒ no host fields.
   */
  readonly recordFieldsOf?: Maybe<(params: LlmDispatchRecordFieldsParams<R, A, E>) => H>;
  /**
   * The lane and its request, handed to the hook as-is.
   */
  readonly call: LlmDispatchLaneRequest<R, E>;
  readonly callContext: LlmCallContext<A>;
}

/**
 * One dispatch's (or decision's) host-field reader — the hook called AT MOST ONCE per record kind (memoized), `{}`
 * when absent.
 *
 * @param config - The hook, the lane and its request, and the call context.
 * @returns The reader.
 */
export function makeLlmDispatchRecordFields<R extends LlmDispatchRequest = LlmDispatchRequest, H extends LlmCallHostFields = LlmCallHostFields, A extends object = object, E extends object = object>(config: LlmDispatchRecordFieldsConfig<R, H, A, E>): LlmDispatchRecordFields<H> {
  const { recordFieldsOf, call, callContext } = config;
  const read = new Map<LlmDispatchRecordKind, H>();

  return (kind) => {
    const cached = read.get(kind);
    let fields: H;

    if (cached == null) {
      fields = recordFieldsOf == null ? ({} as H) : recordFieldsOf({ ...call, kind, callContext });
      read.set(kind, fields);
    } else {
      fields = cached;
    }

    return fields;
  };
}

/**
 * The record sinks of one dispatcher.
 *
 * @typeParam R - The host's request type.
 * @typeParam H - The host's top-level record fields.
 * @typeParam A - The call-context attribution type.
 * @typeParam E - The host's decision-request fields.
 */
export interface LlmDispatchRecordSinks<R extends LlmDispatchRequest = LlmDispatchRequest, H extends LlmCallHostFields = LlmCallHostFields, A extends object = object, E extends object = object> {
  readonly recorder?: Maybe<LlmDispatchRecorder<R, H, A, E>>;
  /**
   * The live taps — `size` is re-read at every seam, so a tap attached after construction is seen.
   */
  readonly taps?: Maybe<LlmDispatchTapRegistry<H>>;
  /**
   * Receives the over-budget gap.
   */
  readonly onGap?: Maybe<(gap: LlmDispatchGap) => void>;
}

/**
 * Whether a tap registry has any taps attached right now.
 *
 * @param taps - The registry.
 * @returns `true` when at least one tap is attached.
 */
export function isLlmDispatchTapsActive<H extends LlmCallHostFields>(taps: Maybe<LlmDispatchTapRegistry<H>>): taps is LlmDispatchTapRegistry<H> {
  return taps != null && taps.size > 0;
}

/**
 * The inputs of {@link recordLlmDispatchStart}.
 *
 * @typeParam R - The host's request type.
 * @typeParam H - The host's top-level record fields.
 * @typeParam A - The call-context attribution type.
 */
export interface RecordLlmDispatchStartConfig<R extends LlmDispatchRequest = LlmDispatchRequest, H extends LlmCallHostFields = LlmCallHostFields, A extends object = object> {
  readonly sinks: Pick<LlmDispatchRecordSinks<R, H, A>, 'recorder' | 'taps'>;
  /**
   * The capability the call records under (on a decision, the consuming capability).
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The concrete model slug the call is sent to.
   */
  readonly model: LlmModelId;
  /**
   * The tier the model came from, when one did.
   */
  readonly tier?: Maybe<LlmModelTierKey>;
  /**
   * The strategy the call is sent through.
   */
  readonly strategy: Pick<LlmStrategyBase, 'id' | 'kind'>;
  /**
   * Tap-only: what the call newly sends (a decision's state and questions JSON).
   */
  readonly prompt: string;
  /**
   * Tap-only: the prompt's estimated tokens.
   */
  readonly estimatedPromptTokens: LlmTokenCount;
  /**
   * Tap-only: whether the call is a chained follow-up.
   */
  readonly followUp?: Maybe<boolean>;
  /**
   * Tap-only: the declared decision a decision-lane send answers.
   */
  readonly decision?: Maybe<string>;
  readonly fields: LlmDispatchRecordFields<H>;
}

/**
 * Record that a call (a dispatch or a decision) is about to be sent — the start record to the recorder, and (with
 * taps attached) the `onDispatch` tap event with the prompt, its estimate and, on a decision, the decision key.
 *
 * @param config - The sinks, the capability, model, tier and strategy, the tap-only prompt facts and the host fields.
 * @returns The start record.
 */
export function recordLlmDispatchStart<R extends LlmDispatchRequest = LlmDispatchRequest, H extends LlmCallHostFields = LlmCallHostFields, A extends object = object>(config: RecordLlmDispatchStartConfig<R, H, A>): LlmCallStartRecord<H> {
  const { sinks, capability, model, tier, strategy, prompt, estimatedPromptTokens, followUp, decision, fields } = config;
  const startRecord: LlmCallStartRecord<H> = { capability, model, ...(tier == null ? {} : { tier }), strategyId: strategy.id, strategyKind: llmStrategyKind(strategy), ...fields('start') };
  sinks.recorder?.recordCallStart?.(startRecord);

  if (isLlmDispatchTapsActive(sinks.taps)) {
    sinks.taps.emitDispatch({ ...startRecord, prompt, estimatedPromptTokens, ...(followUp === true ? { followUp: true } : {}), ...(decision == null ? {} : { decision }) });
  }

  return startRecord;
}

/**
 * The inputs of {@link recordLlmDispatch}.
 *
 * @typeParam R - The host's request type.
 * @typeParam H - The host's top-level record fields.
 * @typeParam A - The call-context attribution type.
 */
export interface RecordLlmDispatchConfig<R extends LlmDispatchRequest = LlmDispatchRequest, H extends LlmCallHostFields = LlmCallHostFields, A extends object = object> {
  readonly sinks: LlmDispatchRecordSinks<R, H, A>;
  readonly request: R;
  readonly followUp: boolean;
  readonly callContext: LlmCallContext<A>;
  readonly resolved: Pick<LlmResolvedDispatch, 'reasoning'> & { readonly tier?: LlmModelTierKey | undefined };
  readonly composed: LlmComposedDispatch;
  readonly outcome: LlmDispatchOutcome;
  readonly fields: LlmDispatchRecordFields<H>;
}

/**
 * What {@link recordLlmDispatch} recorded.
 *
 * @typeParam H - The host's top-level record fields.
 * @typeParam A - The call-context attribution type.
 */
export interface LlmDispatchRecorded<H extends LlmCallHostFields = LlmCallHostFields, A extends object = object> {
  /**
   * The call record (the SAME object the recorder and the taps received).
   */
  readonly callRecord: LlmCallRecord<H>;
  /**
   * The profile snapshot — set iff the call context times.
   */
  readonly callProfile?: LlmCallProfile<A> | undefined;
}

/**
 * Record a completed call: snapshot the profile ONCE (phases only when the context times), build the call record, hand
 * it to the recorder; file the one decode-failure record when a decode row exists; emit `onDispatchComplete` with the
 * SAME record (plus the decode rows) when taps are attached; then the over-budget gap (the call was still sent).
 *
 * @param config - The sinks, the request, the context, the resolved / composed dispatch, the outcome and the host
 *   fields.
 * @returns The call record and the profile snapshot.
 */
export function recordLlmDispatch<R extends LlmDispatchRequest = LlmDispatchRequest, H extends LlmCallHostFields = LlmCallHostFields, A extends object = object>(config: RecordLlmDispatchConfig<R, H, A>): LlmDispatchRecorded<H, A> {
  const { sinks, request, followUp, callContext, resolved, composed, outcome, fields } = config;
  const { recorder, taps, onGap } = sinks;
  const { tier, reasoning } = resolved;
  const { baseRequest, supplements, estimatedPromptTokens, cachePrefixHash } = composed;
  const { result, decodeFailures, failedAttempts, recovered } = outcome;
  const capability = request.capability;
  const callProfile = callContext.enabled ? callContext.profile() : undefined;
  const phases = callProfile == null ? undefined : toLlmCallPhases({ profile: callProfile, attemptPhases: outcome.attemptPhases, request: baseRequest });
  const callRecord: LlmCallRecord<H> = {
    capability,
    prompt: baseRequest.prompt,
    segments: composed.segments,
    ...(supplements.length === 0 ? {} : { supplements }),
    result,
    ...(tier == null ? {} : { tier }),
    reasoningOff: reasoning.enabled === false,
    ...(request.subjectCapability == null ? {} : { subject: request.subjectCapability }),
    estimatedPromptTokens,
    ...(cachePrefixHash == null ? {} : { cachePrefixHash }),
    ...(phases == null ? {} : { phases }),
    ...(failedAttempts.length === 0 ? {} : { failedAttempts }),
    ...fields('call')
  };
  recorder?.recordCall(callRecord);
  const decodeFailed = decodeFailures.length > 0;

  if (decodeFailed && recorder?.recordDecodeFailure != null) {
    const cacheSegments = baseRequest.cacheSegments;
    recorder.recordDecodeFailure({
      payload: {
        capability,
        ...(result.model == null ? {} : { model: result.model }),
        ...(tier == null ? {} : { tier }),
        ...(result.schemaEnforced == null ? {} : { schemaEnforced: result.schemaEnforced }),
        // the watch's root hash, so this row joins its call record; a follow-up (no watch hash) hashes what it sent
        cachePrefixHash: cachePrefixHash ?? llmPromptCacheHash(baseRequest.prompt),
        promptChars: baseRequest.prompt.length,
        contextExcerpt: llmDecodeContextExcerpt(cacheSegments?.volatileSuffix ?? baseRequest.prompt),
        attempts: result.attempts ?? decodeFailures.length,
        recovered,
        failures: decodeFailures
      },
      ...fields('decode-failure')
    });
  }

  if (isLlmDispatchTapsActive(taps)) {
    taps.emitDispatchComplete({ ...callRecord, ...(followUp ? { followUp: true } : {}), ...(decodeFailed ? { decodeFailures, recovered } : {}) });
  }

  if (outcome.critiqueFailure != null) {
    onGap?.({ kind: 'critique-fail', capability, feedback: outcome.critiqueFailure, text: outcome.result.text });
  }

  const maxPromptTokens = request.maxPromptTokens;

  if (maxPromptTokens != null && estimatedPromptTokens > maxPromptTokens) {
    onGap?.({ kind: 'prompt-over-budget', capability, estimatedPromptTokens, maxPromptTokens });
  }

  return { callRecord, callProfile };
}
