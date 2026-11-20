/**
 * The dispatcher's DECISION LANE — `decide` and its per-run counters. A decision rides the dispatcher's shared record
 * path: its context comes from the dispatcher's `callContextOf` (nested under the request's `callContext`, else the
 * recorder's root), its host fields from `recordFieldsOf` (`lane: 'decision'`), and it writes one start record (and
 * fires `onDispatch`) through `recordLlmDispatchStart`, then one call record (and `onDispatchComplete`) whose prompt is
 * the decision's state and questions. It never fires `onDecodeFailure`.
 *
 * The model is the decision's own: a per-call override, a capability route that names a decision model, the
 * descriptor's `model` / `tier`, else `decisions.defaultModel` — a capability's COMPLETION route never serves its
 * decisions, and a slug that is not a decision model throws before anything is sent. A send that fails with a
 * retryable transport error is resent after the dispatcher's `transportBackoff`, up to `decisions.maxAttempts` sends.
 */

import { type Maybe, waitForMsUnlessAborted, type Milliseconds } from '@dereekb/util';
import { type IsRetryableUnknownErrorFunction } from '@dereekb/util/fetch';
import { type LlmDecision, type LlmDecisionDispatchRequest } from '../decision/llm.decision.descriptor';
import { isLlmDecisionModelId, llmDecisionModelIssue } from '../decision/llm.decision.model';
import { type LlmDecisionQuestions } from '../decision/llm.decision.question';
import { isRetryableLlmDecisionError, type LlmDecideOptions, type LlmDecisionRequest, type LlmDecisionResult, type LlmDecisionStrategy } from '../decision/llm.decision.strategy';
import { resolveLlmCapabilityModel } from '../model/llm.model.precedence';
import { type LlmCompiledModelRouting } from '../model/llm.model.routing';
import { type LlmModelTierMap } from '../model/llm.model.tier';
import { type LlmModelId, type LlmModelTierKey } from '../model/llm.value';
import { estimateLlmTokens } from '../prompt/llm.prompt.budget';
import { type LlmPromptSlotId } from '../prompt/llm.prompt.layout';
import { joinLlmPromptSegments, type LlmPromptSegment, type LlmPromptSegmentOrigin } from '../prompt/llm.prompt.segment';
import { type LlmCallContext } from '../record/llm.call.context';
import { type LlmCallFailedAttempt, type LlmCallHostFields, type LlmCallRecord } from '../record/llm.call.record';
import { type LlmSwallowSiteId } from '../record/llm.swallow';
import { formatLlmErrorSummary } from '../strategy/llm.error';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
import { llmStrategyKind } from '../strategy/llm.strategy.registry';
import { type LlmDispatchPauseSignal, type LlmDispatchTransportBackoff, mergeLlmDispatchSignals, parkLlmDispatchWhilePaused } from './llm.dispatch.control';
import { toLlmCallFailedAttempt, makeLlmTransportResult } from './llm.dispatch.outcome';
import { isLlmDispatchTapsActive, makeLlmDispatchRecordFields, type LlmDispatchRecordSinks, recordLlmDispatchStart } from './llm.dispatch.record';
import { type LlmDispatchRequest } from './llm.dispatch.request';
import { resolveLlmDispatchMaxAttempts } from './llm.dispatch.run';
import { type LlmDispatcherDecisionConfig, type LlmDispatchRecordFieldsParams } from './llm.dispatcher.config';

/**
 * The swallow site of a decision consumer's `stamp` that threw — the answers still return, recorded without a stamp.
 */
export const LLM_DECIDE_STAMP_SWALLOW_SITE: LlmSwallowSiteId = 'llm/decide.stamp';

/**
 * The provenance of a decision's recorded prompt segment — its state or its questions.
 */
export interface LlmPromptDecisionSegmentOrigin extends LlmPromptSegmentOrigin {
  readonly kind: 'decision';
  /**
   * The declared decision key.
   */
  readonly decision: string;
  /**
   * Which half of the decision the segment holds.
   */
  readonly part: 'state' | 'questions';
}

/**
 * The decision lane a dispatcher exposes — {@link decide} and its per-run counters, all present together.
 */
export interface LlmDispatchDecisionLane {
  /**
   * Make one decision.
   *
   * @param request - The decision request.
   * @returns The answers.
   */
  decide<I, Q extends LlmDecisionQuestions>(request: LlmDecisionDispatchRequest<I, Q>): Promise<LlmDecisionResult<Q>>;
  /**
   * How many decision SENDS reached the wire since construction or the last reset — every send, a resend included (a
   * throw still spends).
   *
   * @returns The count.
   */
  decisionsSpent(): number;
  /**
   * Zero the counter and re-arm the warning latch.
   */
  resetDecisionsSpent(): void;
  /**
   * `true` the FIRST time it is called after construction or a reset, `false` every time after.
   *
   * @returns Whether the caller won the warning.
   */
  claimDecisionBudgetWarning(): boolean;
}

/**
 * The inputs of {@link makeLlmDispatchDecisionLane} — the dispatcher's decision block and the pieces of the dispatcher
 * it shares.
 *
 * @typeParam R - The host's request type.
 * @typeParam H - The host's top-level record fields.
 * @typeParam A - The call-context attribution type.
 */
export interface LlmDispatchDecisionLaneConfig<R extends LlmDispatchRequest = LlmDispatchRequest, H extends LlmCallHostFields = LlmCallHostFields, A extends object = object> {
  /**
   * The dispatcher's decision block — absent ⇒ no lane.
   */
  readonly decisions?: Maybe<LlmDispatcherDecisionConfig>;
  /**
   * The dispatcher's tier map.
   */
  readonly modelTiers: LlmModelTierMap;
  /**
   * The dispatcher's default tier.
   */
  readonly defaultTier: LlmModelTierKey;
  /**
   * The compiled capability routes — only a route that names a decision model serves a decision.
   */
  readonly capabilityRoutes?: Maybe<LlmCompiledModelRouting>;
  /**
   * The dispatcher's recorder and taps.
   */
  readonly sinks: Pick<LlmDispatchRecordSinks<R, H, A>, 'recorder' | 'taps'>;
  /**
   * The dispatcher's host-field hook (handed `lane: 'decision'`).
   */
  readonly recordFieldsOf?: Maybe<(params: LlmDispatchRecordFieldsParams<R, A>) => H>;
  /**
   * The dispatcher's context minting — nested under the request's `callContext`, else the recorder's root, else a
   * context that does not time.
   */
  readonly callContextOf: (request: LlmDecisionDispatchRequest) => LlmCallContext<A>;
  /**
   * The host pause gate.
   */
  readonly pause?: Maybe<LlmDispatchPauseSignal>;
  /**
   * The dispatcher-wide cancellation signal.
   */
  readonly cancellationSignal?: Maybe<AbortSignal>;
  /**
   * The wait before a decision resend.
   */
  readonly transportBackoff: LlmDispatchTransportBackoff;
  /**
   * The dispatcher's call on an error the classifier reads as `unknown` (`LlmDispatcherConfig.isRetryableUnknownError`).
   */
  readonly isRetryableUnknownError?: Maybe<IsRetryableUnknownErrorFunction>;
  /**
   * The layout's `live` slot id — the id the decision's segments record under.
   */
  readonly liveSlotId: LlmPromptSlotId;
}

/**
 * The model a decision is served by, and the tier when one routed it.
 */
interface LlmDispatchDecisionModel {
  readonly model: LlmModelId;
  readonly tier?: LlmModelTierKey;
}

/**
 * What one decision's send loop returned.
 */
interface LlmDispatchDecisionSent<Q extends LlmDecisionQuestions> {
  readonly answer: LlmDecisionResult<Q>;
  /**
   * The wall clock of the successful send.
   */
  readonly latencyMs: Milliseconds;
  /**
   * How many sends were made (the first plus resends).
   */
  readonly attempts: number;
  /**
   * One row per failed (resent) send.
   */
  readonly failedAttempts: ReadonlyArray<LlmCallFailedAttempt>;
}

/**
 * The inputs of one decision's send loop.
 */
interface LlmDispatchDecisionSendParams<Q extends LlmDecisionQuestions, A extends object> {
  readonly request: LlmDecisionDispatchRequest;
  readonly decisionRequest: LlmDecisionRequest<Q>;
  readonly callContext: LlmCallContext<A>;
  readonly signal: Maybe<AbortSignal>;
}

/**
 * Build a dispatcher's decision lane.
 *
 * Construction refuses a `defaultModel` that is not a decision model, and resolves the strategy: the pinned one, else
 * the first registered. No `decisions` block, an empty registry, or a pin that is not registered ⇒ no lane.
 *
 * @param config - The decision block and the dispatcher pieces it shares.
 * @returns The lane, or `undefined` when there is none.
 * @throws {Error} When `decisions.defaultModel` is not a decision model.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmDispatchDecisionLane<R extends LlmDispatchRequest = LlmDispatchRequest, H extends LlmCallHostFields = LlmCallHostFields, A extends object = object>(config: LlmDispatchDecisionLaneConfig<R, H, A>): Maybe<LlmDispatchDecisionLane> {
  const { decisions, modelTiers, defaultTier, capabilityRoutes, sinks, recordFieldsOf, callContextOf, pause, cancellationSignal, transportBackoff, isRetryableUnknownError, liveSlotId } = config;
  let lane: Maybe<LlmDispatchDecisionLane>;

  if (decisions != null) {
    const issue = llmDecisionModelIssue(decisions.defaultModel);

    if (issue != null) {
      throw new Error(`llm dispatcher: ${issue}.`);
    }

    const { strategies, strategyId: pinnedStrategyId, defaultModel } = decisions;
    const strategy: Maybe<LlmDecisionStrategy> = pinnedStrategyId == null ? strategies.values()[0] : strategies.get(pinnedStrategyId);

    if (strategy != null) {
      const strategyId = strategy.id;
      const strategyKind = llmStrategyKind(strategy);
      const maxAttempts = resolveLlmDispatchMaxAttempts(decisions.maxAttempts);
      let served = 0;
      let warned = false;

      const decisionModelOf = (request: LlmDecisionDispatchRequest): LlmDispatchDecisionModel => {
        const capabilityRoute = capabilityRoutes?.get(request.capability);
        // a capability's COMPLETION route never serves its decisions; a route that names a decision model does
        const route = capabilityRoute != null && isLlmDecisionModelId(capabilityRoute.model) ? capabilityRoute : undefined;
        const resolved = resolveLlmCapabilityModel({ override: request, descriptor: request.decision.descriptor, route, tiers: modelTiers, defaultTier });
        // the default-tier rung is the decision default model, never the text tier map's slug
        const decisionModel: LlmDispatchDecisionModel = resolved.source === 'default-tier' ? { model: defaultModel } : { model: resolved.model, ...(resolved.tier == null ? {} : { tier: resolved.tier }) };
        const modelIssue = llmDecisionModelIssue(decisionModel.model);

        if (modelIssue != null) {
          throw new Error(`llm dispatcher: decision '${request.decision.descriptor.decision}' for '${request.capability}' (the ${resolved.source} rung): ${modelIssue}.`);
        }

        return decisionModel;
      };

      const segmentsOf = (decision: string, state: unknown, questions: unknown): LlmPromptSegment[] => {
        const stateOrigin: LlmPromptDecisionSegmentOrigin = { kind: 'decision', decision, part: 'state' };
        const questionsOrigin: LlmPromptDecisionSegmentOrigin = { kind: 'decision', decision, part: 'questions' };
        return [
          { id: liveSlotId, promptSegment: JSON.stringify(state), origin: stateOrigin, reason: 'the decision STATE: a decision has no assembled prompt, so its state stands in for one', volatile: true },
          { id: liveSlotId, promptSegment: JSON.stringify(questions), origin: questionsOrigin, reason: 'the decision QUESTIONS: the options, criteria and instructions the answer was chosen from', volatile: true }
        ];
      };

      const sendDecision = async <Q extends LlmDecisionQuestions>(params: LlmDispatchDecisionSendParams<Q, A>): Promise<LlmDispatchDecisionSent<Q>> => {
        const { request, decisionRequest, callContext, signal } = params;
        const { capability } = request;
        const decision = request.decision.descriptor.decision;
        const options: Maybe<LlmDecideOptions> = signal == null ? undefined : { signal };
        // read through a function: the signal can fire across an await, which a narrowed property read would miss
        const cancelled = (): boolean => signal?.aborted === true;
        const failedAttempts: LlmCallFailedAttempt[] = [];
        let attempt = 0;
        let lastError: unknown;
        let sent: Maybe<LlmDispatchDecisionSent<Q>>;

        while (sent == null) {
          attempt += 1;

          if (attempt > 1) {
            await parkLlmDispatchWhilePaused({ pause, signal, callContext });

            // a decision cancelled while parked is never resent
            if (cancelled()) {
              throw lastError;
            }
          }

          // the counter bounds what is SENT, a resend included
          served += 1;
          const start = Date.now();

          try {
            const answer = await callContext.timeAsync('decide', () => strategy.decide(decisionRequest, options));
            sent = { answer, latencyMs: Date.now() - start, attempts: attempt, failedAttempts };
          } catch (error) {
            // the decision lane's ONE retry predicate: a transient failure, or an unknown one the host vouched for
            const resend = attempt < maxAttempts && !cancelled() && isRetryableLlmDecisionError(error, isRetryableUnknownError);

            if (!resend) {
              throw error;
            }

            lastError = error;
            const summary = formatLlmErrorSummary(error);
            failedAttempts.push(toLlmCallFailedAttempt({ attempt, cause: 'transport', result: makeLlmTransportResult({ capability, meta: request.meta }, strategyId), error: summary }));
            const delayMs = transportBackoff({ attempt, error });
            callContext.diag({ level: 'warn', code: 'transport-backoff', fields: { capability, decision, attempt, delayMs, error: summary }, message: 'a decision send failed before reaching the model; backing off before an identical resend' });
            await callContext.timeAsync('transport-backoff', () => waitForMsUnlessAborted(delayMs, signal));

            // a decision cancelled during the backoff is never resent
            if (cancelled()) {
              throw error;
            }
          }
        }

        return sent;
      };

      const decide = async <I, Q extends LlmDecisionQuestions>(request: LlmDecisionDispatchRequest<I, Q>): Promise<LlmDecisionResult<Q>> => {
        // the hooks see the library request: `stamp` is contravariant in `Q`, so the widening needs one cast
        const widened = request as unknown as LlmDecisionDispatchRequest;
        const { capability } = request;
        // throws before anything is minted, parked, recorded or sent
        const { model, tier } = decisionModelOf(widened);
        const decision: LlmDecision<I, Q> = request.decision;
        const key = decision.descriptor.decision;
        const decisionRequest = decision.asRequest({ input: request.input, model });
        const callContext = callContextOf(widened);
        const fields = makeLlmDispatchRecordFields<R, H, A>({ recordFieldsOf, call: { lane: 'decision', request: widened }, callContext });
        const signal = mergeLlmDispatchSignals({ cancellationSignal, request });
        await parkLlmDispatchWhilePaused({ pause, signal, callContext });
        const segments = segmentsOf(key, decisionRequest.state, decisionRequest.questions);
        const prompt = joinLlmPromptSegments(segments);
        recordLlmDispatchStart<R, H, A>({ sinks, capability, model, tier, strategy, prompt, estimatedPromptTokens: estimateLlmTokens(prompt), decision: key, fields });

        const { answer, latencyMs, attempts, failedAttempts } = await sendDecision({ request: widened, decisionRequest, callContext, signal });
        let stamp: Maybe<Readonly<Record<string, unknown>>>;

        try {
          stamp = request.stamp?.(answer.answers);
        } catch (error) {
          callContext.swallow(LLM_DECIDE_STAMP_SWALLOW_SITE, error);
        }

        const result: LlmDispatchResult = {
          text: JSON.stringify(answer.answers),
          strategyId,
          strategyKind,
          capability,
          ...(request.meta == null ? {} : { meta: request.meta }),
          model: answer.model,
          ...(answer.provider == null ? {} : { provider: answer.provider }),
          ...(answer.usage == null ? {} : { usage: answer.usage }),
          latencyMs,
          ...(answer.generationId == null ? {} : { generationId: answer.generationId }),
          ...(attempts > 1 ? { attempts } : {})
        };

        const callRecord: LlmCallRecord<H> = {
          capability,
          prompt,
          segments,
          result,
          ...(tier == null ? {} : { tier }),
          decision: key,
          ...(request.stage == null ? {} : { stage: request.stage }),
          ...(stamp == null ? {} : { stamp }),
          ...(failedAttempts.length === 0 ? {} : { failedAttempts }),
          ...fields('call')
        };
        sinks.recorder?.recordCall(callRecord);

        if (isLlmDispatchTapsActive(sinks.taps)) {
          sinks.taps.emitDispatchComplete({ ...callRecord });
        }

        return answer;
      };

      lane = {
        decide,
        decisionsSpent: () => served,
        resetDecisionsSpent: () => {
          served = 0;
          warned = false;
        },
        claimDecisionBudgetWarning: () => {
          const claimed = !warned;
          warned = true;
          return claimed;
        }
      };
    }
  }

  return lane;
}
