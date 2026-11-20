/**
 * The CRAFT JUDGE — the decision pass that decides, per dispatch, whether each JUDGED craft note (one carrying an
 * `ask`) applies to this request. It is the craft contributor's `judge`: the contributor
 * (`makeLlmCraftPromptContributor`) calls it once, at the root of a dispatch, between `resolveLlmCraftCandidates` and
 * `settleLlmCraftNotes`, with the dispatch request it is resolving ({@link LlmCraftJudgeParams}).
 *
 * - **The state** is only the site inputs some asked note names in backticks (`readLlmCraftAskInputs` over the site),
 *   each clipped to the site's `judgeInputMax` chars. A note none of whose named inputs the site carries is not asked
 *   (it takes its `unserved` posture), and no asked note means no call at all.
 * - **The questions:** one Noul `n<i>` per asked note, its `ask` VERBATIM (the note's own words; code composes none).
 * - **The gate:** the host's `available` gate (asked with the call's params). Unavailable, or a dispatcher with no
 *   `decide` ⇒ `onUnavailable` and nothing answered (every asked note is unserved).
 * - **The call:** exactly ONE `decide` under the request's capability, stamped `{ craft: { asked, kept } }` on its call
 *   record. A fault or a transport throw is swallowed ({@link LLM_CRAFT_JUDGE_DECIDE_SWALLOW_SITE}): nothing answered.
 */

import { getValueFromGetter, type GetterOrValue, isNotBlankString, type Maybe, type IndexNumber, type PercentDecimal } from '@dereekb/util';
import { defineLlmDecision } from '../decision/llm.decision.descriptor';
import { llmNoulQuestion, type LlmDecisionAnswer, type LlmDecisionAnswers, type LlmDecisionQuestions } from '../decision/llm.decision.question';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmDispatcher } from '../dispatch/llm.dispatcher';
import { type LlmPromptSiteInputs, type LlmPromptSiteKind } from '../prompt/llm.prompt.site';
import { type LlmSwallowSink, type LlmSwallowSiteId } from '../record/llm.swallow';
import { type LlmCraftNoteId } from './llm.craft.identity';
import { isLlmCraftNoteKept, LLM_CRAFT_NOTE_SELECT_DECISION_ID, type LlmCraftNote } from './llm.craft.note';
import { readLlmCraftAskInputs, type LlmCraftSiteRegistry } from './llm.craft.site';

/**
 * The swallow site a faulted or thrown judge call reports.
 */
export const LLM_CRAFT_JUDGE_DECIDE_SWALLOW_SITE: LlmSwallowSiteId = 'llm/craft-judge.decide';

/**
 * What a craft contributor hands its judge for ONE dispatch.
 *
 * @typeParam R - The host's request type.
 */
export interface LlmCraftJudgeParams<R extends LlmDispatchRequest = LlmDispatchRequest> {
  /**
   * The dispatch request the contributor is resolving — its capability (the judge's call records under it), its site
   * and the host's fields.
   */
  readonly request: R;
  /**
   * The site's kind (a craft site's).
   */
  readonly kind: LlmPromptSiteKind;
  /**
   * The judged notes to ask about, ranked.
   */
  readonly asked: ReadonlyArray<LlmCraftNote>;
  /**
   * The site's free-text inputs.
   */
  readonly inputs: LlmPromptSiteInputs;
}

/**
 * A judge's answer — note id → the probability the note applies.
 */
export type LlmCraftJudgeVerdicts = ReadonlyMap<LlmCraftNoteId, PercentDecimal>;

/**
 * A craft contributor's judge: one decision pass over the asked notes, answering note id → the probability it
 * applies, or nothing when it could not answer (the host's gate is closed, the call faulted), so every asked note
 * takes its own unserved posture. Called at most once per dispatch, at the root. The library judge is
 * {@link makeLlmCraftJudge}, and `makeLlmCraftPromptContributor` is its one caller.
 *
 * A judge typed for the default request fits any host's contributor (its params are only read).
 *
 * @typeParam R - The host's request type.
 */
export type LlmCraftJudge<R extends LlmDispatchRequest = LlmDispatchRequest> = (params: LlmCraftJudgeParams<R>) => Promise<Maybe<LlmCraftJudgeVerdicts>>;

/**
 * One asked note as the judge sees it — its id, its ask and its floor (the floor only decides the stamp's `kept`).
 */
export interface LlmCraftJudgeNote {
  readonly id: LlmCraftNoteId;
  readonly ask: string;
  readonly floor: PercentDecimal;
}

/**
 * The judge's input — the asked notes, in question order (`n0`, `n1`, …), and the inputs they name.
 */
export interface LlmCraftJudgeInput {
  readonly notes: ReadonlyArray<LlmCraftJudgeNote>;
  /**
   * Only the site inputs some asked note names, each clipped to the site's `judgeInputMax`.
   */
  readonly inputs: LlmPromptSiteInputs;
}

/**
 * Clip one input to `max` chars.
 *
 * @param text - The input.
 * @param max - The most chars kept.
 * @returns The trimmed, clipped input.
 */
function clipLlmCraftJudgeInput(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Config for {@link toLlmCraftJudgeInput}.
 */
export interface ToLlmCraftJudgeInputConfig {
  /**
   * The site kind, the asked notes and the site inputs.
   */
  readonly params: Pick<LlmCraftJudgeParams, 'kind' | 'asked' | 'inputs'>;
  /**
   * The host's craft sites.
   */
  readonly sites: LlmCraftSiteRegistry;
}

/**
 * The judge's input for one site — every asked note that names at least one input the site carries, and only those
 * inputs. `undefined` when no note is left to ask (no call), or the kind is not a craft site.
 *
 * @param config - The judge's params and the host's craft sites.
 * @returns The input, or `undefined`.
 */
export function toLlmCraftJudgeInput(config: ToLlmCraftJudgeInputConfig): Maybe<LlmCraftJudgeInput> {
  const { params, sites } = config;
  const site = sites.siteOf(params.kind);
  const notes: LlmCraftJudgeNote[] = [];
  const named: string[] = [];

  if (site != null) {
    for (const note of params.asked) {
      const present = readLlmCraftAskInputs(note.ask ?? '', [site]).filter((name) => isNotBlankString(params.inputs[name]));

      if (note.ask != null && present.length > 0) {
        notes.push({ id: note.id, ask: note.ask, floor: note.floor });
        present.forEach((name) => (named.includes(name) ? undefined : named.push(name)));
      }
    }
  }

  return site == null || notes.length === 0 ? undefined : { notes, inputs: Object.fromEntries(named.map((name) => [name, clipLlmCraftJudgeInput(params.inputs[name] ?? '', site.limits.judgeInputMax)])) };
}

/**
 * The question key of the note at `at`.
 *
 * @param at - The note's index in {@link LlmCraftJudgeInput.notes}.
 * @returns `n<at>`.
 */
export function toLlmCraftJudgeQuestionKey(at: IndexNumber): string {
  return `n${at}`;
}

/**
 * The declared decision: the clipped inputs as the state, one Noul per asked note (its `ask` verbatim). It sets no
 * tier or model, so the dispatcher's model precedence picks the model; a completion route on the consuming capability
 * is ignored (only a route that names a decision model serves a decision), so it falls to `decisions.defaultModel`.
 */
export const LLM_CRAFT_NOTE_SELECT_DECISION = /*#__PURE__*/ defineLlmDecision({
  decision: LLM_CRAFT_NOTE_SELECT_DECISION_ID,
  describe: 'whether each judged craft note applies to this request',
  state: (input: LlmCraftJudgeInput) => ({ ...input.inputs }),
  questions: (input: LlmCraftJudgeInput): LlmDecisionQuestions => Object.fromEntries(input.notes.map((note, at) => [toLlmCraftJudgeQuestionKey(at), llmNoulQuestion(note.ask)]))
});

/**
 * Read the answers back as verdicts — note id → its Noul probability; a missing or non-Noul answer is absent (that
 * note is unserved).
 *
 * @param answers - The decision's answers.
 * @param input - The input it was asked over.
 * @returns The verdicts.
 */
export function readLlmCraftJudgeVerdicts(answers: LlmDecisionAnswers<LlmDecisionQuestions>, input: LlmCraftJudgeInput): LlmCraftJudgeVerdicts {
  const verdicts = new Map<LlmCraftNoteId, PercentDecimal>();

  input.notes.forEach((note, at) => {
    const answer = (answers as Readonly<Record<string, Maybe<LlmDecisionAnswer>>>)[toLlmCraftJudgeQuestionKey(at)];

    if (answer?.type === 'noul' && typeof answer.noul === 'number') {
      verdicts.set(note.id, answer.noul);
    }
  });

  return verdicts;
}

/**
 * The call-record stamp of one judge call — the asked note ids and the ones it kept (at or above their floor).
 *
 * @param verdicts - The verdicts.
 * @param input - The input.
 * @returns `{ craft: { asked, kept } }`.
 */
export function toLlmCraftJudgeStamp(verdicts: LlmCraftJudgeVerdicts, input: LlmCraftJudgeInput): { readonly craft: { readonly asked: ReadonlyArray<LlmCraftNoteId>; readonly kept: ReadonlyArray<LlmCraftNoteId> } } {
  return { craft: { asked: input.notes.map((note) => note.id), kept: input.notes.filter((note) => isLlmCraftNoteKept(verdicts.get(note.id), note.floor)).map((note) => note.id) } };
}

/**
 * Config for {@link makeLlmCraftJudge}.
 *
 * @typeParam R - The host's request type.
 */
export interface MakeLlmCraftJudgeConfig<R extends LlmDispatchRequest = LlmDispatchRequest> {
  /**
   * The host's craft sites.
   */
  readonly sites: LlmCraftSiteRegistry;
  /**
   * The dispatcher whose `decide` the judge calls, read on EVERY judge call. A getter is the usual case: the judge rides
   * the contributor of the very dispatcher it asks, which is built after it; a value suits a separate decision
   * dispatcher. No `decide` ⇒ nothing is ever asked.
   */
  readonly dispatcher: GetterOrValue<Maybe<Pick<LlmDispatcher, 'decide'>>>;
  /**
   * The host's gate, asked per judge call with the call's params (a lane switch, a budget the host keeps, a per-call
   * posture read off the request); absent ⇒ always available.
   */
  readonly available?: Maybe<(params: LlmCraftJudgeParams<R>) => boolean>;
  /**
   * Called with the call's params when a wanted call was not made (no `decide`, or unavailable).
   */
  readonly onUnavailable?: Maybe<(params: LlmCraftJudgeParams<R>) => void>;
  /**
   * Where a faulted or thrown call reports ({@link LLM_CRAFT_JUDGE_DECIDE_SWALLOW_SITE}).
   */
  readonly swallow?: Maybe<LlmSwallowSink>;
}

/**
 * A craft contributor's judge over one dispatcher. Never throws: a closed gate, a fault or a transport throw answers
 * nothing, and every asked note takes its own `unserved` posture.
 *
 * @param config - The craft sites, the dispatcher (or its getter), the gate and the sinks.
 * @returns The judge, to pass as the craft contributor's `judge`.
 *
 * @typeParam R - The host's request type.
 *
 * @example
 * ```ts
 * const judge = makeLlmCraftJudge({ sites, dispatcher: () => dispatcher });
 * const craft = makeLlmCraftPromptContributor({ sites, tiers, judge });
 * const dispatcher = makeLlmDispatcher({ strategies, contributors: [craft], decisions });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmCraftJudge<R extends LlmDispatchRequest = LlmDispatchRequest>(config: MakeLlmCraftJudgeConfig<R>): LlmCraftJudge<R> {
  const { sites, dispatcher: dispatcherGetter, available, onUnavailable, swallow } = config;

  return async (params) => {
    const input = toLlmCraftJudgeInput({ params, sites });
    let verdicts: Maybe<LlmCraftJudgeVerdicts>;

    if (input != null) {
      const dispatcher = getValueFromGetter(dispatcherGetter);

      if (dispatcher?.decide != null && (available?.(params) ?? true)) {
        try {
          const result = await dispatcher.decide({ capability: params.request.capability, decision: LLM_CRAFT_NOTE_SELECT_DECISION, input, stamp: (answers) => toLlmCraftJudgeStamp(readLlmCraftJudgeVerdicts(answers, input), input) });
          verdicts = readLlmCraftJudgeVerdicts(result.answers, input);
        } catch (error) {
          swallow?.(LLM_CRAFT_JUDGE_DECIDE_SWALLOW_SITE, error);
        }
      } else {
        onUnavailable?.(params);
      }
    }

    return verdicts;
  };
}
