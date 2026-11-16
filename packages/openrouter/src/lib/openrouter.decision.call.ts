/**
 * The TRANSPORT half of the decision layer: {@link openRouterDecision}, the one caller of the SDK's
 * `systemOneCreate`.
 *
 * Kept apart from `openrouter.decision.ts` (declaring, validating, the wire mapping, reading a reply) so
 * that everything a decision is built from can be loaded without evaluating `@openrouter/sdk` — see the
 * `@dereekb/openrouter/decision` entry. A caller that owns its own transport (its own timeout, retry
 * policy or error shape) builds the body with `openRouterDecisionRequestBody` and reads the reply with
 * `readLlmDecisionAnswers`, and never needs this file.
 */

import { type LlmDecisionAnswer, LlmDecisionAnswerFaultError, type LlmDecisionAnswers, LlmDecisionDeclarationError, type LlmDecisionQuestions, readLlmDecisionAnswers } from '@dereekb/llm';
import { type Maybe } from '@dereekb/util';
import { type OpenRouterDecisionRequest, openRouterDecisionRequestBody, openRouterRunUsageFromDecisionsUsage, splitOpenRouterDecisionModelConfig, validateOpenRouterDecisionRequest } from './openrouter.decision';
import { type DecisionsResponse, type OpenRouterCore, type RequestOptions, systemOneCreate } from './openrouter.sdk';
import { type OpenRouterGenerationId, type OpenRouterModelId, type OpenRouterRunUsage } from './openrouter.type';

/**
 * A normalized result of one decision.
 *
 * Field names deliberately match `OpenRouterCallResult` wherever the two have the same meaning, so a
 * caller reading `model` / `generationIds` / `usage` does not have to learn a second vocabulary for the
 * second arm. There is no `outputText` or `error`: a decision has no prose output, and the route reports
 * a failure as a thrown transport error rather than as a field on a 200.
 */
export interface OpenRouterDecisionResult<Q extends LlmDecisionQuestions = LlmDecisionQuestions> {
  /**
   * The answers, membership-checked against the declared questions.
   */
  readonly answers: LlmDecisionAnswers<Q>;
  /**
   * The model that actually served the decision — a VERSIONED slug even when an alias was asked for,
   * which is what makes an answer reproducible.
   */
  readonly model?: Maybe<OpenRouterModelId>;
  /**
   * The provider that served it.
   */
  readonly provider?: Maybe<string>;
  /**
   * Generation ids produced, for auditing. At most one on this route.
   */
  readonly generationIds: OpenRouterGenerationId[];
  /**
   * Token/cost usage.
   */
  readonly usage?: Maybe<OpenRouterRunUsage>;
  /**
   * The raw response, for anything the normalized shape drops.
   */
  readonly response: DecisionsResponse;
}

/**
 * Params for {@link openRouterDecision}.
 */
export interface OpenRouterDecisionParams<Q extends LlmDecisionQuestions = LlmDecisionQuestions> {
  /**
   * The OpenRouter client.
   */
  readonly client: OpenRouterCore;
  /**
   * The built request.
   */
  readonly request: OpenRouterDecisionRequest<Q>;
  /**
   * Additional request options, merged under the config's `requestTimeoutMs`.
   */
  readonly options?: Maybe<RequestOptions>;
}

/**
 * Asks a decision and returns its answers.
 *
 * The request is validated first, so a model that cannot serve a decision is refused HERE rather than by
 * the route — the mirror of the refusal `callModelForOpenRouterRequest` makes for a System One model on
 * the completion arm. Which surface a request belongs to is a property of the request, not a choice the
 * caller makes at the call site.
 *
 * @param params - The client, request, and options.
 * @returns The normalized decision result.
 * @throws {LlmDecisionDeclarationError} When the request cannot be asked as declared.
 * @throws {LlmDecisionAnswerFaultError} When the reply did not answer the declared questions.
 */
export async function openRouterDecision<Q extends LlmDecisionQuestions = LlmDecisionQuestions>(params: OpenRouterDecisionParams<Q>): Promise<OpenRouterDecisionResult<Q>> {
  const { client, request, options } = params;
  const validation = validateOpenRouterDecisionRequest(request);

  if (!validation.valid) {
    throw new LlmDecisionDeclarationError(validation.errors);
  }

  const { requestTimeoutMs } = splitOpenRouterDecisionModelConfig(request.config);
  const decisionsRequest = openRouterDecisionRequestBody(request);
  const result = await systemOneCreate(client, { decisionsRequest }, { ...options, ...(requestTimeoutMs == null ? undefined : { timeoutMs: requestTimeoutMs }) });

  if (!result.ok) {
    throw result.error;
  }

  const response = result.value;
  const read = readLlmDecisionAnswers({ questions: request.questions, raw: (response.answers ?? {}) as Readonly<Record<string, Maybe<LlmDecisionAnswer>>> });

  if (read.faults != null) {
    throw new LlmDecisionAnswerFaultError(read.faults);
  }

  return { answers: read.answers, model: response.model, provider: response.provider, generationIds: response.id ? [response.id] : [], usage: openRouterRunUsageFromDecisionsUsage(response.usage), response };
}
