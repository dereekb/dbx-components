/**
 * The CRAFT JUDGE — the decision pass that decides, per dispatch, whether each JUDGED craft note (one carrying an
 * `ask`) applies to this request. It is a site's `LlmPromptSite.judge`: the craft contributor
 * (`llmCraftPromptContributor`) calls it once, at the root of a dispatch, between `llmCraftCandidatesOf` and
 * `settleLlmCraftNotes`.
 *
 * - **The state** is only the site inputs some asked note names in backticks (`llmCraftAskInputsOf` over the site),
 *   each clipped to the site's `judgeInputMax` chars. A note none of whose named inputs the site carries is not asked
 *   (it takes its `unserved` posture), and no asked note means no call at all.
 * - **The questions:** one Noul `n<i>` per asked note, its `ask` VERBATIM (the note's own words; code composes none).
 * - **The gate:** the host's `available` (its decision lane, its budget). Unavailable, or a dispatcher with no
 *   `decide` ⇒ `onUnavailable` and nothing answered (every asked note is unserved).
 * - **The call:** exactly ONE `decide` under the consuming capability, stamped `{ craft: { asked, kept } }` on its call
 *   record. A fault or a transport throw is swallowed ({@link LLM_CRAFT_JUDGE_DECIDE_SWALLOW_SITE}): nothing answered.
 */

import { isNotBlankString, type Maybe } from '@dereekb/util';
import { defineLlmDecision } from '../decision/llm.decision.descriptor';
import { llmNoulQuestion, type LlmDecisionAnswer, type LlmDecisionAnswers, type LlmDecisionQuestions } from '../decision/llm.decision.question';
import { type LlmDispatcher } from '../dispatch/llm.dispatcher';
import { type LlmPromptSiteInputs, type LlmPromptSiteJudge, type LlmPromptSiteJudgeRequest, type LlmPromptSiteJudgeVerdicts } from '../prompt/llm.prompt.site';
import { type LlmSwallowSink, type LlmSwallowSiteId } from '../record/llm.swallow';
import { type LlmCraftNoteId } from './llm.craft.identity';
import { LLM_CRAFT_NOTE_SELECT_DECISION_ID } from './llm.craft.note';
import { llmCraftAskInputsOf, type LlmCraftSiteRegistry } from './llm.craft.site';

/**
 * The swallow site a faulted or thrown judge call reports.
 */
export const LLM_CRAFT_JUDGE_DECIDE_SWALLOW_SITE: LlmSwallowSiteId = 'llm/craft-judge.decide';

/**
 * One asked note as the judge sees it — its id, its ask and its floor (the floor only decides the stamp's `kept`).
 */
export interface LlmCraftJudgeNote {
  readonly id: LlmCraftNoteId;
  readonly ask: string;
  readonly floor: number;
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
 * Config for {@link llmCraftJudgeInputOf}.
 */
export interface LlmCraftJudgeInputOfConfig {
  /**
   * The site kind, the asked notes and the site inputs.
   */
  readonly request: Pick<LlmPromptSiteJudgeRequest, 'kind' | 'asked' | 'inputs'>;
  /**
   * The host's craft sites.
   */
  readonly sites: LlmCraftSiteRegistry;
}

/**
 * The judge's input for one site — every asked note that names at least one input the site carries, and only those
 * inputs. `undefined` when no note is left to ask (no call), or the kind is not a craft site.
 *
 * @param config - The judge request and the host's craft sites.
 * @returns The input, or `undefined`.
 */
export function llmCraftJudgeInputOf(config: LlmCraftJudgeInputOfConfig): Maybe<LlmCraftJudgeInput> {
  const { request, sites } = config;
  const site = sites.siteOf(request.kind);
  const notes: LlmCraftJudgeNote[] = [];
  const named: string[] = [];

  if (site != null) {
    for (const note of request.asked) {
      const present = llmCraftAskInputsOf(note.ask ?? '', [site]).filter((name) => isNotBlankString(request.inputs[name]));

      if (note.ask != null && present.length > 0) {
        notes.push({ id: note.id, ask: note.ask, floor: note.floor });
        present.forEach((name) => (named.includes(name) ? undefined : named.push(name)));
      }
    }
  }

  return site == null || notes.length === 0 ? undefined : { notes, inputs: Object.fromEntries(named.map((name) => [name, clipLlmCraftJudgeInput(request.inputs[name] ?? '', site.limits.judgeInputMax)])) };
}

/**
 * The question key of the note at `at`.
 *
 * @param at - The note's index in {@link LlmCraftJudgeInput.notes}.
 * @returns `n<at>`.
 */
export function llmCraftJudgeQuestionKeyOf(at: number): string {
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
  questions: (input: LlmCraftJudgeInput): LlmDecisionQuestions => Object.fromEntries(input.notes.map((note, at) => [llmCraftJudgeQuestionKeyOf(at), llmNoulQuestion(note.ask)]))
});

/**
 * Read the answers back as verdicts — note id → its Noul probability; a missing or non-Noul answer is absent (that
 * note is unserved).
 *
 * @param answers - The decision's answers.
 * @param input - The input it was asked over.
 * @returns The verdicts.
 */
export function readLlmCraftJudgeVerdicts(answers: LlmDecisionAnswers<LlmDecisionQuestions>, input: LlmCraftJudgeInput): LlmPromptSiteJudgeVerdicts {
  const verdicts = new Map<LlmCraftNoteId, number>();

  input.notes.forEach((note, at) => {
    const answer = (answers as Readonly<Record<string, Maybe<LlmDecisionAnswer>>>)[llmCraftJudgeQuestionKeyOf(at)];

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
export function llmCraftJudgeStampOf(verdicts: LlmPromptSiteJudgeVerdicts, input: LlmCraftJudgeInput): { readonly craft: { readonly asked: ReadonlyArray<LlmCraftNoteId>; readonly kept: ReadonlyArray<LlmCraftNoteId> } } {
  return { craft: { asked: input.notes.map((note) => note.id), kept: input.notes.filter((note) => (verdicts.get(note.id) ?? -1) >= note.floor).map((note) => note.id) } };
}

/**
 * Config for {@link makeLlmCraftJudge}.
 */
export interface MakeLlmCraftJudgeConfig {
  /**
   * The host's craft sites.
   */
  readonly sites: LlmCraftSiteRegistry;
  /**
   * The dispatcher whose `decide` the judge calls; no `decide` ⇒ nothing is ever asked.
   */
  readonly dispatcher: Maybe<Pick<LlmDispatcher, 'decide'>>;
  /**
   * The host's lane / budget gate; absent ⇒ always available.
   */
  readonly available?: Maybe<() => boolean>;
  /**
   * Called when a wanted call was not made (no `decide`, or unavailable).
   */
  readonly onUnavailable?: Maybe<() => void>;
  /**
   * Where a faulted or thrown call reports ({@link LLM_CRAFT_JUDGE_DECIDE_SWALLOW_SITE}).
   */
  readonly swallow?: Maybe<LlmSwallowSink>;
}

/**
 * A site's judge over one dispatcher. Never throws: an unavailable lane, a fault or a transport throw answers
 * nothing, and every asked note takes its own `unserved` posture.
 *
 * @param config - The craft sites, the dispatcher, the gate and the sinks.
 * @returns The judge.
 *
 * @example
 * ```ts
 * const judge = makeLlmCraftJudge({ sites, dispatcher });
 * const site = { kind: 'product-page', facts: { category: 'apparel' }, inputs: { brief }, judge };
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmCraftJudge(config: MakeLlmCraftJudgeConfig): LlmPromptSiteJudge {
  const { sites, dispatcher, available, onUnavailable, swallow } = config;

  return async (request) => {
    const input = llmCraftJudgeInputOf({ request, sites });
    let verdicts: Maybe<LlmPromptSiteJudgeVerdicts>;

    if (input != null) {
      if (dispatcher?.decide != null && (available?.() ?? true)) {
        try {
          const result = await dispatcher.decide({ capability: request.capability, decision: LLM_CRAFT_NOTE_SELECT_DECISION, input, stamp: (answers) => llmCraftJudgeStampOf(readLlmCraftJudgeVerdicts(answers, input), input) });
          verdicts = readLlmCraftJudgeVerdicts(result.answers, input);
        } catch (error) {
          swallow?.(LLM_CRAFT_JUDGE_DECIDE_SWALLOW_SITE, error);
        }
      } else {
        onUnavailable?.();
      }
    }

    return verdicts;
  };
}
