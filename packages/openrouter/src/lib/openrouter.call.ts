import { type Maybe, filterUndefinedValues } from '@dereekb/util';
import { type CallModelInput, type OpenResponsesResult, type OpenRouterCore, type RequestOptions, type ResponsesRequest, type StateAccessor, type Tool, ModelResult, callModel, convertToolsToAPIFormat, responsesSend, stepCountIs } from './openrouter.sdk';
import { type OpenRouterHostedToolConfig, type OpenRouterModelConfig } from './openrouter.config';
import { type OpenRouterPromptRequest } from './openrouter.request';
import { type OpenRouterGenerationId, type OpenRouterRunError, type OpenRouterRunUsage } from './openrouter.type';

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
 * Forwarding one of ours is not harmless: OpenRouter validates the request body, so leaving `maxSteps` on
 * it risks a 400 on the whole call. Which keys are ours is expressed by naming them in a rest-destructure
 * rather than in a list of strings, so TypeScript checks the names against
 * {@link OpenRouterModelConfig} and a rename cannot leave a stale entry behind.
 *
 * @param config - The merged model config.
 * @returns The split config.
 */
export function splitOpenRouterModelConfig(config: Maybe<OpenRouterModelConfig>): OpenRouterSplitModelConfig {
  const { maxSteps, requestTimeoutMs, ...rest } = config ?? {};
  return { requestConfig: filterUndefinedValues(rest), maxSteps, requestTimeoutMs };
}

/**
 * The hosted (server-executed) tool entries a config carries, e.g. `file_search`, `web_search`, `mcp`.
 *
 * These are NOT client tools and must never be handed to `callModel`: it destructures `tools` off the
 * request and runs every entry through `convertToolsToAPIFormat`, which reads `tool.function.name` — so
 * a hosted entry is dropped outright when no client tools are present and throws a
 * `Cannot read properties of undefined` from inside the SDK when they are. They are dispatched instead
 * by {@link sendOpenRouterResponsesRequest} or merged in after conversion by
 * {@link openRouterModelResultForRequest}.
 *
 * @param config - The merged model config.
 * @returns The hosted tool entries, or an empty array.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterHostedTools(config: Maybe<OpenRouterModelConfig>): OpenRouterHostedToolConfig[] {
  const tools = config?.tools;
  return Array.isArray(tools) ? tools : [];
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
 * Converts a built request into the `/responses` request body.
 *
 * This is the whole wire body minus the SDK-only keys (`tools`/`state`/`stopWhen` on the `callModel`
 * path), so both dispatch paths assemble the request the same way and cannot drift.
 *
 * @param request - The built request.
 * @returns The request body, in the SDK's camelCase request surface.
 */
export function openRouterResponsesRequestBody(request: OpenRouterPromptRequest): Record<string, unknown> {
  const { requestConfig } = splitOpenRouterModelConfig(request.config);

  return filterUndefinedValues<Record<string, unknown>>({
    ...requestConfig,
    input: request.input,
    instructions: request.instructions || undefined,
    trace: request.trace == null ? undefined : { additionalProperties: { ...request.trace } }
  });
}

/**
 * Converts a built request into the `callModel` input.
 *
 * Any hosted tools on the config are STRIPPED here rather than passed through: `callModel` owns the
 * `tools` key and converts every entry as a client function tool. Hosted entries are re-attached after
 * that conversion by {@link openRouterModelResultForRequest}.
 *
 * @param params - The request, tools, and state accessor.
 * @returns The `callModel` input.
 */
export function openRouterCallModelInput<TTools extends readonly Tool[] = readonly Tool[]>(params: OpenRouterCallModelInputParams<TTools>): CallModelInput<TTools> {
  const { request, tools, state } = params;
  const { maxSteps } = splitOpenRouterModelConfig(request.config);

  // dropped by name rather than by mutation, so TypeScript sees which keys leave the body: the hosted
  // tools `callModel` cannot carry, and a config-set `stream` the non-streaming path must not inherit.
  const { tools: _hostedTools, stream: _stream, ...body } = openRouterResponsesRequestBody(request);

  const input: Record<string, unknown> = filterUndefinedValues<Record<string, unknown>>({
    ...body,
    tools: tools ?? undefined,
    state: state ?? undefined,
    stopWhen: maxSteps == null ? undefined : stepCountIs(maxSteps)
  });

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
 * Header `callModel` stamps on every request it dispatches, so OpenRouter can tell an agent-loop request
 * apart from a plain one. Replicated on the merged hosted-tool path, which is a `callModel` request in
 * everything but the entry point.
 */
export const OPENROUTER_CALL_MODEL_HEADER = 'x-openrouter-callmodel';

/**
 * Builds the request options for a call, folding in the config's `requestTimeoutMs`.
 *
 * @param options - Caller-supplied options.
 * @param requestTimeoutMs - The per-request timeout from the config, when it set one.
 * @returns The merged options.
 */
function openRouterRequestOptions(options: Maybe<RequestOptions>, requestTimeoutMs: Maybe<number>): RequestOptions {
  return { ...options, ...(requestTimeoutMs == null ? undefined : { timeoutMs: requestTimeoutMs }) };
}

/**
 * Copies request options and stamps the `x-openrouter-callmodel` header onto them.
 *
 * Both header sources are read for the same reason `callModel` reads both: the SDK resolves
 * `options.headers ?? options.fetchOptions.headers`, so setting `headers` alone would SHADOW a caller
 * who passed theirs through the (deprecated) `fetchOptions` instead of losing nothing.
 *
 * @param options - The request options.
 * @returns Options carrying the caller's headers plus the callModel marker.
 */
function openRouterCallModelRequestOptions(options: RequestOptions): RequestOptions {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const headers = new Headers(options.headers ?? options.fetchOptions?.headers ?? undefined);
  headers.set(OPENROUTER_CALL_MODEL_HEADER, 'true');

  return { ...options, headers };
}

/**
 * Params for {@link sendOpenRouterResponsesRequest}.
 */
export interface SendOpenRouterResponsesRequestParams {
  /**
   * The OpenRouter client.
   */
  readonly client: OpenRouterCore;
  /**
   * The built request.
   */
  readonly request: OpenRouterPromptRequest;
  /**
   * Additional request options, merged under the config's `requestTimeoutMs`.
   */
  readonly options?: Maybe<RequestOptions>;
}

/**
 * Sends a built request straight to `/responses`, bypassing `callModel` entirely.
 *
 * This is the path hosted (server-executed) tools take. `callModel` cannot carry them — it converts
 * every `tools` entry as a client function tool — and there is nothing for its loop to do on a run whose
 * tools are executed upstream anyway. Going direct also keeps the response VERBATIM: the request is
 * non-streaming, so the returned `OpenResponsesResult` is the body OpenRouter sent rather than one
 * reassembled from stream events, which is what preserves hosted-tool output items such as a
 * `file_search_call` and the chunks `include: ['file_search_call.results']` asked for.
 *
 * @param params - The client, request, and options.
 * @returns The response.
 * @throws {Error} When the request fails, or when a streaming response comes back for a non-streaming request.
 */
export async function sendOpenRouterResponsesRequest(params: SendOpenRouterResponsesRequestParams): Promise<OpenResponsesResult> {
  const { client, request, options } = params;
  const { requestTimeoutMs } = splitOpenRouterModelConfig(request.config);
  const responsesRequest = { ...openRouterResponsesRequestBody(request), stream: false } as unknown as ResponsesRequest & { stream?: false };

  const result = await responsesSend(client, { responsesRequest }, openRouterRequestOptions(options, requestTimeoutMs));

  if (!result.ok) {
    throw result.error;
  }

  // `stream: false` narrows the SDK's response union by contract only, so the narrowing is asserted
  // rather than assumed: an event stream read as a result yields a value whose every field is undefined,
  // which a caller would store as a successful call that produced nothing.
  if (typeof (result.value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function') {
    throw new TypeError('OpenRouter returned a streaming response for a non-streaming `/responses` request.');
  }

  return result.value as OpenResponsesResult;
}

/**
 * Starts a call for a built request and returns the SDK's `ModelResult` without consuming it.
 *
 * Use this when the caller needs the streaming / tool-event surface. Most callers want
 * {@link callModelForOpenRouterRequest}, which consumes the result into a normalized value.
 *
 * Hosted tools and client tools are NOT mutually exclusive here. When a config carries hosted tools this
 * assembles the `ModelResult` itself — client tools converted to API format exactly as `callModel` would,
 * with the hosted entries appended after that conversion — so a run can search a vector store AND drive
 * the client-side tool loop. `callModel` cannot express that: it owns the `tools` key and there is no
 * seam between its conversion and dispatch. Everything else about the run is unchanged, including the
 * `x-openrouter-callmodel` header and the `stopWhen` step ceiling.
 *
 * @param params - The client, request, tools, state, and options.
 * @returns The in-flight model result.
 */
export function openRouterModelResultForRequest<TTools extends readonly Tool[] = readonly Tool[]>(params: CallModelForOpenRouterRequestParams<TTools>): ModelResult<TTools> {
  const { client, request, tools, state, options } = params;
  const { maxSteps, requestTimeoutMs } = splitOpenRouterModelConfig(request.config);
  const requestOptions = openRouterRequestOptions(options, requestTimeoutMs);
  const hostedTools = openRouterHostedTools(request.config);
  let result: ModelResult<TTools>;

  if (hostedTools.length === 0) {
    result = callModel(client, openRouterCallModelInput(params), requestOptions);
  } else {
    // `stream` is dropped by name, exactly as the `callModel` path drops it, so neither path can inherit
    // a config-set value.
    const { stream: _stream, ...body } = openRouterResponsesRequestBody(request);

    const apiRequest: Record<string, unknown> = {
      ...body,
      tools: [...(tools == null ? [] : convertToolsToAPIFormat(tools)), ...hostedTools]
    };

    result = new ModelResult<TTools>({
      client,
      request: apiRequest as unknown as CallModelInput<TTools>,
      options: openRouterCallModelRequestOptions(requestOptions),
      ...(tools == null ? undefined : { tools }),
      ...(state == null ? undefined : { state }),
      ...(maxSteps == null ? undefined : { stopWhen: stepCountIs(maxSteps) })
    });
  }

  return result;
}

/**
 * Runs a built request to completion and normalizes the response.
 *
 * Routes to the direct `/responses` path for a hosted-tool run that needs no client-side tool loop, and
 * to `ModelResult` otherwise. The caller does not choose: which transport a request needs is a property
 * of the request, and making it a parameter would only create a way to get it wrong.
 *
 * @param params - The client, request, tools, state, and options.
 * @returns The normalized call result.
 */
export async function callModelForOpenRouterRequest<TTools extends readonly Tool[] = readonly Tool[]>(params: CallModelForOpenRouterRequestParams<TTools>): Promise<OpenRouterCallResult> {
  // Client tools and a `StateAccessor` both live on `ModelResult`, so a run using either needs the loop
  // that executes tools and round-trips conversation state — even when its hosted tools would otherwise
  // qualify it for the direct path.
  const needsClientToolLoop = (params.tools?.length ?? 0) > 0 || params.state != null;
  const sendDirect = openRouterHostedTools(params.request.config).length > 0 && !needsClientToolLoop;
  const response = sendDirect ? await sendOpenRouterResponsesRequest(params) : await openRouterModelResultForRequest(params).getResponse();

  return openRouterCallResultFromResponse(response);
}

/**
 * Normalizes an OpenRouter response into an {@link OpenRouterCallResult}.
 *
 * @param response - The response to normalize.
 * @returns The normalized result.
 */
export function openRouterCallResultFromResponse(response: OpenResponsesResult): OpenRouterCallResult {
  const outputText = openRouterOutputTextFromResponse(response);
  const usage = response.usage;

  return {
    outputText,
    outputJson: parseOpenRouterJsonOutput(outputText),
    generationIds: response.id ? [response.id] : [],
    usage: usage == null ? undefined : openRouterRunUsageFromResponseUsage(usage),
    model: response.model,
    error: response.error == null ? undefined : openRouterRunErrorFromResponseError(response.error),
    response
  };
}

/**
 * Reads the assistant text out of a response.
 *
 * The convenience `output_text` field is NOT populated by OpenRouter's `/responses` API — verified live,
 * on both a streaming and a non-streaming request: the body carries `output` items (`reasoning`, then
 * `message`) and no `output_text` at all. Reading that field alone therefore returns undefined for every
 * real call, so a run task would store an empty `o` on a call that answered perfectly well and was
 * charged for.
 *
 * Text is concatenated across ALL message items rather than just the first, since nothing guarantees a
 * response is limited to one.
 *
 * @param response - The response.
 * @returns The output text, or undefined when the response carried none.
 */
export function openRouterOutputTextFromResponse(response: OpenResponsesResult): Maybe<string> {
  let result: Maybe<string> = response.outputText;

  if (!result) {
    const text = (response.output ?? [])
      .filter((item) => item.type === 'message')
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === 'output_text')
      .map((part) => part.text ?? '')
      .join('');

    result = text || undefined;
  }

  return result;
}

/**
 * Flattens the SDK's nested usage object.
 *
 * A measurement the response did not report is OMITTED rather than carried as `undefined` or `null`.
 *
 * @param usage - The SDK usage object.
 * @returns The flattened usage.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterRunUsageFromResponseUsage(usage: NonNullable<OpenResponsesResult['usage']>): OpenRouterRunUsage {
  const { inputTokens, outputTokens, totalTokens, cost, isByok, inputTokensDetails, outputTokensDetails } = usage;
  return filterUndefinedValues({ inputTokens, outputTokens, totalTokens, reasoningTokens: outputTokensDetails?.reasoningTokens, cachedTokens: inputTokensDetails?.cachedTokens, cost, isByok }, true);
}

/**
 * Flattens the error an OpenRouter response reports in its body.
 *
 * Named rather than inlined at the one call site for the same reason
 * {@link openRouterRunUsageFromResponseUsage} is: a library that exports `OpenRouterRunError` as a type
 * should let a caller holding a raw `OpenResponsesResult` produce one without transcribing its shape.
 *
 * `code` goes through `String()` because OpenRouter reports a NUMERIC code here (the HTTP status), while
 * `OpenRouterRunError.code` is a string — the same field an SDK-thrown error fills with `ECONNRESET`.
 *
 * @param error - The error reported on the response.
 * @returns The flattened error.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterRunErrorFromResponseError(error: NonNullable<OpenResponsesResult['error']>): OpenRouterRunError {
  const { code, message } = error;
  return { code: code == null ? undefined : String(code), message };
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
