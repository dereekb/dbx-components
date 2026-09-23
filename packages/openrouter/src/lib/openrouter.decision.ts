import { type Maybe, filterUndefinedValues, mapObjectMap } from '@dereekb/util';
import { type OpenRouterModelConfig, type OpenRouterModelConfigValidation, mergeOpenRouterModelConfig } from './openrouter.config';
import {
  type OpenRouterDecisionAnswer,
  type OpenRouterDecisionAnswers,
  type OpenRouterDecisionEntry,
  type OpenRouterDecisionQuestion,
  type OpenRouterDecisionQuestionId,
  type OpenRouterDecisionQuestions,
  type OpenRouterDecisionState,
  openRouterDecisionChoiceOptionNames,
  validateOpenRouterDecisionQuestions
} from './openrouter.decision.question';
import { type OpenRouterResolvedPrompt } from './openrouter.prompt';
import { type OpenRouterRequestTrace } from './openrouter.request';
// TYPE-ONLY, and it must stay so: this file is the pure half of the decision layer and ships through the
// SDK-free `@dereekb/openrouter/decision` entry. `openrouter.sdk.ts` re-exports `@openrouter/sdk` VALUES,
// so a value import from it here would put the SDK on that entry's load path. The transport half — the one
// `systemOneCreate` user — is `openrouter.decision.call.ts`.
import type { DecisionsRequest, DecisionsResponse } from './openrouter.sdk';
import { type OpenRouterRunUsage, isOpenRouterSystemOneModelId } from './openrouter.type';

/**
 * How far a distribution's probabilities may sum from 1 before the reply is read as malformed.
 *
 * Wide enough to absorb the float rounding a JSON round-trip introduces, narrow enough that a
 * distribution missing an option does not pass.
 */
export const OPENROUTER_DECISION_DISTRIBUTION_SUM_TOLERANCE = 0.05;

/**
 * A caller-chosen id grouping related decisions for observability.
 *
 * Never sent to the provider — it exists for broadcast grouping and private logging only.
 */
export type OpenRouterDecisionSessionId = string;

/**
 * A decision request: the config naming the model, the state to judge, and the questions to ask of it.
 *
 * The decisions analogue of `OpenRouterPromptRequest`, and deliberately a separate type rather than a
 * mode on it. The two share no content at all — one carries messages and an output contract, the other
 * carries a state and an answer space — so folding them together would produce a type where half the
 * fields are meaningless on any given request.
 */
export interface OpenRouterDecisionRequest<Q extends OpenRouterDecisionQuestions = OpenRouterDecisionQuestions> {
  /**
   * The merged model config. Only `model`, `provider` and `user` reach the wire — see
   * {@link splitOpenRouterDecisionModelConfig}.
   */
  readonly config: OpenRouterModelConfig;
  /**
   * The content to judge.
   */
  readonly state: OpenRouterDecisionState;
  /**
   * The declared questions.
   */
  readonly questions: Q;
  /**
   * Observability grouping id.
   */
  readonly sessionId?: Maybe<OpenRouterDecisionSessionId>;
  /**
   * Trace metadata, carried exactly as it is on a completion request.
   */
  readonly trace?: Maybe<OpenRouterRequestTrace>;
}

/**
 * Params for {@link openRouterDecisionRequest}.
 */
export interface OpenRouterDecisionRequestParams<Q extends OpenRouterDecisionQuestions = OpenRouterDecisionQuestions> {
  /**
   * The resolved prompt version supplying the base config and any STORED questions.
   */
  readonly prompt?: Maybe<OpenRouterResolvedPrompt>;
  /**
   * The content to judge.
   */
  readonly state: OpenRouterDecisionState;
  /**
   * Questions declared by the caller for THIS call, merged over the prompt's stored questions by id.
   *
   * Dynamic questions are the normal case for a decision whose answer space is derived from data the
   * caller holds — a shortlist of rows, a set of candidates — which cannot be written down in advance.
   */
  readonly questions?: Maybe<Q>;
  /**
   * Per-call config overrides, applied on top of the prompt's config.
   */
  readonly overrides?: Maybe<OpenRouterModelConfig>;
  /**
   * Observability grouping id.
   */
  readonly sessionId?: Maybe<OpenRouterDecisionSessionId>;
  /**
   * Trace metadata.
   */
  readonly trace?: Maybe<OpenRouterRequestTrace>;
}

/**
 * Raised when a decision cannot be asked as declared.
 *
 * Every declaration problem fails HERE — before a request is built, naming the question — rather than as
 * a 4xx about a request body. The distinction matters because the fixes are different: a malformed
 * declaration is a code or authoring bug, while a 4xx is an operational one.
 */
export class OpenRouterDecisionDeclarationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`This decision cannot be asked as declared: ${errors.join(' ')}`);
    this.name = 'OpenRouterDecisionDeclarationError';
    this.errors = errors;
  }
}

/**
 * Builds a decision request from an optional resolved prompt plus the caller's state and questions.
 *
 * Stored questions and caller questions are merged BY ID with the caller winning, the same composition
 * a prompt's static seed messages and dynamic `input` already use. What differs is the reason: there is
 * no prompt cache on this route, so the merge is about where a question is authored — a fixed taxonomy
 * belongs in a version an operator can edit, a per-call candidate set can only come from code.
 *
 * @param params - The prompt, state, questions, overrides, session id, and trace.
 * @returns The built request.
 * @throws {OpenRouterDecisionDeclarationError} When the merged question map cannot be asked.
 */
export function openRouterDecisionRequest<Q extends OpenRouterDecisionQuestions = OpenRouterDecisionQuestions>(params: OpenRouterDecisionRequestParams<Q>): OpenRouterDecisionRequest<Q> {
  const { prompt, state, questions, overrides, sessionId, trace } = params;

  const config = mergeOpenRouterModelConfig([prompt?.config, overrides]);
  const merged = { ...(prompt?.questions ?? undefined), ...(questions ?? undefined) } as Q;
  const validation = validateOpenRouterDecisionQuestions(merged);

  if (!validation.valid) {
    throw new OpenRouterDecisionDeclarationError(validation.errors);
  }

  return { config, state, questions: merged, sessionId, trace };
}

/**
 * The parts of an {@link OpenRouterModelConfig} that reach a decisions request, and the parts that
 * cannot.
 */
export interface OpenRouterSplitDecisionModelConfig {
  /**
   * The parameters the decisions route accepts.
   */
  readonly requestConfig: Pick<OpenRouterModelConfig, 'model' | 'provider' | 'user'>;
  /**
   * Per-request wall-clock timeout, when the config set one.
   */
  readonly requestTimeoutMs?: Maybe<number>;
  /**
   * Names of the config keys the decisions route has no equivalent for, in the order declared.
   */
  readonly dropped: string[];
}

/**
 * Splits a model config into the parameters a decisions request accepts and the ones it does not.
 *
 * The decisions route takes only `model`, `provider` and `user`. Everything else on
 * {@link OpenRouterModelConfig} describes a completion — an output format, a reasoning budget, a tool
 * set, a temperature — and none of it has a meaning here: a decision has no free-form output to shape
 * and no tools to call. Those keys are reported in `dropped` rather than quietly discarded, because a
 * `temperature` a caller believes is in effect is exactly the kind of thing that is only noticed when
 * an answer is already wrong.
 *
 * `models` (the fallback chain) is dropped for a sharper reason: the decisions route takes a single
 * `model`, so a chain authored here does not degrade to its first entry — it simply does not exist.
 *
 * @param config - The merged model config.
 * @returns The split config.
 */
export function splitOpenRouterDecisionModelConfig(config: Maybe<OpenRouterModelConfig>): OpenRouterSplitDecisionModelConfig {
  // Named in a destructure rather than a list of strings, exactly as `splitOpenRouterModelConfig` does,
  // so TypeScript checks the names against the config interface and a rename cannot leave a stale entry.
  const { model, provider, user, requestTimeoutMs, ...rest } = config ?? {};
  const dropped = Object.keys(filterUndefinedValues(rest as Record<string, unknown>));

  return { requestConfig: filterUndefinedValues({ model, provider, user }), requestTimeoutMs, dropped };
}

/**
 * Validates a decision request before it is sent.
 *
 * The mirror of `validateOpenRouterModelConfig` for this arm, and the reason both exist: the model slug
 * is the ONLY thing that says which of OpenRouter's two inference surfaces a request belongs to, so it
 * is checked on both, and neither arm can be entered with a model the other one owns.
 *
 * @param request - The request to check.
 * @returns The validation result.
 */
export function validateOpenRouterDecisionRequest(request: Maybe<OpenRouterDecisionRequest>): OpenRouterModelConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (request == null) {
    errors.push('No decision request was provided.');
  } else {
    const { requestConfig, dropped } = splitOpenRouterDecisionModelConfig(request.config);
    const model = requestConfig.model;

    if (!model) {
      errors.push('No `model` was specified.');
    } else if (!isOpenRouterSystemOneModelId(model)) {
      errors.push(`\`${model}\` is not a System One model, and only a System One model answers a decision. Name a \`typesafe/…\` model (see DEFAULT_OPENROUTER_SYSTEM_ONE_MODEL_ID), or call \`callModelForOpenRouterRequest\` instead.`);
    }

    const questionValidation = validateOpenRouterDecisionQuestions(request.questions);
    questionValidation.errors.forEach((x) => errors.push(x));
    questionValidation.warnings.forEach((x) => warnings.push(x));

    if (dropped.length > 0) {
      const names = dropped.map((x) => '`' + x + '`').join(', ');
      warnings.push(`The decisions route accepts only \`model\`, \`provider\` and \`user\`; ${names} ${dropped.length === 1 ? 'was' : 'were'} dropped from the request.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * One declared question in the shape the wire carries it.
 *
 * All three primitives collapse onto a single `criteria` key, which is why this mapping exists at all:
 * the declaration types name what each primitive's criteria MEAN (`options`, `levels`, `means`), and the
 * wire does not.
 */
export type OpenRouterDecisionWireQuestion =
  | { readonly type: 'choice'; readonly instructions: OpenRouterDecisionEntry; readonly criteria: Readonly<Record<string, Maybe<OpenRouterDecisionEntry>>> }
  | { readonly type: 'score'; readonly instructions: OpenRouterDecisionEntry; readonly criteria: readonly OpenRouterDecisionEntry[] }
  | { readonly type: 'noul'; readonly instructions: OpenRouterDecisionEntry; readonly criteria?: { readonly true: OpenRouterDecisionEntry; readonly false: OpenRouterDecisionEntry } };

/**
 * Converts one declared question to its wire shape.
 *
 * A pure rename. Three details carry meaning and are not incidental:
 *
 * - an option with no description becomes an explicit `null`, which is how the wire spells "undescribed
 *   option" — omitting the key would instead remove the option from the answer space;
 * - a Noul with no `means` omits `criteria` ENTIRELY rather than sending an empty object;
 * - a structured entry is passed through by IDENTITY, never copied or re-serialized, because the wire
 *   carries declaration guidance verbatim and a normalising round-trip is exactly the kind of silent
 *   edit this mapping must not make.
 *
 * @param question - The declared question.
 * @returns The wire question.
 */
export function openRouterDecisionWireQuestion(question: OpenRouterDecisionQuestion): OpenRouterDecisionWireQuestion {
  let result: OpenRouterDecisionWireQuestion;

  switch (question.type) {
    case 'choice':
      result = {
        type: 'choice',
        instructions: question.instructions,
        criteria: openRouterDecisionChoiceOptionNames(question).reduce<Record<string, Maybe<OpenRouterDecisionEntry>>>((all, option) => {
          all[option] = question.options[option] ?? null;
          return all;
        }, {})
      };
      break;
    case 'score':
      result = { type: 'score', instructions: question.instructions, criteria: [...question.levels] };
      break;
    case 'noul':
      result = { type: 'noul', instructions: question.instructions, ...(question.means == null ? undefined : { criteria: { true: question.means.true, false: question.means.false } }) };
      break;
  }

  return result;
}

/**
 * Converts a built request into the `/systemone` request body.
 *
 * @param request - The built request.
 * @returns The request body, in the SDK's request surface.
 */
export function openRouterDecisionRequestBody(request: OpenRouterDecisionRequest): DecisionsRequest {
  const { requestConfig } = splitOpenRouterDecisionModelConfig(request.config);

  return filterUndefinedValues({
    ...requestConfig,
    model: requestConfig.model ?? '',
    state: request.state,
    questions: mapObjectMap(request.questions, (question) => openRouterDecisionWireQuestion(question)),
    sessionId: request.sessionId ?? undefined,
    trace: request.trace == null ? undefined : { additionalProperties: { ...request.trace } }
  }) as unknown as DecisionsRequest;
}

/**
 * What is wrong with one answer in a reply.
 */
export type OpenRouterDecisionFaultKind = 'answer-missing' | 'answer-mistyped' | 'choice-off-option' | 'value-out-of-range';

/**
 * One thing wrong with a reply.
 */
export interface OpenRouterDecisionFault {
  readonly kind: OpenRouterDecisionFaultKind;
  readonly question: OpenRouterDecisionQuestionId;
  readonly detail: string;
}

/**
 * Raised when a reply did not answer the questions that were declared.
 *
 * This is always a defect in the RESPONSE and never a judgement the model made. "None of these fits" is
 * not a fault — it is said through a Noul the caller declared for it, and arrives as an ANSWER. A caller
 * that catches this is handling a malformed reply, not a negative one.
 */
export class OpenRouterDecisionAnswerFaultError extends Error {
  readonly faults: OpenRouterDecisionFault[];

  constructor(faults: OpenRouterDecisionFault[]) {
    const described = faults.map((x) => x.question + ' (' + x.kind + '): ' + x.detail).join('; ');
    super(`The decision reply did not answer its declared questions: ${described}`);
    this.name = 'OpenRouterDecisionAnswerFaultError';
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
function openRouterDecisionAnswerFaults(question: OpenRouterDecisionQuestion, id: OpenRouterDecisionQuestionId, answer: Maybe<OpenRouterDecisionAnswer>): OpenRouterDecisionFault[] {
  const faults: OpenRouterDecisionFault[] = [];

  if (answer == null) {
    faults.push({ kind: 'answer-missing', question: id, detail: 'no answer was returned' });
  } else if (answer.type !== question.type) {
    faults.push({ kind: 'answer-mistyped', question: id, detail: `a ${question.type} question was answered with a ${answer.type}` });
  } else if (answer.type === 'choice' && question.type === 'choice') {
    const declared = new Set<string>(openRouterDecisionChoiceOptionNames(question));

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

      if (Math.abs(sum - 1) > OPENROUTER_DECISION_DISTRIBUTION_SUM_TOLERANCE) {
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
 * Config for {@link readOpenRouterDecisionAnswers}.
 */
export interface ReadOpenRouterDecisionAnswersConfig<Q extends OpenRouterDecisionQuestions> {
  /**
   * The questions that were declared.
   */
  readonly questions: Q;
  /**
   * The answers as returned.
   */
  readonly raw: Readonly<Record<string, Maybe<OpenRouterDecisionAnswer>>>;
}

/**
 * Either the answers, or everything wrong with them.
 */
export type OpenRouterDecisionAnswersRead<Q extends OpenRouterDecisionQuestions> = { readonly answers: OpenRouterDecisionAnswers<Q>; readonly faults?: undefined } | { readonly answers?: undefined; readonly faults: OpenRouterDecisionFault[] };

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
export function readOpenRouterDecisionAnswers<Q extends OpenRouterDecisionQuestions>(config: ReadOpenRouterDecisionAnswersConfig<Q>): OpenRouterDecisionAnswersRead<Q> {
  const { questions, raw } = config;
  const faults = Object.keys(questions).flatMap((id) => openRouterDecisionAnswerFaults(questions[id], id, raw[id]));
  return faults.length > 0 ? { faults } : { answers: raw as unknown as OpenRouterDecisionAnswers<Q> };
}

/**
 * Flattens a decisions reply's usage into the package's usage shape.
 *
 * Reported through the SAME {@link OpenRouterRunUsage} a completion reports, so the cost ledger needs no
 * second counting site and a run's spend is readable without knowing which arm served it.
 *
 * Two things about this route's numbers, both measured rather than assumed:
 *
 * - `outputTokens` is REPORTED and non-zero, but it is not billed. `cost` is input alone at the model's
 *   input rate — verified live at 350 input tokens and $0.042/Mtok giving exactly $0.0000147, with 34
 *   output tokens on the same reply. So a cost-per-token derived from `totalTokens` here is wrong.
 * - `cost` is FINAL when it arrives. A completion's is settled server-side afterwards and refined by the
 *   broadcast webhook; a decision's is synchronous, which is why a decision run needs no reconciliation.
 *
 * A measurement the reply did not report is OMITTED rather than carried as `undefined`, because a spread
 * `cost: undefined` reads downstream as "cost zero" rather than "cost unknown".
 *
 * @param usage - The usage as returned.
 * @returns The flattened usage.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterRunUsageFromDecisionsUsage(usage: Maybe<DecisionsResponse['usage']>): Maybe<OpenRouterRunUsage> {
  let result: Maybe<OpenRouterRunUsage>;

  if (usage != null) {
    const { inputTokens, outputTokens, cost } = usage;
    const totalTokens = inputTokens == null && outputTokens == null ? undefined : (inputTokens ?? 0) + (outputTokens ?? 0);
    result = filterUndefinedValues({ inputTokens, outputTokens, totalTokens, cost }, true);
  }

  return result;
}
