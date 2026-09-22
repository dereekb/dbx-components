import { type Maybe } from '@dereekb/util';
import {
  type OpenRouterAttachedFileReference,
  type OpenRouterCallResult,
  type OpenRouterCore,
  type OpenRouterDecisionQuestions,
  type OpenRouterDecisionResult,
  type OpenRouterDecisionState,
  type OpenRouterInput,
  type OpenRouterModelConfig,
  type OpenRouterPromptKey,
  type OpenRouterPromptVersionNumber,
  type Tool,
  callModelForOpenRouterRequest,
  openRouterDecision,
  openRouterDecisionRequest,
  openRouterPromptRequest
} from '@dereekb/openrouter';
import { type OpenRouterPromptService } from './openrouter.prompt.service';

/**
 * Params for {@link callModelForPrompt}.
 */
export interface CallModelForPromptParams {
  /**
   * The OpenRouter client.
   */
  readonly client: OpenRouterCore;
  /**
   * The prompt service used to resolve the version.
   */
  readonly promptService: OpenRouterPromptService;
  /**
   * The prompt to run.
   */
  readonly promptKey: OpenRouterPromptKey;
  /**
   * Version to pin. Omit to use the prompt's active version.
   */
  readonly version?: Maybe<OpenRouterPromptVersionNumber>;
  /**
   * The call input.
   */
  readonly input?: Maybe<OpenRouterInput>;
  /**
   * Per-call config overrides.
   */
  readonly configOverrides?: Maybe<OpenRouterModelConfig>;
  /**
   * Files, already attached for this call — see `openRouterFileAttachmentResolver`.
   *
   * Attached rather than by path, unlike the queued path: an inline call runs once, right now, so there
   * is no later attempt for which a url could have expired.
   */
  readonly files?: Maybe<OpenRouterAttachedFileReference[]>;
  /**
   * Client-side tools.
   */
  readonly tools?: Maybe<readonly Tool[]>;
  /**
   * Trace metadata for cost/usage reconciliation.
   */
  readonly trace?: Maybe<Record<string, unknown>>;
}

/**
 * Runs a prompt INLINE and returns the result, with no run task document.
 *
 * Use this wherever a call reliably finishes in a few seconds. The queue exists for calls that do not,
 * and paying for a document, a lease, and a sweep interval on a two-second call buys nothing.
 *
 * @param params - The client, prompt service, prompt, and input.
 * @returns The normalized call result.
 */
export async function callModelForPrompt(params: CallModelForPromptParams): Promise<OpenRouterCallResult> {
  const { client, promptService, promptKey, version, input, configOverrides, files, tools, trace } = params;

  const prompt = await promptService.resolvePrompt({ promptKey, version });
  const request = openRouterPromptRequest({ prompt, input, overrides: configOverrides, files, trace });

  return callModelForOpenRouterRequest({ client, request, tools: tools ?? undefined });
}

/**
 * Params for {@link decideForPrompt}.
 */
export interface DecideForPromptParams {
  /**
   * The OpenRouter client.
   */
  readonly client: OpenRouterCore;
  /**
   * The prompt service used to resolve the version.
   */
  readonly promptService: OpenRouterPromptService;
  /**
   * The decision prompt to ask.
   */
  readonly promptKey: OpenRouterPromptKey;
  /**
   * Version to pin. Omit to use the prompt's active version.
   */
  readonly version?: Maybe<OpenRouterPromptVersionNumber>;
  /**
   * The content to judge.
   */
  readonly state: OpenRouterDecisionState;
  /**
   * Questions declared for THIS call, merged over the version's stored questions by id.
   */
  readonly questions?: Maybe<OpenRouterDecisionQuestions>;
  /**
   * Per-call config overrides.
   */
  readonly configOverrides?: Maybe<OpenRouterModelConfig>;
  /**
   * Observability grouping id.
   */
  readonly sessionId?: Maybe<string>;
  /**
   * Trace metadata for cost/usage reconciliation.
   */
  readonly trace?: Maybe<Record<string, unknown>>;
}

/**
 * Asks a decision prompt INLINE and returns its answers, with no run task document.
 *
 * The default way to ask a decision. A System One call typically answers in around a hundred
 * milliseconds, has no tools to loop and nothing to defer, so the queue's lease, sweep interval and
 * retry ladder buy nothing on the happy path — paying for a document to run a call that finishes before
 * the write does is pure overhead.
 *
 * Reach for `enqueueRunTask({ state, questions, immediate: true })` instead when a FAILURE needs to
 * survive this process: that keeps the same run-it-now latency and leaves a retryable failure queued for
 * the sweep, at the cost of one document per run.
 *
 * @param params - The client, prompt service, prompt, state, and questions.
 * @returns The decision result.
 */
export async function decideForPrompt(params: DecideForPromptParams): Promise<OpenRouterDecisionResult> {
  const { client, promptService, promptKey, version, state, questions, configOverrides, sessionId, trace } = params;

  const prompt = await promptService.resolvePrompt({ promptKey, version });
  const request = openRouterDecisionRequest({ prompt, state, questions, overrides: configOverrides, sessionId, trace });

  return openRouterDecision({ client, request });
}
