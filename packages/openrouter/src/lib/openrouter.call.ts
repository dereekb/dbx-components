import { type Maybe } from '@dereekb/util';
import { type CallModelInput, type ModelResult, type OpenResponsesResult, type OpenRouterCore, type RequestOptions, type StateAccessor, type Tool, callModel, stepCountIs } from './openrouter.sdk';
import { type OpenRouterModelConfig } from './openrouter.config';
import { type OpenRouterPromptRequest } from './openrouter.request';
import { type OpenRouterGenerationId, type OpenRouterRunError, type OpenRouterRunUsage } from './openrouter.type';

/**
 * Config keys that live on {@link OpenRouterModelConfig} for our convenience but are NOT OpenRouter
 * request parameters, and so must not be forwarded to the API.
 */
export const OPENROUTER_NON_REQUEST_CONFIG_KEYS: readonly string[] = ['maxSteps', 'requestTimeoutMs'];

/**
 * A model config split into the part that goes on the request and the part that controls how the
 * request is executed.
 */
export interface OpenRouterSplitModelConfig {
  /**
   * The parameters to spread onto the request.
   */
  readonly requestConfig: Record<string, unknown>;
  /**
   * Ceiling on tool-call steps, when the config set one.
   */
  readonly maxSteps?: Maybe<number>;
  /**
   * Per-request wall-clock timeout, when the config set one.
   */
  readonly requestTimeoutMs?: Maybe<number>;
}

/**
 * Splits a model config into request parameters and execution controls.
 *
 * Forwarding an unknown key is not harmless: OpenRouter validates the request body, so leaving
 * `maxSteps` on it risks a 400 on the whole call.
 *
 * @param config - The merged model config.
 * @returns The split config.
 */
export function splitOpenRouterModelConfig(config: Maybe<OpenRouterModelConfig>): OpenRouterSplitModelConfig {
  const requestConfig: Record<string, unknown> = {};
  let maxSteps: Maybe<number>;
  let requestTimeoutMs: Maybe<number>;

  if (config != null) {
    Object.entries(config).forEach(([key, value]) => {
      if (value !== undefined && !OPENROUTER_NON_REQUEST_CONFIG_KEYS.includes(key)) {
        requestConfig[key] = value;
      }
    });

    maxSteps = config.maxSteps;
    requestTimeoutMs = config.requestTimeoutMs;
  }

  return { requestConfig, maxSteps, requestTimeoutMs };
}

/**
 * A normalized result of one OpenRouter call.
 *
 * Deliberately flat and provider-agnostic: this is what a run task stores and what a caller reads,
 * so it must not require the caller to walk the SDK's response union.
 */
export interface OpenRouterCallResult {
  /**
   * The output text.
   */
  readonly outputText?: Maybe<string>;
  /**
   * The output parsed as JSON, when it parsed as an object.
   */
  readonly outputJson?: Maybe<Record<string, unknown>>;
  /**
   * Generation ids produced by the call, for auditing via `getGeneration` / `listGenerationContent`.
   *
   * OpenRouter can reload a generation's output later, keyed by generation id — but that surface is
   * tied to account logging settings (nothing is retained under ZDR / logging-disabled) and its
   * retention is undocumented. Treat it as audit/debug, never the system of record.
   */
  readonly generationIds: OpenRouterGenerationId[];
  /**
   * Token/cost usage.
   */
  readonly usage?: Maybe<OpenRouterRunUsage>;
  /**
   * The model that actually served the request.
   */
  readonly model?: Maybe<string>;
  /**
   * The error reported by OpenRouter, when the response carried one.
   */
  readonly error?: Maybe<OpenRouterRunError>;
  /**
   * The raw response, for anything the normalized shape drops.
   */
  readonly response: OpenResponsesResult;
}

/**
 * Params for {@link openRouterCallModelInput}.
 */
export interface OpenRouterCallModelInputParams<TTools extends readonly Tool[] = readonly Tool[]> {
  /**
   * The built request.
   */
  readonly request: OpenRouterPromptRequest;
  /**
   * Client-side tools to make available.
   */
  readonly tools?: Maybe<TTools>;
  /**
   * Conversation state backend, for a multi-step or deferred-tool run.
   */
  readonly state?: Maybe<StateAccessor<TTools>>;
}

/**
 * Converts a built request into the `callModel` input.
 *
 * @param params - The request, tools, and state accessor.
 * @returns The `callModel` input.
 */
export function openRouterCallModelInput<TTools extends readonly Tool[] = readonly Tool[]>(params: OpenRouterCallModelInputParams<TTools>): CallModelInput<TTools> {
  const { request, tools, state } = params;
  const { requestConfig, maxSteps } = splitOpenRouterModelConfig(request.config);

  const input: Record<string, unknown> = {
    ...requestConfig,
    input: request.input,
    stream: undefined
  };

  if (request.instructions) {
    input.instructions = request.instructions;
  }

  if (request.trace != null) {
    input.trace = { additionalProperties: { ...request.trace } };
  }

  if (tools != null) {
    input.tools = tools;
  }

  if (state != null) {
    input.state = state;
  }

  if (maxSteps != null) {
    input.stopWhen = stepCountIs(maxSteps);
  }

  return input as CallModelInput<TTools>;
}

/**
 * Params for {@link callModelForOpenRouterRequest}.
 */
export interface CallModelForOpenRouterRequestParams<TTools extends readonly Tool[] = readonly Tool[]> extends OpenRouterCallModelInputParams<TTools> {
  /**
   * The OpenRouter client.
   */
  readonly client: OpenRouterCore;
  /**
   * Additional request options, merged under the config's `requestTimeoutMs`.
   */
  readonly options?: Maybe<RequestOptions>;
}

/**
 * Starts a call for a built request and returns the SDK's `ModelResult` without consuming it.
 *
 * Use this when the caller needs the streaming / tool-event surface. Most callers want
 * {@link callModelForOpenRouterRequest}, which consumes the result into a normalized value.
 *
 * @param params - The client, request, tools, state, and options.
 * @returns The in-flight model result.
 */
export function openRouterModelResultForRequest<TTools extends readonly Tool[] = readonly Tool[]>(params: CallModelForOpenRouterRequestParams<TTools>): ModelResult<TTools> {
  const { client, request, options } = params;
  const { requestTimeoutMs } = splitOpenRouterModelConfig(request.config);
  const requestOptions: RequestOptions = { ...options, ...(requestTimeoutMs == null ? undefined : { timeoutMs: requestTimeoutMs }) };

  return callModel(client, openRouterCallModelInput(params), requestOptions);
}

/**
 * Runs a built request to completion and normalizes the response.
 *
 * @param params - The client, request, tools, state, and options.
 * @returns The normalized call result.
 */
export async function callModelForOpenRouterRequest<TTools extends readonly Tool[] = readonly Tool[]>(params: CallModelForOpenRouterRequestParams<TTools>): Promise<OpenRouterCallResult> {
  const result = openRouterModelResultForRequest(params);
  const response = await result.getResponse();
  return openRouterCallResultFromResponse(response);
}

/**
 * Normalizes an OpenRouter response into an {@link OpenRouterCallResult}.
 *
 * @param response - The response to normalize.
 * @returns The normalized result.
 */
export function openRouterCallResultFromResponse(response: OpenResponsesResult): OpenRouterCallResult {
  const outputText = response.outputText;
  const usage = response.usage;

  return {
    outputText,
    outputJson: parseOpenRouterJsonOutput(outputText),
    generationIds: response.id ? [response.id] : [],
    usage:
      usage == null
        ? undefined
        : {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
            reasoningTokens: usage.outputTokensDetails?.reasoningTokens,
            cachedTokens: usage.inputTokensDetails?.cachedTokens,
            cost: usage.cost,
            isByok: usage.isByok
          },
    model: response.model,
    error: response.error == null ? undefined : { code: response.error.code == null ? undefined : String(response.error.code), message: response.error.message },
    response
  };
}

/**
 * Parses model output as a JSON object.
 *
 * Returns undefined rather than throwing on anything that is not a JSON object: a model asked for
 * text can and will return prose, and that is not an error.
 *
 * @param outputText - The output text.
 * @returns The parsed object, or undefined when the output is not a JSON object.
 */
export function parseOpenRouterJsonOutput(outputText: Maybe<string>): Maybe<Record<string, unknown>> {
  let result: Maybe<Record<string, unknown>>;

  if (outputText) {
    try {
      const parsed = JSON.parse(outputText);

      if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        result = parsed as Record<string, unknown>;
      }
    } catch {
      // not JSON — leave undefined
    }
  }

  return result;
}
