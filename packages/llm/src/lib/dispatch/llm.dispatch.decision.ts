/**
 * The dispatcher's DECISION LANE — `decide` and its per-run counters. A decision runs one `strategy.decide` (no retry
 * loop: a decision strategy owns its own transport policy), parked on the host pause gate, and is recorded as one start
 * record plus one call record whose prompt is the decision's state and questions. No taps fire.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmDecision, type LlmDecisionDispatchRequest } from '../decision/llm.decision.descriptor';
import { llmDecisionModelIssue } from '../decision/llm.decision.model';
import { type LlmDecisionQuestions } from '../decision/llm.decision.question';
import { type LlmDecisionResult, type LlmDecisionStrategy } from '../decision/llm.decision.strategy';
import { resolveLlmCapabilityModel } from '../model/llm.model.precedence';
import { type LlmCompiledModelRouting } from '../model/llm.model.routing';
import { type LlmModelTierMap } from '../model/llm.model.tier';
import { type LlmModelId, type LlmModelTierKey } from '../model/llm.value';
import { type LlmPromptSlotId } from '../prompt/llm.prompt.layout';
import { joinLlmPromptSegments, type LlmPromptSegment, type LlmPromptSegmentOrigin } from '../prompt/llm.prompt.segment';
import { type LlmCallHostFields, type LlmCallRecord, type LlmCallStartRecord } from '../record/llm.call.record';
import { type LlmSwallowSink, type LlmSwallowSiteId } from '../record/llm.swallow';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
import { llmStrategyKind } from '../strategy/llm.strategy.registry';
import { type LlmDispatchPauseSignal, llmDispatchFallbackCallContextOf, llmDispatchSignalOf, parkLlmDispatchWhilePaused } from './llm.dispatch.control';
import { type LlmDispatcherDecisionConfig } from './llm.dispatcher.config';

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
 * The record writer the decision lane needs.
 */
export interface LlmDispatchDecisionRecorder<H extends LlmCallHostFields = LlmCallHostFields> {
  /**
   * Record the send.
   *
   * @param record - The start record.
   */
  recordCallStart?(record: LlmCallStartRecord<H>): void;
  /**
   * Record the call.
   *
   * @param record - The call record.
   */
  recordCall(record: LlmCallRecord<H>): void;
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
   * How many decisions reached the wire since construction or the last reset (a throw still spends).
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
 * The inputs of {@link makeLlmDispatchDecisionLane}.
 */
export interface LlmDispatchDecisionLaneConfig<H extends LlmCallHostFields = LlmCallHostFields, A extends object = object> {
  /**
   * The dispatcher's decision block — absent ⇒ no lane.
   */
  readonly decisions?: Maybe<LlmDispatcherDecisionConfig<H, A>>;
  /**
   * The dispatcher's tier map.
   */
  readonly modelTiers: LlmModelTierMap;
  /**
   * The dispatcher's default tier.
   */
  readonly defaultTier: LlmModelTierKey;
  /**
   * The compiled capability routes.
   */
  readonly capabilityRoutes?: Maybe<LlmCompiledModelRouting>;
  /**
   * The record writer.
   */
  readonly recorder?: Maybe<LlmDispatchDecisionRecorder<H>>;
  /**
   * The host pause gate.
   */
  readonly pause?: Maybe<LlmDispatchPauseSignal>;
  /**
   * The dispatcher-wide cancellation signal.
   */
  readonly cancellationSignal?: Maybe<AbortSignal>;
  /**
   * Where a fallback context reports its swallows.
   */
  readonly swallow?: Maybe<LlmSwallowSink>;
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
export function makeLlmDispatchDecisionLane<H extends LlmCallHostFields = LlmCallHostFields, A extends object = object>(config: LlmDispatchDecisionLaneConfig<H, A>): Maybe<LlmDispatchDecisionLane> {
  const { decisions, modelTiers, defaultTier, capabilityRoutes, recorder, pause, cancellationSignal, swallow, liveSlotId } = config;
  let lane: Maybe<LlmDispatchDecisionLane>;

  if (decisions != null) {
    const issue = llmDecisionModelIssue(decisions.defaultModel);

    if (issue != null) {
      throw new Error(`llm dispatcher: ${issue}.`);
    }

    const { strategies, strategyId: pinnedStrategyId, defaultModel, newCallContext, recordFieldsOf } = decisions;
    const strategy: Maybe<LlmDecisionStrategy> = pinnedStrategyId == null ? strategies.values()[0] : strategies.get(pinnedStrategyId);

    if (strategy != null) {
      const strategyId = strategy.id;
      const strategyKind = llmStrategyKind(strategy);
      let served = 0;
      let warned = false;

      const modelOf = (request: LlmDecisionDispatchRequest): LlmDispatchDecisionModel => {
        const override = { ...(request.model == null ? {} : { model: request.model }), ...(request.tier == null ? {} : { tier: request.tier }) };
        const resolved = resolveLlmCapabilityModel({ override, descriptor: request.decision.descriptor, route: capabilityRoutes?.get(request.capability), tiers: modelTiers, defaultTier });
        let decisionModel: LlmDispatchDecisionModel;

        // a text tier's slug never reaches a decision strategy: the default-tier rung is the decision default model
        if (resolved.source === 'default-tier') {
          decisionModel = { model: defaultModel };
        } else {
          decisionModel = { model: resolved.model, ...(resolved.tier == null ? {} : { tier: resolved.tier }) };
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

      const decide = async <I, Q extends LlmDecisionQuestions>(request: LlmDecisionDispatchRequest<I, Q>): Promise<LlmDecisionResult<Q>> => {
        // the hooks see the library request: `stamp` is contravariant in `Q`, so the widening needs one cast
        const widened = request as unknown as LlmDecisionDispatchRequest;
        const { capability } = request;
        const { model, tier } = modelOf(widened);
        const decision: LlmDecision<I, Q> = request.decision;
        const decisionRequest = decision.asRequest({ input: request.input, model });
        const callContext = newCallContext?.({ label: capability, request: widened }) ?? llmDispatchFallbackCallContextOf<A>({ label: capability, swallow });
        const fields = (kind: 'start' | 'call'): H => recordFieldsOf?.({ kind, request: widened, callContext }) ?? ({} as H);
        const signal = llmDispatchSignalOf({ cancellationSignal, request });
        await parkLlmDispatchWhilePaused({ pause, signal, callContext });
        recorder?.recordCallStart?.({ capability, model, ...(tier == null ? {} : { tier }), strategyId, strategyKind, ...fields('start') });

        const start = Date.now();
        served += 1;
        const answer = await callContext.timeAsync('decide', () => strategy.decide(decisionRequest, signal == null ? undefined : { signal }));
        const latencyMs = Date.now() - start;
        const segments = segmentsOf(decision.descriptor.decision, decisionRequest.state, decisionRequest.questions);
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
          ...(answer.generationId == null ? {} : { generationId: answer.generationId })
        };

        recorder?.recordCall({
          capability,
          prompt: joinLlmPromptSegments(segments),
          segments,
          result,
          ...(tier == null ? {} : { tier }),
          decision: decision.descriptor.decision,
          ...(request.stage == null ? {} : { stage: request.stage }),
          ...(stamp == null ? {} : { stamp }),
          ...fields('call')
        });

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
