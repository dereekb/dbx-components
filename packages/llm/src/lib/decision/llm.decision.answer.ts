import { type Maybe, type PercentDecimal } from '@dereekb/util';
import { type LlmGenerationId, type LlmModelId } from '../model/llm.value';
import { type LlmUsage } from '../strategy/llm.usage';
import { type LlmDecisionAnswer, type LlmDecisionAnswers, type LlmDecisionChoiceAnswer, type LlmDecisionChoiceQuestion, type LlmDecisionQuestion, type LlmDecisionQuestionId, type LlmDecisionQuestions, llmDecisionChoiceOptionNames } from './llm.decision.question';

/**
 * How far a distribution's probabilities may sum from 1 before the reply is read as malformed.
 *
 * Wide enough to absorb the float rounding a JSON round-trip introduces, narrow enough that a
 * distribution missing an option does not pass.
 */
export const LLM_DECISION_DISTRIBUTION_SUM_TOLERANCE: PercentDecimal = 0.05;

/**
 * What is wrong with one answer in a reply.
 */
export type LlmDecisionFaultKind = 'answer-missing' | 'answer-mistyped' | 'choice-off-option' | 'value-out-of-range';

/**
 * One thing wrong with a reply.
 */
export interface LlmDecisionFault {
  readonly kind: LlmDecisionFaultKind;
  readonly question: LlmDecisionQuestionId;
  readonly detail: string;
}

/**
 * What a decision reply was billed — everything an answered reply reports beside its answers. A transport reads it
 * BEFORE the answers, so a reply that left its answer space still hands its bill to the
 * {@link LlmDecisionAnswerFaultError} it throws: the gateway charged for the send either way.
 */
export interface LlmDecisionReplyBilling {
  /**
   * The model that answered, when the reply named one.
   */
  readonly model?: LlmModelId;
  /**
   * What the call cost, when the gateway reported it.
   */
  readonly usage?: LlmUsage;
  /**
   * The gateway's own id for the call — the handle a cost reconciliation is looked up by.
   */
  readonly generationId?: LlmGenerationId;
  /**
   * The upstream endpoint that served it, when the gateway echoed one.
   */
  readonly provider?: string;
}

/**
 * Raised when a reply did not answer the questions that were declared.
 *
 * This is always a defect in the RESPONSE and never a judgement the model made. "None of these fits" is
 * not a fault — it is said through a Noul the caller declared for it, and arrives as an ANSWER. A caller
 * that catches this is handling a malformed reply, not a negative one.
 */
export class LlmDecisionAnswerFaultError extends Error implements LlmDecisionReplyBilling {
  readonly faults: LlmDecisionFault[];
  // `declare`d, so a bill the reply did not report leaves no key at all rather than an `undefined` one
  declare readonly model?: LlmModelId;
  declare readonly usage?: LlmUsage;
  declare readonly generationId?: LlmGenerationId;
  declare readonly provider?: string;

  /**
   * @param faults - Everything wrong with the reply.
   * @param billing - What the faulted reply was billed, when the transport read it before the answers — so the failed
   *   call is recorded with the cost of a send the gateway still charged for.
   */
  constructor(faults: LlmDecisionFault[], billing?: Maybe<LlmDecisionReplyBilling>) {
    const described = faults.map((x) => x.question + ' (' + x.kind + '): ' + x.detail).join('; ');
    super(`The decision reply did not answer its declared questions: ${described}`);
    this.name = 'LlmDecisionAnswerFaultError';
    this.faults = faults;

    if (billing?.model != null) {
      this.model = billing.model;
    }

    if (billing?.usage != null) {
      this.usage = billing.usage;
    }

    if (billing?.generationId != null) {
      this.generationId = billing.generationId;
    }

    if (billing?.provider != null) {
      this.provider = billing.provider;
    }
  }
}

/**
 * Collects everything wrong with a Choice answer: an off-option choice, and a present distribution that covers an
 * undeclared option, carries a non-number entry or a probability outside 0..1 (NaN and the infinities included), or
 * does not sum to 1 within {@link LLM_DECISION_DISTRIBUTION_SUM_TOLERANCE}.
 *
 * @param question - The declared Choice question.
 * @param id - The question's id, for reporting.
 * @param answer - The Choice answer as returned.
 * @returns The faults found. Empty when the answer is well formed.
 */
function llmDecisionChoiceAnswerFaults(question: LlmDecisionChoiceQuestion, id: LlmDecisionQuestionId, answer: LlmDecisionChoiceAnswer): LlmDecisionFault[] {
  const faults: LlmDecisionFault[] = [];
  const declared = new Set<string>(llmDecisionChoiceOptionNames(question));

  if (!declared.has(answer.choice)) {
    faults.push({ kind: 'choice-off-option', question: id, detail: `\`${answer.choice}\` was not one of the declared options` });
  }

  const probabilities = answer.probabilities;

  if (probabilities != null) {
    const options = Object.keys(probabilities);
    const undeclared = options.filter((x) => !declared.has(x));

    if (undeclared.length > 0) {
      const names = undeclared.map((x) => '`' + x + '`').join(', ');
      faults.push({ kind: 'choice-off-option', question: id, detail: `the distribution covers undeclared options ${names}` });
    }

    const entries = probabilities as Readonly<Record<string, unknown>>;
    let entriesInRange = true;

    for (const option of options) {
      const probability = entries[option];

      if (typeof probability !== 'number') {
        entriesInRange = false;
        faults.push({ kind: 'value-out-of-range', question: id, detail: `the distribution's \`${option}\` is not a number` });
      } else if (!(probability >= 0 && probability <= 1)) {
        // Written as a negated range so NaN, which fails every comparison, faults here too.
        entriesInRange = false;
        faults.push({ kind: 'value-out-of-range', question: id, detail: `the distribution's \`${option}\` is ${probability}, outside 0..1` });
      }
    }

    // The sum is only meaningful over in-range numbers: a string entry would concatenate rather than add, and a
    // NaN or a -0.2/1.2 pair is already faulted per entry (and the pair would sum to a passing 1).
    if (entriesInRange) {
      const sum = options.reduce((total, option) => total + (entries[option] as number), 0);

      if (!(Math.abs(sum - 1) <= LLM_DECISION_DISTRIBUTION_SUM_TOLERANCE)) {
        faults.push({ kind: 'value-out-of-range', question: id, detail: `the distribution sums to ${sum} rather than 1` });
      }
    }
  }

  return faults;
}

/**
 * Collects everything wrong with one answer against the question that asked it.
 *
 * Beyond membership, the VALUE TYPES are checked too: a `noul`, a `score` and every distribution entry must be a
 * `number`. A transport that reads its reply lax (a raw `fetch`, no SDK decode) relies on this to refuse a `"0.5"`
 * that would otherwise slip through a range comparison by coercion.
 *
 * @param question - The declared question.
 * @param id - The question's id, for reporting.
 * @param raw - The answer as returned, if any — of any shape, since the reply is untrusted.
 * @returns The faults found. Empty when the answer is well formed.
 */
function llmDecisionAnswerFaults(question: LlmDecisionQuestion, id: LlmDecisionQuestionId, raw: unknown): LlmDecisionFault[] {
  const faults: LlmDecisionFault[] = [];
  // A non-object answer reads as a type-less one, so it faults as mistyped below rather than throwing on a property read.
  const answer = raw != null && typeof raw === 'object' ? (raw as LlmDecisionAnswer) : undefined;

  if (raw == null) {
    faults.push({ kind: 'answer-missing', question: id, detail: 'no answer was returned' });
  } else if (answer?.type !== question.type) {
    faults.push({ kind: 'answer-mistyped', question: id, detail: `a ${question.type} question was answered with a ${answer?.type}` });
  } else if (answer.type === 'choice' && question.type === 'choice') {
    faults.push(...llmDecisionChoiceAnswerFaults(question, id, answer));
  } else if (answer.type === 'score' && question.type === 'score') {
    const max = question.levels.length - 1;

    if (typeof answer.score !== 'number') {
      faults.push({ kind: 'value-out-of-range', question: id, detail: `the score \`${String(answer.score)}\` is not a number` });
    } else if (!(answer.score >= 0 && answer.score <= max)) {
      faults.push({ kind: 'value-out-of-range', question: id, detail: `the score ${answer.score} is outside the declared 0..${max}` });
    }
  } else if (answer.type === 'noul') {
    if (typeof answer.noul !== 'number') {
      faults.push({ kind: 'value-out-of-range', question: id, detail: `the noul \`${String(answer.noul)}\` is not a number` });
    } else if (!(answer.noul >= 0 && answer.noul <= 1)) {
      faults.push({ kind: 'value-out-of-range', question: id, detail: `the noul ${answer.noul} is outside 0..1` });
    }
  }

  return faults;
}

/**
 * The raw answers with every TYPE-LESS answer given the declared question's type — {@link ReadLlmDecisionAnswersConfig.laxAnswerTypes}.
 * A present `type` is never touched, an answer to an undeclared id is passed through for the membership check to ignore,
 * and a non-object answer is left for it to fault.
 *
 * @param questions - The declared questions.
 * @param raw - The answers as returned.
 * @returns A typed copy of the answers.
 */
function toTypedLlmDecisionAnswers(questions: LlmDecisionQuestions, raw: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const typed: Record<string, unknown> = {};

  for (const [id, answer] of Object.entries(raw)) {
    const question = questions[id];
    const typeless = question != null && answer != null && typeof answer === 'object' && (answer as { readonly type?: unknown }).type == null;
    typed[id] = typeless ? { ...answer, type: question.type } : answer;
  }

  return typed;
}

/**
 * Config for {@link readLlmDecisionAnswers} and {@link requireLlmDecisionAnswers}.
 */
export interface ReadLlmDecisionAnswersConfig<Q extends LlmDecisionQuestions> {
  /**
   * The questions that were declared.
   */
  readonly questions: Q;
  /**
   * The answers as returned, of any shape: the reader is the judge of what an answer is, so a caller never casts.
   */
  readonly raw: Readonly<Record<string, unknown>>;
  /**
   * When `true`, an answer that arrives with NO `type` is given its declared question's type before the membership
   * check (a gateway whose reply lists only the value fields — `noul`, `choice`, `score` — and not the discriminator). A
   * PRESENT `type` is never overwritten, so a Noul answered as a Choice still faults as `answer-mistyped`. Off by
   * default.
   */
  readonly laxAnswerTypes?: Maybe<boolean>;
}

/**
 * The inputs of {@link requireLlmDecisionAnswers} — the read's, plus the reply's bill for a fault to carry.
 */
export interface RequireLlmDecisionAnswersConfig<Q extends LlmDecisionQuestions> extends ReadLlmDecisionAnswersConfig<Q> {
  /**
   * What the reply was billed (`llmDecisionReplyBilling`), read before the answers — attached to the thrown fault.
   */
  readonly billing?: Maybe<LlmDecisionReplyBilling>;
}

/**
 * Either the answers, or everything wrong with them.
 */
export type LlmDecisionAnswersRead<Q extends LlmDecisionQuestions> = { readonly answers: LlmDecisionAnswers<Q>; readonly faults?: undefined } | { readonly answers?: undefined; readonly faults: LlmDecisionFault[] };

/**
 * Membership-checks a reply against the questions that were declared.
 *
 * This is the transport's GUARANTEE, and the reason no consumer re-checks: past this point a `choice` is
 * one of the declared options, a `score` is a number inside the declared range, and a `noul` is a numeric
 * probability. It is what a decision has instead of the parse-and-salvage a completion needs — the answer
 * space was declared, so an answer either sits inside it or the reply is broken.
 *
 * Every fault is collected rather than the first, because a reply that lost one answer has usually lost
 * more than one and reporting them one round-trip at a time is no way to debug a declaration.
 *
 * An ABSENT distribution or confidence is checked for nothing: only `choice` / `score` / `noul` are
 * guaranteed on the wire, so their absence is a real reply. A PRESENT distribution's entries must be numbers.
 *
 * With {@link ReadLlmDecisionAnswersConfig.laxAnswerTypes} on, type-less answers are typed first and the returned
 * `answers` is that typed copy; with it off, `raw` itself is returned.
 *
 * @param config - The declared questions, the raw answers and the lax-type option.
 * @returns The answers, or the faults.
 */
export function readLlmDecisionAnswers<Q extends LlmDecisionQuestions>(config: ReadLlmDecisionAnswersConfig<Q>): LlmDecisionAnswersRead<Q> {
  const { questions } = config;
  const raw = config.laxAnswerTypes === true ? toTypedLlmDecisionAnswers(questions, config.raw) : config.raw;
  const faults = Object.keys(questions).flatMap((id) => llmDecisionAnswerFaults(questions[id], id, raw[id]));
  return faults.length > 0 ? { faults } : { answers: raw as unknown as LlmDecisionAnswers<Q> };
}

/**
 * **The one THROWING read** of a decision reply — {@link readLlmDecisionAnswers}, with a reply that left its declared
 * answer space thrown as an {@link LlmDecisionAnswerFaultError} carrying EVERY fault rather than handed back as half an
 * answer set. What a decision transport (and a scripted backend) calls; a caller wanting a fallback expresses it as a
 * verdict of its own.
 *
 * @param config - The declared questions, the raw answers, the lax-type option and the reply's bill for a fault.
 * @returns The membership-checked answers.
 * @throws {LlmDecisionAnswerFaultError} When any declared question was not answered inside its answer space.
 *
 * @example
 * ```ts
 * const answers = requireLlmDecisionAnswers({ questions: { urgent: llmNoulQuestion('Is `ticket` urgent?') }, raw: { urgent: { type: 'noul', noul: 0.9 } } });
 * answers.urgent.noul; // 0.9
 * ```
 */
export function requireLlmDecisionAnswers<Q extends LlmDecisionQuestions>(config: RequireLlmDecisionAnswersConfig<Q>): LlmDecisionAnswers<Q> {
  const read = readLlmDecisionAnswers(config);

  if (read.faults != null) {
    throw new LlmDecisionAnswerFaultError(read.faults, config.billing);
  }

  return read.answers;
}
