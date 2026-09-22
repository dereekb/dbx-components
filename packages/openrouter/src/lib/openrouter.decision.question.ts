import { type Maybe } from '@dereekb/util';
import { type OpenRouterModelConfigValidation } from './openrouter.config';

/**
 * Identifier a caller gives one question inside a decision.
 *
 * The id is NEVER sent to the model — it is only how the caller addresses the matching answer — so a
 * self-explanatory key is no substitute for writing the complete question in `instructions`.
 */
export type OpenRouterDecisionQuestionId = string;

/**
 * Discriminator of the three System One question primitives.
 */
export type OpenRouterDecisionQuestionType = 'choice' | 'score' | 'noul';

/**
 * One piece of declaration guidance: a question's `instructions`, a Choice option, a Score level, or a
 * side of a Noul.
 *
 * Every declaration surface accepts a string, an object, or an array, and the wire carries whichever was
 * supplied VERBATIM. Start with strings — a short unambiguous criterion stays one. Structure is for
 * guidance prose would blur, and for data that is already JSON (a taxonomy branch, a database row):
 * serializing a row into a sentence so the model can read it back out is work the model does not need.
 */
export type OpenRouterDecisionEntry = string | Readonly<Record<string, unknown>> | ReadonlyArray<unknown>;

/**
 * Structured `instructions`, for a question with several parts.
 *
 * `inspect` and `compare` name parts of the state, in the same backticked dot-path convention prose
 * instructions use.
 */
export interface OpenRouterDecisionStructuredInstructions {
  readonly question: string;
  readonly focus?: Maybe<string>;
  readonly inspect?: Maybe<string | ReadonlyArray<string>>;
  readonly compare?: Maybe<ReadonlyArray<string>>;
}

/**
 * A structured Choice option.
 *
 * CONTRASTIVE by design: use the SAME keys on every option of a question so the model compares like
 * with like. `not_for` is where an option's boundary against its neighbours goes.
 */
export interface OpenRouterDecisionStructuredCriterion {
  readonly what: string;
  readonly not_for?: Maybe<string>;
  readonly examples?: Maybe<ReadonlyArray<string>>;
}

/**
 * A structured Score level.
 *
 * `what` is a SITUATION, not a degree — "broken or degraded feature, but a workaround exists" gives the
 * model something to match the state against, where "moderately severe" does not. Use the same keys on
 * every level of a question.
 */
export interface OpenRouterDecisionStructuredLevel {
  readonly what: string;
  readonly signals?: Maybe<ReadonlyArray<string>>;
  readonly examples?: Maybe<ReadonlyArray<string>>;
}

/**
 * The declared options of a Choice, keyed by the option name the answer will quote.
 *
 * A `null` / absent description declares an UNDESCRIBED option, which is the right thing when the state
 * already carries the option's own text.
 */
export type OpenRouterDecisionChoiceOptions<O extends string = string> = Readonly<Record<O, Maybe<OpenRouterDecisionEntry>>>;

/**
 * The two sides of a Noul, for a condition whose boundary is worth stating explicitly.
 *
 * Both sides or neither — a one-sided definition is not expressible, because a `true` with no matching
 * `false` measurably degrades the answer.
 */
export interface OpenRouterDecisionNoulMeans {
  readonly true: OpenRouterDecisionEntry;
  readonly false: OpenRouterDecisionEntry;
}

/**
 * "Which of these options?"
 *
 * A Choice is only ever RELATIVE: the probabilities are normalised over the options supplied, so
 * something always wins even when nothing fits. When "nothing fits" is an outcome the caller acts on, a
 * Noul rides beside the Choice — it is absolute, and may be low for every option.
 */
export interface OpenRouterDecisionChoiceQuestion<O extends string = string> {
  readonly type: 'choice';
  readonly instructions: OpenRouterDecisionEntry;
  readonly options: OpenRouterDecisionChoiceOptions<O>;
}

/**
 * The levels of a Score, lowest to highest, as accepted by {@link openRouterScoreQuestion}.
 *
 * A tuple rather than an array so the two-level minimum is a COMPILE error for a question written in
 * code. The question interface itself holds a plain array, because a question read back out of storage
 * is one.
 */
export type OpenRouterDecisionScoreLevels = readonly [OpenRouterDecisionEntry, OpenRouterDecisionEntry, ...OpenRouterDecisionEntry[]];

/**
 * "Which level on this rubric?"
 *
 * The answer may land BETWEEN two levels, so cross a THRESHOLD with a score and never try to recover a
 * magnitude from one. Every level is evaluated separately and the model never sees a level's number or
 * its neighbours, which is why numbers in the level descriptions do not help and situations do.
 */
export interface OpenRouterDecisionScoreQuestion {
  readonly type: 'score';
  readonly instructions: OpenRouterDecisionEntry;
  readonly levels: ReadonlyArray<OpenRouterDecisionEntry>;
}

/**
 * "Is this true?"
 *
 * The returned probability IS the uncertainty, so a Noul carries no separate confidence. Define the
 * CONDITION: "states they used Python at work" is a Noul, while "strong in Python" is a Score.
 */
export interface OpenRouterDecisionNoulQuestion {
  readonly type: 'noul';
  readonly instructions: OpenRouterDecisionEntry;
  readonly means?: Maybe<OpenRouterDecisionNoulMeans>;
}

/**
 * Any one declared question.
 */
export type OpenRouterDecisionQuestion<O extends string = string> = OpenRouterDecisionChoiceQuestion<O> | OpenRouterDecisionScoreQuestion | OpenRouterDecisionNoulQuestion;

/**
 * The questions one decision declares, keyed by {@link OpenRouterDecisionQuestionId}.
 *
 * Declare every question one state could need in ONE call: each is evaluated independently against the
 * same state, so the map is both the batching unit and the cost unit. The state is sent (and billed)
 * once, and a speculative question the caller may discard costs only its own tokens.
 */
export type OpenRouterDecisionQuestions = Readonly<Record<OpenRouterDecisionQuestionId, OpenRouterDecisionQuestion>>;

/**
 * The content to judge.
 *
 * Prefer an object so each part has a NAME a question can point at. Filtering belongs in code first:
 * accuracy falls as a state grows with material unrelated to the decision, so a wide state is not a
 * free hedge.
 */
export type OpenRouterDecisionState = string | Readonly<Record<string, unknown>> | ReadonlyArray<unknown>;

/**
 * A decision state in the form durable storage can hold: an object or an array, never a bare string.
 *
 * The narrowing is not a storage workaround dressed up as doctrine — it IS the doctrine. A state should
 * be an object anyway, so each part has a name a question can point at with the backticked dot-path
 * convention; a bare string leaves every question describing the state again in prose. A caller whose
 * state really is one value names it (`{ phrase: '…' }`) and gets a question that can say `` `phrase` ``.
 *
 * (It also happens to be what a JSON-string Firestore field can carry, which is why the queued arm of
 * the execution system takes this rather than {@link OpenRouterDecisionState}.)
 */
export type OpenRouterStorableDecisionState = Exclude<OpenRouterDecisionState, string>;

/**
 * The answer to a Choice.
 *
 * `choice` is GUARANTEED to be one of the declared options — that is the transport's contract, checked
 * by `readOpenRouterDecisionAnswers` — and `probabilities` covers every declared option, summing to 1.
 * Both `probabilities` and `confidence` are optional: an absent one is a real reply, not a fault.
 */
export interface OpenRouterDecisionChoiceAnswer<O extends string = string> {
  readonly type: 'choice';
  readonly choice: O;
  readonly probabilities?: Maybe<Readonly<Record<O, number>>>;
  readonly confidence?: Maybe<number>;
}

/**
 * The answer to a Score.
 *
 * `legend` echoes the declared levels back, keyed by their index as a string.
 */
export interface OpenRouterDecisionScoreAnswer {
  readonly type: 'score';
  readonly score: number;
  readonly legend?: Maybe<Readonly<Record<string, OpenRouterDecisionEntry>>>;
  readonly probabilities?: Maybe<Readonly<Record<string, number>>>;
  readonly confidence?: Maybe<number>;
}

/**
 * The answer to a Noul: the probability the condition holds, 0..1.
 */
export interface OpenRouterDecisionNoulAnswer {
  readonly type: 'noul';
  readonly noul: number;
}

/**
 * Any one answer.
 */
export type OpenRouterDecisionAnswer<O extends string = string> = OpenRouterDecisionChoiceAnswer<O> | OpenRouterDecisionScoreAnswer | OpenRouterDecisionNoulAnswer;

/**
 * The answer type a given declared question produces.
 */
export type OpenRouterDecisionAnswerFor<Q extends OpenRouterDecisionQuestion> = Q extends OpenRouterDecisionNoulQuestion
  ? OpenRouterDecisionNoulAnswer
  : Q extends OpenRouterDecisionScoreQuestion
    ? OpenRouterDecisionScoreAnswer
    : Q extends OpenRouterDecisionChoiceQuestion<infer O>
      ? OpenRouterDecisionChoiceAnswer<O>
      : never;

/**
 * The answers a declared question map produces.
 *
 * DERIVED from the questions rather than declared beside them, so a caller reads `answers.urgency.score`
 * with no cast and a renamed question is a compile error at every reader.
 */
export type OpenRouterDecisionAnswers<Q extends OpenRouterDecisionQuestions = OpenRouterDecisionQuestions> = { readonly [K in keyof Q]: OpenRouterDecisionAnswerFor<Q[K]> };

/**
 * A coarse reading of a Choice or Score `confidence`.
 */
export type OpenRouterDecisionConfidenceBand = 'high' | 'medium' | 'low';

/**
 * Confidence at or above which {@link asOpenRouterDecisionConfidenceBand} reads `high`.
 *
 * A documented STARTING POINT, not a tuned threshold. Note also that a Noul probability and a Choice
 * confidence answer different questions and are not comparable, so a threshold calibrated for one may
 * not be carried over to the other.
 */
export const OPENROUTER_DECISION_CONFIDENCE_HIGH = 0.75;

/**
 * Confidence at or above which {@link asOpenRouterDecisionConfidenceBand} reads `medium`.
 *
 * See the note on {@link OPENROUTER_DECISION_CONFIDENCE_HIGH}.
 */
export const OPENROUTER_DECISION_CONFIDENCE_MEDIUM = 0.5;

/**
 * Most options a single Choice may declare.
 *
 * A hard transport limit, not a guideline. Past it, narrow in two stages — ask a first Choice that picks
 * the branch, then a second over that branch's members — rather than truncating the set, because an
 * option that was truncated away is one the model can never pick and nothing reports that it was missing.
 */
export const OPENROUTER_DECISION_CHOICE_OPTIONS_MAX = 255;

/**
 * Fewest levels a Score may declare.
 */
export const OPENROUTER_DECISION_SCORE_LEVELS_MIN = 2;

/**
 * Most levels a Score may declare.
 *
 * The trap this guards: a 0..8 band is NINE levels and legal, while a 0..10 scale is eleven and is
 * rejected at the wire. Past the ceiling, MERGE the levels that cannot be told apart — never truncate
 * the top, which silently removes the extreme the threshold usually cares about.
 */
export const OPENROUTER_DECISION_SCORE_LEVELS_MAX = 10;

/**
 * Whether a declaration entry says nothing at all.
 *
 * A blank string, an empty array, and a keyless object all ask nothing, and all three reach the wire as
 * a question the model cannot answer.
 *
 * @param entry - The entry to test.
 * @returns True when the entry carries no guidance.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isBlankOpenRouterDecisionEntry(entry: Maybe<OpenRouterDecisionEntry>): boolean {
  let result: boolean;

  if (entry == null) {
    result = true;
  } else if (typeof entry === 'string') {
    result = entry.trim() === '';
  } else if (Array.isArray(entry)) {
    result = entry.length === 0;
  } else {
    result = Object.keys(entry).length === 0;
  }

  return result;
}

/**
 * The option names a Choice declared — what the model was SHOWN.
 *
 * @param question - The choice question.
 * @returns The declared option names, in declaration order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterDecisionChoiceOptionNames<O extends string = string>(question: OpenRouterDecisionChoiceQuestion<O>): O[] {
  return Object.keys(question.options) as O[];
}

/**
 * Reads a confidence as a band.
 *
 * An ABSENT confidence reads `low` rather than throwing: the model is not required to report one, and a
 * caller that branches on the band should treat "did not say" the same as "not sure".
 *
 * @param confidence - The reported confidence, if any.
 * @returns The band.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function asOpenRouterDecisionConfidenceBand(confidence: Maybe<number>): OpenRouterDecisionConfidenceBand {
  let result: OpenRouterDecisionConfidenceBand;

  if (confidence == null || confidence < OPENROUTER_DECISION_CONFIDENCE_MEDIUM) {
    result = 'low';
  } else if (confidence >= OPENROUTER_DECISION_CONFIDENCE_HIGH) {
    result = 'high';
  } else {
    result = 'medium';
  }

  return result;
}

/**
 * One row of a Choice's distribution.
 */
export interface OpenRouterDecisionChoiceRankingRow<O extends string = string> {
  readonly option: O;
  readonly probability: number;
}

/**
 * Reads a Choice's distribution as a ranking, most probable first.
 *
 * The distribution is a FREE full ranking — the model reports every option, not just the winner — so a
 * caller wanting a shortlist should read this rather than paying for a second question.
 *
 * Returns an empty array when the answer carried no distribution, which is a real reply rather than an
 * error. The sort is stable, so tied options keep declaration order.
 *
 * @param answer - The choice answer.
 * @returns The ranking rows.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterDecisionChoiceRanking<O extends string = string>(answer: OpenRouterDecisionChoiceAnswer<O>): OpenRouterDecisionChoiceRankingRow<O>[] {
  const probabilities = answer.probabilities;
  return probabilities == null ? [] : (Object.keys(probabilities) as O[]).map((option) => ({ option, probability: probabilities[option] })).sort((a, b) => b.probability - a.probability);
}

/**
 * Config for {@link mapOpenRouterDecisionChoiceRows}.
 */
export interface MapOpenRouterDecisionChoiceRowsConfig<Q extends OpenRouterDecisionQuestions, K extends keyof Q & string, R> {
  /**
   * The answers the decision returned.
   */
  readonly answers: OpenRouterDecisionAnswers<Q>;
  /**
   * Which question's distribution to read.
   */
  readonly question: K;
  /**
   * Resolves one declared option name back to the caller's own row. Return null to drop it.
   */
  readonly rowOf: (option: string) => Maybe<R>;
}

/**
 * One of the caller's own rows, with the probability the model gave it.
 */
export interface OpenRouterDecisionChoiceRow<R> {
  readonly row: R;
  readonly probability: number;
}

/**
 * Reads a Choice's distribution back as the caller's OWN rows, most probable first.
 *
 * The seam exists because a Choice's options are usually derived from rows the caller already holds, and
 * walking the distribution back to them by hand at every call site is where the option-name convention
 * quietly drifts.
 *
 * @param config - The answers, the question to read, and how to resolve an option to a row.
 * @returns The resolved rows, most probable first. Options that resolve to nothing are dropped.
 */
export function mapOpenRouterDecisionChoiceRows<Q extends OpenRouterDecisionQuestions, K extends keyof Q & string, R>(config: MapOpenRouterDecisionChoiceRowsConfig<Q, K, R>): OpenRouterDecisionChoiceRow<R>[] {
  const { answers, question, rowOf } = config;
  const answer = answers[question] as OpenRouterDecisionAnswer;

  return answer.type === 'choice'
    ? openRouterDecisionChoiceRanking(answer)
        .map(({ option, probability }) => ({ row: rowOf(option), probability }))
        .filter((x): x is OpenRouterDecisionChoiceRow<R> => x.row != null)
    : [];
}

/**
 * Matches a backticked dot-and-index path, the convention for naming a part of the state from inside
 * `instructions`.
 */
const OPENROUTER_DECISION_STATE_PATH_REGEX = /`([A-Za-z_$][\w$]*((\.[A-Za-z_$][\w$]*)|(\[\d+\]))*)`/g;

/**
 * Reads back the state paths a declaration entry names.
 *
 * The convention is to name a part of the state as a dot-and-index path IN BACKTICKS — `` `phrase` ``,
 * `` `ticket.sender.email` ``, `` `messages[0].text` `` — so a question points at something the state
 * actually carries rather than describing it again in prose.
 *
 * Documented and inspectable, deliberately NOT enforced: backticks also legitimately quote an option key
 * or a literal, so a spec may pin that a declaration points at keys its state has, while the transport
 * never refuses one that does not.
 *
 * @param entry - The entry to read. Objects and arrays are walked.
 * @returns The paths, deduplicated, in the order they first appear.
 */
export function openRouterDecisionStatePaths(entry: Maybe<OpenRouterDecisionEntry>): string[] {
  const found = new Set<string>();

  function read(value: unknown): void {
    if (typeof value === 'string') {
      for (const match of value.matchAll(OPENROUTER_DECISION_STATE_PATH_REGEX)) {
        found.add(match[1]);
      }
    } else if (Array.isArray(value)) {
      value.forEach(read);
    } else if (value != null && typeof value === 'object') {
      Object.values(value).forEach(read);
    }
  }

  read(entry);

  return Array.from(found);
}

/**
 * Declares a Choice question.
 *
 * Supply the FULL option set, plus an explicit `other` / `none of the above` when the set may not cover
 * the input — the distribution is normalised over what was supplied, so a Choice always names a winner
 * whether or not one fits.
 *
 * @param instructions - The complete question, as the model will read it.
 * @param options - The options, keyed by the name the answer will quote.
 * @returns The declared question.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterChoiceQuestion<O extends string = string>(instructions: OpenRouterDecisionEntry, options: OpenRouterDecisionChoiceOptions<O>): OpenRouterDecisionChoiceQuestion<O> {
  return { type: 'choice', instructions, options };
}

/**
 * Declares a Score question.
 *
 * Use as many levels as can be described DISTINCTLY, lowest to highest — three is fine, and a rare
 * extreme deserves its own level. One dimension per question.
 *
 * @param instructions - The complete question, as the model will read it.
 * @param levels - The levels, lowest first. At least two.
 * @returns The declared question.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterScoreQuestion(instructions: OpenRouterDecisionEntry, levels: OpenRouterDecisionScoreLevels): OpenRouterDecisionScoreQuestion {
  return { type: 'score', instructions, levels: [...levels] };
}

/**
 * Declares a Noul question.
 *
 * @param instructions - The complete question, as the model will read it.
 * @param means - Optional explicit definitions of the true and false sides.
 * @returns The declared question.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterNoulQuestion(instructions: OpenRouterDecisionEntry, means?: Maybe<OpenRouterDecisionNoulMeans>): OpenRouterDecisionNoulQuestion {
  return { type: 'noul', instructions, ...(means == null ? undefined : { means }) };
}

/**
 * Describes what is wrong with one declared question, or undefined when nothing is.
 *
 * @param question - The question to check.
 * @returns The problem, or undefined.
 */
function openRouterDecisionQuestionDeclarationDetail(question: OpenRouterDecisionQuestion): Maybe<string> {
  let result: Maybe<string>;

  if (isBlankOpenRouterDecisionEntry(question.instructions)) {
    result = 'a question with no instructions asks nothing';
  } else {
    switch (question.type) {
      case 'choice': {
        const options = openRouterDecisionChoiceOptionNames(question).length;

        if (options === 0) {
          result = 'a Choice declaring no options asks nothing';
        } else if (options > OPENROUTER_DECISION_CHOICE_OPTIONS_MAX) {
          result = `a Choice may declare at most ${OPENROUTER_DECISION_CHOICE_OPTIONS_MAX} options and this one declares ${options}; narrow in two stages rather than truncating`;
        }

        break;
      }
      case 'score': {
        const levels = question.levels.length;

        if (levels < OPENROUTER_DECISION_SCORE_LEVELS_MIN) {
          result = `a Score needs at least ${OPENROUTER_DECISION_SCORE_LEVELS_MIN} ordered levels and this one declares ${levels}`;
        } else if (levels > OPENROUTER_DECISION_SCORE_LEVELS_MAX) {
          result = `a Score may declare at most ${OPENROUTER_DECISION_SCORE_LEVELS_MAX} levels and this one declares ${levels}; merge the levels that cannot be described distinctly rather than truncating the top`;
        }

        break;
      }
      case 'noul':
        // No further guard: `means` is both sides or neither by type, so there is no half-declared Noul
        // to catch here.
        break;
    }
  }

  return result;
}

/**
 * Validates a declared question map.
 *
 * Every problem here fails AT THE DECLARATION, naming the question, rather than as a 4xx about a request
 * body — which is the difference between a publish that is refused and a run that dies in a sweep at 2am.
 *
 * Returns the package's standard validation result so a caller can report question problems and config
 * problems through one surface.
 *
 * @param questions - The declared questions.
 * @returns The validation result.
 */
export function validateOpenRouterDecisionQuestions(questions: Maybe<OpenRouterDecisionQuestions>): OpenRouterModelConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = questions == null ? [] : Object.keys(questions);

  if (ids.length === 0) {
    errors.push('No questions were declared. A decision asks the model to pick a position inside an answer space, so there is nothing to ask without one.');
  }

  ids.forEach((id) => {
    const detail = openRouterDecisionQuestionDeclarationDetail((questions as OpenRouterDecisionQuestions)[id]);

    if (detail != null) {
      errors.push(`Question \`${id}\` cannot be asked: ${detail}.`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}
