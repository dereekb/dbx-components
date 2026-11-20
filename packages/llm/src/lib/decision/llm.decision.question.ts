import { isNotBlankString, type Maybe, type Count, type PercentDecimal } from '@dereekb/util';

/**
 * Identifier a caller gives one question inside a decision.
 *
 * The id is NEVER sent to the model — it is only how the caller addresses the matching answer — so a
 * self-explanatory key is no substitute for writing the complete question in `instructions`.
 */
export type LlmDecisionQuestionId = string;

/**
 * Discriminator of the three System One question primitives.
 */
export type LlmDecisionQuestionType = 'choice' | 'score' | 'noul';

/**
 * One piece of declaration guidance: a question's `instructions`, a Choice option, a Score level, or a
 * side of a Noul.
 *
 * Every declaration surface accepts a string, an object, or an array, and the wire carries whichever was
 * supplied VERBATIM. Start with strings — a short unambiguous criterion stays one. Structure is for
 * guidance prose would blur, and for data that is already JSON (a taxonomy branch, a database row):
 * serializing a row into a sentence so the model can read it back out is work the model does not need.
 */
export type LlmDecisionEntry = string | Readonly<Record<string, unknown>> | ReadonlyArray<unknown>;

/**
 * Structured `instructions`, for a question with several parts.
 *
 * `inspect` and `compare` name parts of the state, in the same backticked dot-path convention prose
 * instructions use.
 *
 * A `type` alias, not an `interface`, and deliberately so for all three structured shapes: an interface
 * has no implicit index signature, so a value typed as one is NOT assignable to the
 * `Readonly<Record<string, unknown>>` arm of {@link LlmDecisionEntry} — a structured entry
 * declared through its own name would then be refused by the very builders it exists to feed.
 */
export type LlmDecisionStructuredInstructions = {
  readonly question: string;
  readonly focus?: Maybe<string>;
  readonly inspect?: Maybe<string | ReadonlyArray<string>>;
  readonly compare?: Maybe<ReadonlyArray<string>>;
};

/**
 * A structured Choice option.
 *
 * CONTRASTIVE by design: use the SAME keys on every option of a question so the model compares like
 * with like. `not_for` is where an option's boundary against its neighbours goes.
 */
export type LlmDecisionStructuredCriterion = {
  readonly what: string;
  readonly not_for?: Maybe<string>;
  readonly examples?: Maybe<ReadonlyArray<string>>;
};

/**
 * A structured Score level.
 *
 * `what` is a SITUATION, not a degree — "broken or degraded feature, but a workaround exists" gives the
 * model something to match the state against, where "moderately severe" does not. Use the same keys on
 * every level of a question.
 */
export type LlmDecisionStructuredLevel = {
  readonly what: string;
  readonly signals?: Maybe<ReadonlyArray<string>>;
  readonly examples?: Maybe<ReadonlyArray<string>>;
};

/**
 * The declared options of a Choice, keyed by the option name the answer will quote.
 *
 * A `null` / absent description declares an UNDESCRIBED option, which is the right thing when the state
 * already carries the option's own text.
 */
export type LlmDecisionChoiceOptions<O extends string = string> = Readonly<Record<O, Maybe<LlmDecisionEntry>>>;

/**
 * The two sides of a Noul, for a condition whose boundary is worth stating explicitly.
 *
 * Both sides or neither — a one-sided definition is not expressible, because a `true` with no matching
 * `false` measurably degrades the answer.
 */
export interface LlmDecisionNoulMeans {
  readonly true: LlmDecisionEntry;
  readonly false: LlmDecisionEntry;
}

/**
 * "Which of these options?"
 *
 * A Choice is only ever RELATIVE: the probabilities are normalised over the options supplied, so
 * something always wins even when nothing fits. When "nothing fits" is an outcome the caller acts on, a
 * Noul rides beside the Choice — it is absolute, and may be low for every option.
 */
export interface LlmDecisionChoiceQuestion<O extends string = string> {
  readonly type: 'choice';
  readonly instructions: LlmDecisionEntry;
  readonly options: LlmDecisionChoiceOptions<O>;
}

/**
 * The levels of a Score, lowest to highest, as accepted by {@link llmScoreQuestion}.
 *
 * A tuple rather than an array so the two-level minimum is a COMPILE error for a question written in
 * code. The question interface itself holds a plain array, because a question read back out of storage
 * is one.
 */
export type LlmDecisionScoreLevels = readonly [LlmDecisionEntry, LlmDecisionEntry, ...LlmDecisionEntry[]];

/**
 * "Which level on this rubric?"
 *
 * The answer may land BETWEEN two levels, so cross a THRESHOLD with a score and never try to recover a
 * magnitude from one. Every level is evaluated separately and the model never sees a level's number or
 * its neighbours, which is why numbers in the level descriptions do not help and situations do.
 */
export interface LlmDecisionScoreQuestion {
  readonly type: 'score';
  readonly instructions: LlmDecisionEntry;
  readonly levels: ReadonlyArray<LlmDecisionEntry>;
}

/**
 * "Is this true?"
 *
 * The returned probability IS the uncertainty, so a Noul carries no separate confidence. Define the
 * CONDITION: "states they used Python at work" is a Noul, while "strong in Python" is a Score.
 */
export interface LlmDecisionNoulQuestion {
  readonly type: 'noul';
  readonly instructions: LlmDecisionEntry;
  readonly means?: Maybe<LlmDecisionNoulMeans>;
}

/**
 * Any one declared question.
 */
export type LlmDecisionQuestion<O extends string = string> = LlmDecisionChoiceQuestion<O> | LlmDecisionScoreQuestion | LlmDecisionNoulQuestion;

/**
 * The questions one decision declares, keyed by {@link LlmDecisionQuestionId}.
 *
 * Declare every question one state could need in ONE call: each is evaluated independently against the
 * same state, so the map is both the batching unit and the cost unit. The state is sent (and billed)
 * once, and a speculative question the caller may discard costs only its own tokens.
 */
export type LlmDecisionQuestions = Readonly<Record<LlmDecisionQuestionId, LlmDecisionQuestion>>;

/**
 * The content to judge.
 *
 * Prefer an object so each part has a NAME a question can point at. Filtering belongs in code first:
 * accuracy falls as a state grows with material unrelated to the decision, so a wide state is not a
 * free hedge.
 */
export type LlmDecisionState = string | Readonly<Record<string, unknown>> | ReadonlyArray<unknown>;

/**
 * A decision state in the form durable storage can hold: an object or an array, never a bare string.
 *
 * The narrowing is not a storage workaround dressed up as doctrine — it IS the doctrine. A state should
 * be an object anyway, so each part has a name a question can point at with the backticked dot-path
 * convention; a bare string leaves every question describing the state again in prose. A caller whose
 * state really is one value names it (`{ phrase: '…' }`) and gets a question that can say `` `phrase` ``.
 *
 * (It also happens to be what a JSON-string Firestore field can carry, which is why the queued arm of
 * the execution system takes this rather than {@link LlmDecisionState}.)
 */
export type LlmStorableDecisionState = Exclude<LlmDecisionState, string>;

/**
 * The answer to a Choice.
 *
 * `choice` is GUARANTEED to be one of the declared options — that is the transport's contract, checked
 * by `readLlmDecisionAnswers` — and `probabilities` covers every declared option, summing to 1.
 * Both `probabilities` and `confidence` are optional: an absent one is a real reply, not a fault.
 */
export interface LlmDecisionChoiceAnswer<O extends string = string> {
  readonly type: 'choice';
  readonly choice: O;
  readonly probabilities?: Maybe<Readonly<Record<O, PercentDecimal>>>;
  readonly confidence?: Maybe<PercentDecimal>;
}

/**
 * The answer to a Score.
 *
 * `legend` echoes the declared levels back, keyed by their index as a string.
 */
export interface LlmDecisionScoreAnswer {
  readonly type: 'score';
  readonly score: number;
  readonly legend?: Maybe<Readonly<Record<string, LlmDecisionEntry>>>;
  readonly probabilities?: Maybe<Readonly<Record<string, PercentDecimal>>>;
  readonly confidence?: Maybe<PercentDecimal>;
}

/**
 * The answer to a Noul: the probability the condition holds, 0..1.
 */
export interface LlmDecisionNoulAnswer {
  readonly type: 'noul';
  readonly noul: PercentDecimal;
}

/**
 * Any one answer.
 */
export type LlmDecisionAnswer<O extends string = string> = LlmDecisionChoiceAnswer<O> | LlmDecisionScoreAnswer | LlmDecisionNoulAnswer;

/**
 * The answer type a given declared question produces.
 */
export type LlmDecisionAnswerFor<Q extends LlmDecisionQuestion> = Q extends LlmDecisionNoulQuestion ? LlmDecisionNoulAnswer : Q extends LlmDecisionScoreQuestion ? LlmDecisionScoreAnswer : Q extends LlmDecisionChoiceQuestion<infer O> ? LlmDecisionChoiceAnswer<O> : never;

/**
 * The answers a declared question map produces.
 *
 * DERIVED from the questions rather than declared beside them, so a caller reads `answers.urgency.score`
 * with no cast and a renamed question is a compile error at every reader.
 */
export type LlmDecisionAnswers<Q extends LlmDecisionQuestions = LlmDecisionQuestions> = { readonly [K in keyof Q]: LlmDecisionAnswerFor<Q[K]> };

/**
 * A coarse reading of a Choice or Score `confidence`.
 */
export type LlmDecisionConfidenceBand = 'high' | 'medium' | 'low';

/**
 * Confidence at or above which {@link toLlmDecisionConfidenceBand} reads `high`.
 *
 * A documented STARTING POINT, not a tuned threshold. Note also that a Noul probability and a Choice
 * confidence answer different questions and are not comparable, so a threshold calibrated for one may
 * not be carried over to the other.
 */
export const LLM_DECISION_CONFIDENCE_HIGH: PercentDecimal = 0.75;

/**
 * Confidence at or above which {@link toLlmDecisionConfidenceBand} reads `medium`.
 *
 * See the note on {@link LLM_DECISION_CONFIDENCE_HIGH}.
 */
export const LLM_DECISION_CONFIDENCE_MEDIUM: PercentDecimal = 0.5;

/**
 * Most options a single Choice may declare.
 *
 * A hard transport limit of the decision route on every gateway that serves it, not a guideline. Past it,
 * narrow in two stages — ask a first Choice that picks the branch, then a second over that branch's members —
 * rather than truncating the set, because an option that was truncated away is one the model can never pick
 * and nothing reports that it was missing.
 */
export const LLM_DECISION_CHOICE_OPTIONS_MAX: Count = 255;

/**
 * Fewest levels a Score may declare.
 */
export const LLM_DECISION_SCORE_LEVELS_MIN: Count = 2;

/**
 * Most levels a Score may declare.
 *
 * The trap this guards: a 0..8 band is NINE levels and legal, while a 0..10 scale is eleven and is
 * rejected at the wire. Like the option ceiling, it is a transport limit of the decision route on every gateway
 * that serves it. Past the ceiling, MERGE the levels that cannot be told apart — never truncate
 * the top, which silently removes the extreme the threshold usually cares about.
 */
export const LLM_DECISION_SCORE_LEVELS_MAX: Count = 10;

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
export function isBlankLlmDecisionEntry(entry: Maybe<LlmDecisionEntry>): boolean {
  let result: boolean;

  if (entry == null) {
    result = true;
  } else if (typeof entry === 'string') {
    result = !isNotBlankString(entry);
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
export function llmDecisionChoiceOptionNames<O extends string = string>(question: LlmDecisionChoiceQuestion<O>): O[] {
  return Object.keys(question.options) as O[];
}

/**
 * Reads a confidence as a band.
 *
 * An ABSENT confidence reads `low` rather than throwing: the model is not required to report one, and a
 * caller that branches on the band should treat "did not say" the same as "not sure". A non-finite one
 * (`NaN`, `Infinity`) reads `low` for the same reason — a garbled number is not a report of certainty,
 * and without the guard `NaN` fails every comparison below and falls through to `medium`.
 *
 * @param confidence - The reported confidence, if any.
 * @returns The band.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toLlmDecisionConfidenceBand(confidence: Maybe<PercentDecimal>): LlmDecisionConfidenceBand {
  let result: LlmDecisionConfidenceBand;

  if (confidence == null || !Number.isFinite(confidence) || confidence < LLM_DECISION_CONFIDENCE_MEDIUM) {
    result = 'low';
  } else if (confidence >= LLM_DECISION_CONFIDENCE_HIGH) {
    result = 'high';
  } else {
    result = 'medium';
  }

  return result;
}

/**
 * One row of a Choice's distribution.
 */
export interface LlmDecisionChoiceRankingRow<O extends string = string> {
  readonly option: O;
  readonly probability: PercentDecimal;
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
export function llmDecisionChoiceRanking<O extends string = string>(answer: LlmDecisionChoiceAnswer<O>): LlmDecisionChoiceRankingRow<O>[] {
  const probabilities = answer.probabilities;
  return probabilities == null ? [] : (Object.keys(probabilities) as O[]).map((option) => ({ option, probability: probabilities[option] })).sort((a, b) => b.probability - a.probability);
}

/**
 * Config for {@link mapLlmDecisionChoiceRows}.
 */
export interface MapLlmDecisionChoiceRowsConfig<Q extends LlmDecisionQuestions, K extends keyof Q & string, R> {
  /**
   * The answers the decision returned.
   */
  readonly answers: LlmDecisionAnswers<Q>;
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
export interface LlmDecisionChoiceRow<R> {
  readonly row: R;
  readonly probability: PercentDecimal;
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
export function mapLlmDecisionChoiceRows<Q extends LlmDecisionQuestions, K extends keyof Q & string, R>(config: MapLlmDecisionChoiceRowsConfig<Q, K, R>): LlmDecisionChoiceRow<R>[] {
  const { answers, question, rowOf } = config;
  const answer = answers[question] as LlmDecisionAnswer;

  return answer.type === 'choice'
    ? llmDecisionChoiceRanking(answer)
        .map(({ option, probability }) => ({ row: rowOf(option), probability }))
        .filter((x): x is LlmDecisionChoiceRow<R> => x.row != null)
    : [];
}

/**
 * Matches a backticked dot-and-index path, the convention for naming a part of the state from inside
 * `instructions`.
 */
const LLM_DECISION_STATE_PATH_REGEX = /`([A-Za-z_$][\w$]*((\.[A-Za-z_$][\w$]*)|(\[\d+\]))*)`/g;

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
 * A dotted STATE PATH, unlike a craft note's backticked `ask`, which names a flat site input
 * (`LLM_CRAFT_SITE_INPUT_NAME_PATTERN`): the grammars differ on purpose and are not shared.
 *
 * @param entry - The entry to read. Objects and arrays are walked.
 * @returns The paths, deduplicated, in the order they first appear.
 */
export function llmDecisionStatePaths(entry: Maybe<LlmDecisionEntry>): string[] {
  const found = new Set<string>();

  function read(value: unknown): void {
    if (typeof value === 'string') {
      for (const match of value.matchAll(LLM_DECISION_STATE_PATH_REGEX)) {
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
export function llmChoiceQuestion<O extends string = string>(instructions: LlmDecisionEntry, options: LlmDecisionChoiceOptions<O>): LlmDecisionChoiceQuestion<O> {
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
export function llmScoreQuestion(instructions: LlmDecisionEntry, levels: LlmDecisionScoreLevels): LlmDecisionScoreQuestion {
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
export function llmNoulQuestion(instructions: LlmDecisionEntry, means?: Maybe<LlmDecisionNoulMeans>): LlmDecisionNoulQuestion {
  return { type: 'noul', instructions, ...(means == null ? undefined : { means }) };
}

/**
 * Describes what is wrong with one declared question, or undefined when nothing is.
 *
 * @param question - The question to check.
 * @returns The problem, or undefined.
 */
function llmDecisionQuestionDeclarationDetail(question: LlmDecisionQuestion): Maybe<string> {
  let result: Maybe<string>;

  if (isBlankLlmDecisionEntry(question.instructions)) {
    result = 'a question with no instructions asks nothing';
  } else {
    switch (question.type) {
      case 'choice': {
        const options = llmDecisionChoiceOptionNames(question).length;

        if (options === 0) {
          result = 'a Choice declaring no options asks nothing';
        } else if (options > LLM_DECISION_CHOICE_OPTIONS_MAX) {
          result = `a Choice may declare at most ${LLM_DECISION_CHOICE_OPTIONS_MAX} options and this one declares ${options}; narrow in two stages rather than truncating`;
        }

        break;
      }
      case 'score': {
        const levels = question.levels.length;

        if (levels < LLM_DECISION_SCORE_LEVELS_MIN) {
          result = `a Score needs at least ${LLM_DECISION_SCORE_LEVELS_MIN} ordered levels and this one declares ${levels}`;
        } else if (levels > LLM_DECISION_SCORE_LEVELS_MAX) {
          result = `a Score may declare at most ${LLM_DECISION_SCORE_LEVELS_MAX} levels and this one declares ${levels}; merge the levels that cannot be described distinctly rather than truncating the top`;
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
 * The result of {@link validateLlmDecisionQuestions}.
 *
 * Structurally identical to the model-config validation result a gateway package returns, so values pass
 * both ways and a caller reports question problems and config problems through one surface.
 */
export interface LlmDecisionValidation {
  /**
   * Whether the declaration can be asked as written — true exactly when `errors` is empty.
   */
  readonly valid: boolean;
  /**
   * Every problem that blocks the declaration, each naming its question.
   */
  readonly errors: string[];
  /**
   * Problems that do not block the declaration.
   */
  readonly warnings: string[];
}

/**
 * Validates a declared question map.
 *
 * Every problem here fails AT THE DECLARATION, naming the question, rather than as a 4xx about a request
 * body — which is the difference between a publish that is refused and a run that dies in a sweep at 2am.
 *
 * Returns {@link LlmDecisionValidation} — the same `{ valid, errors, warnings }` shape a gateway's model-config
 * validator returns — so a caller can report question problems and config problems through one surface.
 *
 * @param questions - The declared questions.
 * @returns The validation result.
 */
export function validateLlmDecisionQuestions(questions: Maybe<LlmDecisionQuestions>): LlmDecisionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = questions == null ? [] : Object.keys(questions);

  if (ids.length === 0) {
    errors.push('No questions were declared. A decision asks the model to pick a position inside an answer space, so there is nothing to ask without one.');
  }

  ids.forEach((id) => {
    const detail = llmDecisionQuestionDeclarationDetail((questions as LlmDecisionQuestions)[id]);

    if (detail != null) {
      errors.push(`Question \`${id}\` cannot be asked: ${detail}.`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * The name a declared decision reports under — the same value a call record's `decision` column carries.
 *
 * An open string: each host names its own decisions.
 */
export type LlmDecisionKey = string;

/**
 * Raised when a decision cannot be asked as declared — no questions at all, an empty or oversized Choice, a
 * Score with too few or too many levels, a question with no instructions.
 *
 * Every declaration problem fails HERE — before a request is built, naming the question — rather than as
 * a 4xx about a request body. The distinction matters because the fixes are different: a malformed
 * declaration is a code or authoring bug, while a 4xx is an operational one.
 *
 * The guard itself is {@link validateLlmDecisionQuestions}; this error carries its collected `errors`, each of
 * which names its question, plus — when a declared decision asked — the one thing the guard cannot know: WHICH
 * decision it was.
 */
export class LlmDecisionDeclarationError extends Error {
  /**
   * The validation errors, each naming its question.
   */
  readonly errors: string[];
  /**
   * The declared decision that asked, when one did.
   */
  readonly decision?: Maybe<LlmDecisionKey>;

  constructor(errors: string[], decision?: Maybe<LlmDecisionKey>) {
    super(decision == null ? `This decision cannot be asked as declared: ${errors.join(' ')}` : `decision ${decision} cannot be asked: ${errors.join(' ')}`);
    this.name = 'LlmDecisionDeclarationError';
    this.errors = errors;

    if (decision != null) {
      this.decision = decision;
    }
  }
}
