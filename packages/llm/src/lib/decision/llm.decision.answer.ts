import { type Maybe } from '@dereekb/util';
import { type LlmDecisionAnswer, type LlmDecisionAnswers, type LlmDecisionQuestion, type LlmDecisionQuestionId, type LlmDecisionQuestions, llmDecisionChoiceOptionNames } from './llm.decision.question';

/**
 * How far a distribution's probabilities may sum from 1 before the reply is read as malformed.
 *
 * Wide enough to absorb the float rounding a JSON round-trip introduces, narrow enough that a
 * distribution missing an option does not pass.
 */
export const LLM_DECISION_DISTRIBUTION_SUM_TOLERANCE = 0.05;

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
 * Raised when a reply did not answer the questions that were declared.
 *
 * This is always a defect in the RESPONSE and never a judgement the model made. "None of these fits" is
 * not a fault — it is said through a Noul the caller declared for it, and arrives as an ANSWER. A caller
 * that catches this is handling a malformed reply, not a negative one.
 */
export class LlmDecisionAnswerFaultError extends Error {
  readonly faults: LlmDecisionFault[];

  constructor(faults: LlmDecisionFault[]) {
    const described = faults.map((x) => x.question + ' (' + x.kind + '): ' + x.detail).join('; ');
    super(`The decision reply did not answer its declared questions: ${described}`);
    this.name = 'LlmDecisionAnswerFaultError';
    this.faults = faults;
  }
}

/**
 * Collects everything wrong with one answer against the question that asked it.
 *
 * @param question - The declared question.
 * @param id - The question's id, for reporting.
 * @param answer - The answer as returned, if any.
 * @returns The faults found. Empty when the answer is well formed.
 */
function llmDecisionAnswerFaults(question: LlmDecisionQuestion, id: LlmDecisionQuestionId, answer: Maybe<LlmDecisionAnswer>): LlmDecisionFault[] {
  const faults: LlmDecisionFault[] = [];

  if (answer == null) {
    faults.push({ kind: 'answer-missing', question: id, detail: 'no answer was returned' });
  } else if (answer.type !== question.type) {
    faults.push({ kind: 'answer-mistyped', question: id, detail: `a ${question.type} question was answered with a ${answer.type}` });
  } else if (answer.type === 'choice' && question.type === 'choice') {
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

      const sum = options.reduce((total, option) => total + probabilities[option as keyof typeof probabilities], 0);

      if (Math.abs(sum - 1) > LLM_DECISION_DISTRIBUTION_SUM_TOLERANCE) {
        faults.push({ kind: 'value-out-of-range', question: id, detail: `the distribution sums to ${sum} rather than 1` });
      }
    }
  } else if (answer.type === 'score' && question.type === 'score') {
    const max = question.levels.length - 1;

    if (!(answer.score >= 0 && answer.score <= max)) {
      faults.push({ kind: 'value-out-of-range', question: id, detail: `the score ${answer.score} is outside the declared 0..${max}` });
    }
  } else if (answer.type === 'noul' && !(answer.noul >= 0 && answer.noul <= 1)) {
    faults.push({ kind: 'value-out-of-range', question: id, detail: `the noul ${answer.noul} is outside 0..1` });
  }

  return faults;
}

/**
 * Config for {@link readLlmDecisionAnswers}.
 */
export interface ReadLlmDecisionAnswersConfig<Q extends LlmDecisionQuestions> {
  /**
   * The questions that were declared.
   */
  readonly questions: Q;
  /**
   * The answers as returned.
   */
  readonly raw: Readonly<Record<string, Maybe<LlmDecisionAnswer>>>;
}

/**
 * Either the answers, or everything wrong with them.
 */
export type LlmDecisionAnswersRead<Q extends LlmDecisionQuestions> = { readonly answers: LlmDecisionAnswers<Q>; readonly faults?: undefined } | { readonly answers?: undefined; readonly faults: LlmDecisionFault[] };

/**
 * Membership-checks a reply against the questions that were declared.
 *
 * This is the transport's GUARANTEE, and the reason no consumer re-checks: past this point a `choice` is
 * one of the declared options, a `score` is inside the declared range, and a `noul` is a probability. It
 * is what a decision has instead of the parse-and-salvage a completion needs — the answer space was
 * declared, so an answer either sits inside it or the reply is broken.
 *
 * Every fault is collected rather than the first, because a reply that lost one answer has usually lost
 * more than one and reporting them one round-trip at a time is no way to debug a declaration.
 *
 * An ABSENT distribution or confidence is checked for nothing: only `choice` / `score` / `noul` are
 * guaranteed on the wire, so their absence is a real reply.
 *
 * @param config - The declared questions and the raw answers.
 * @returns The answers, or the faults.
 */
export function readLlmDecisionAnswers<Q extends LlmDecisionQuestions>(config: ReadLlmDecisionAnswersConfig<Q>): LlmDecisionAnswersRead<Q> {
  const { questions, raw } = config;
  const faults = Object.keys(questions).flatMap((id) => llmDecisionAnswerFaults(questions[id], id, raw[id]));
  return faults.length > 0 ? { faults } : { answers: raw as unknown as LlmDecisionAnswers<Q> };
}
