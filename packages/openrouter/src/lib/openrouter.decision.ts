import { type Maybe, filterUndefinedValues } from '@dereekb/util';
import { type OpenRouterModelConfig, type OpenRouterModelConfigValidation, mergeOpenRouterModelConfig } from './openrouter.config';
import { type LlmDecisionQuestions, type LlmDecisionState, LlmDecisionDeclarationError, isLlmDecisionModelId, llmDecisionRequestBody, validateLlmDecisionQuestions } from '@dereekb/llm/decision';
import { type OpenRouterResolvedPrompt } from './openrouter.prompt';
import { type OpenRouterRequestTrace } from './openrouter.request';
// TYPE-ONLY, and it must stay so: this file is the pure half of the decision layer and ships through the
// SDK-free `@dereekb/openrouter/decision` entry. `openrouter.sdk.ts` re-exports `@openrouter/sdk` VALUES,
// so a value import from it here would put the SDK on that entry's load path. The transport half — the one
// `systemOneCreate` user — is `openrouter.decision.call.ts`.
import type { DecisionsRequest, DecisionsResponse } from './openrouter.sdk';
import { type OpenRouterRunUsage } from './openrouter.type';

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
export interface OpenRouterDecisionRequest<Q extends LlmDecisionQuestions = LlmDecisionQuestions> {
  /**
   * The merged model config. Only `model`, `provider` and `user` reach the wire — see
   * {@link splitOpenRouterDecisionModelConfig}.
   */
  readonly config: OpenRouterModelConfig;
  /**
   * The content to judge.
   */
  readonly state: LlmDecisionState;
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
export interface OpenRouterDecisionRequestParams<Q extends LlmDecisionQuestions = LlmDecisionQuestions> {
  /**
   * The resolved prompt version supplying the base config and any STORED questions.
   */
  readonly prompt?: Maybe<OpenRouterResolvedPrompt>;
  /**
   * The content to judge.
   */
  readonly state: LlmDecisionState;
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
 * Builds a decision request from an optional resolved prompt plus the caller's state and questions.
 *
 * Stored questions and caller questions are merged BY ID with the caller winning, the same composition
 * a prompt's static seed messages and dynamic `input` already use. What differs is the reason: there is
 * no prompt cache on this route, so the merge is about where a question is authored — a fixed taxonomy
 * belongs in a version an operator can edit, a per-call candidate set can only come from code.
 *
 * @param params - The prompt, state, questions, overrides, session id, and trace.
 * @returns The built request.
 * @throws {LlmDecisionDeclarationError} When the merged question map cannot be asked.
 */
export function openRouterDecisionRequest<Q extends LlmDecisionQuestions = LlmDecisionQuestions>(params: OpenRouterDecisionRequestParams<Q>): OpenRouterDecisionRequest<Q> {
  const { prompt, state, questions, overrides, sessionId, trace } = params;

  const config = mergeOpenRouterModelConfig([prompt?.config, overrides]);
  const merged = { ...(prompt?.questions ?? undefined), ...(questions ?? undefined) } as Q;
  const validation = validateLlmDecisionQuestions(merged);

  if (!validation.valid) {
    throw new LlmDecisionDeclarationError(validation.errors);
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
    } else if (!isLlmDecisionModelId(model)) {
      errors.push(`\`${model}\` is not a System One model, and only a System One model answers a decision. Name a \`typesafe/…\` model (see DEFAULT_OPENROUTER_SYSTEM_ONE_MODEL_ID), or call \`callModelForOpenRouterRequest\` instead.`);
    }

    const questionValidation = validateLlmDecisionQuestions(request.questions);
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
 * Converts a built request into the `/systemone` request body.
 *
 * The body is `@dereekb/llm/decision`'s {@link llmDecisionRequestBody} — `model`, `state` and the wire-mapped
 * `questions`, built once for every System One client — plus the keys only OpenRouter's route takes: `provider` and
 * `user` from the config, the `sessionId` (sent as `session_id`) and the `trace` (its keys flattened onto the wire by
 * the SDK). An `undefined` key is dropped; a `null` one is kept.
 *
 * The config's keys are spread FIRST and llm's body over them, so the object's key order stays what it has always been
 * (`model`, `provider`, `user`, `state`, `questions`, `sessionId`, `trace`). The SDK re-serializes the body in its own
 * schema order, so the wire bytes never depended on it — but this object is public through
 * `@dereekb/openrouter/decision`, and its order is pinned (`openrouter.decision.pin.spec.ts`).
 *
 * @param request - The built request.
 * @returns The request body, in the SDK's request surface.
 */
export function openRouterDecisionRequestBody(request: OpenRouterDecisionRequest): DecisionsRequest {
  const { requestConfig } = splitOpenRouterDecisionModelConfig(request.config);

  return filterUndefinedValues({
    ...requestConfig,
    ...llmDecisionRequestBody({ model: requestConfig.model ?? '', state: request.state, questions: request.questions }),
    sessionId: request.sessionId ?? undefined,
    trace: request.trace == null ? undefined : { additionalProperties: { ...request.trace } }
  }) as unknown as DecisionsRequest;
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
