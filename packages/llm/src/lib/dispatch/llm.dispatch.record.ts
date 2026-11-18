/**
 * The dispatcher's record stage — the send-time start record, the completed call record, the one decode-failure
 * record, their fan-out to the host recorder and the live taps, and the over-budget gap.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmModelTierKey } from '../model/llm.value';
import { type LlmCallContext, type LlmCallProfile } from '../record/llm.call.context';
import { type LlmCallHostFields, type LlmCallRecord, type LlmCallStartRecord } from '../record/llm.call.record';
import { llmDecodeContextExcerpt, llmDecodePromptId } from '../record/llm.decode.failure';
import { type LlmDispatchTapRegistry } from '../record/llm.dispatch.tap';
import { llmStrategyKind } from '../strategy/llm.strategy.registry';
import { type LlmComposedDispatch } from './llm.dispatch.compose';
import { llmCallPhasesOf, type LlmDispatchOutcome } from './llm.dispatch.outcome';
import { type LlmDispatchRequest } from './llm.dispatch.request';
import { type LlmResolvedDispatch } from './llm.dispatch.resolve';
import { type LlmDispatchGap, type LlmDispatchRecorder, type LlmDispatchRecordFieldsParams, type LlmDispatchRecordKind } from './llm.dispatcher.config';

/**
 * The host's top-level fields of each record kind for ONE dispatch.
 *
 * @typeParam H - The host's top-level record fields.
 */
export type LlmDispatchRecordFields<H extends LlmCallHostFields = LlmCallHostFields> = (kind: LlmDispatchRecordKind) => H;

/**
 * The inputs of {@link llmDispatchRecordFieldsOf}.
 *
 * @typeParam R - The host's request type.
 * @typeParam H - The host's top-level record fields.
 * @typeParam A - The call-context attribution type.
 */
export interface LlmDispatchRecordFieldsConfig<R extends LlmDispatchRequest = LlmDispatchRequest, H extends LlmCallHostFields = LlmCallHostFields, A extends object = object> {
  /**
   * The host hook — absent ⇒ no host fields.
   */
  readonly recordFieldsOf?: Maybe<(params: LlmDispatchRecordFieldsParams<R, A>) => H>;
  readonly request: R;
  readonly callContext: LlmCallContext<A>;
}

/**
 * One dispatch's host-field reader — the hook called AT MOST ONCE per record kind (memoized), `{}` when absent.
 *
 * @param config - The hook, the request and the call context.
 * @returns The reader.
 */
export function llmDispatchRecordFieldsOf<R extends LlmDispatchRequest = LlmDispatchRequest, H extends LlmCallHostFields = LlmCallHostFields, A extends object = object>(config: LlmDispatchRecordFieldsConfig<R, H, A>): LlmDispatchRecordFields<H> {
  const { recordFieldsOf, request, callContext } = config;
  const read = new Map<LlmDispatchRecordKind, H>();

  return (kind) => {
    const cached = read.get(kind);
    let fields: H;

    if (cached == null) {
      fields = recordFieldsOf == null ? ({} as H) : recordFieldsOf({ kind, request, callContext });
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
 */
export interface LlmDispatchRecordSinks<R extends LlmDispatchRequest = LlmDispatchRequest, H extends LlmCallHostFields = LlmCallHostFields, A extends object = object> {
  readonly recorder?: Maybe<LlmDispatchRecorder<R, H, A>>;
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
  readonly sinks: LlmDispatchRecordSinks<R, H, A>;
  readonly request: R;
  readonly resolved: LlmResolvedDispatch;
  readonly composed: LlmComposedDispatch;
  readonly followUp: boolean;
  readonly fields: LlmDispatchRecordFields<H>;
}

/**
 * Record that a call is about to be sent — the start record to the recorder, and (with taps attached) the
 * `onDispatch` tap event with the prompt and its estimate.
 *
 * @param config - The sinks, the request, the resolved / composed dispatch and the host fields.
 * @returns The start record.
 */
export function recordLlmDispatchStart<R extends LlmDispatchRequest = LlmDispatchRequest, H extends LlmCallHostFields = LlmCallHostFields, A extends object = object>(config: RecordLlmDispatchStartConfig<R, H, A>): LlmCallStartRecord<H> {
  const { sinks, request, resolved, composed, followUp, fields } = config;
  const { tier, strategy } = resolved;
  const startRecord: LlmCallStartRecord<H> = { capability: request.capability, model: resolved.resolvedModel, ...(tier == null ? {} : { tier }), strategyId: resolved.strategyId, strategyKind: llmStrategyKind(strategy), ...fields('start') };
  sinks.recorder?.recordCallStart?.(startRecord);

  if (isLlmDispatchTapsActive(sinks.taps)) {
    sinks.taps.emitDispatch({ ...startRecord, prompt: composed.baseRequest.prompt, estimatedPromptTokens: composed.estimatedPromptTokens, ...(followUp ? { followUp: true } : {}) });
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
  readonly resolved: Pick<LlmResolvedDispatch, 'reasoning'> & { readonly tier?: LlmModelTierKey };
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
   * The profile snapshot — present iff the call context times.
   */
  readonly callProfile?: LlmCallProfile<A>;
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
  const phases = callProfile == null ? undefined : llmCallPhasesOf({ profile: callProfile, attemptPhases: outcome.attemptPhases, request: baseRequest, cachePrefixHash });
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
        promptId: llmDecodePromptId(cacheSegments?.cachePrefix ?? baseRequest.prompt),
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

  return { callRecord, ...(callProfile == null ? {} : { callProfile }) };
}
