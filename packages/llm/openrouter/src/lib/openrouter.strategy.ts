/**
 * The `openrouter` {@link LlmStrategy} — any model over OpenRouter's OpenAI-compatible API, routed by the request's
 * model id, over the `openai` SDK pointed at OpenRouter.
 *
 * What it adds over a plain OpenAI-compatible call:
 * - An `anthropic/` route gets the prompt's stable prefix as a `cache_control: { type: 'ephemeral' }` content block
 *   (OpenRouter forwards it to Anthropic), and a chained follow-up puts a second breakpoint on the last replayed turn
 *   so the whole exchanged history is cached. Other routes get the plain prompt and lean on the provider's implicit
 *   auto-prefix caching.
 * - `usage: { include: true }` on every call, so the reply carries the provider `cost`.
 * - The request's reasoning config rides as OpenRouter's nested `reasoning` object.
 * - The served upstream `provider` is echoed, and `native_finish_reason` is the finish-reason fallback.
 *
 * There is NO built-in default model: {@link LlmOpenRouterStrategyConfig.defaultModel} (the host supplies it) or a
 * per-call `LlmRequest.model` is REQUIRED on the client path — `complete` fails loud when neither is set.
 *
 * The library reads NO environment: the host resolves the key / base URL / model and passes them in.
 */
import { type Maybe, type Milliseconds } from '@dereekb/util';
import {
  llmUsageFrom,
  probeLlmCredentialEndpoint,
  type LlmAttachment,
  type LlmCompleteOptions,
  type LlmCompletion,
  type LlmCostBasis,
  type LlmCredentialProbe,
  type LlmCredentialProbeFetch,
  type LlmCredentialProbeOptions,
  type LlmModelId,
  type LlmModelVisionMap,
  type LlmPromptCacheSegments,
  type LlmProviderStatus,
  type LlmProviderStatusOptions,
  type LlmProviderStatusSource,
  type LlmRequest,
  type LlmRunner,
  type LlmStrategy,
  type LlmStrategyHealth,
  type LlmStrategyId,
  type LlmThreadTurn,
  type LlmUsage
} from '@dereekb/llm';
import { llmOpenRouterCallTimeoutMs, llmOpenRouterReasoningOf, type LlmOpenRouterChatClient, type LlmOpenRouterChatCompletionBody, type LlmOpenRouterChatMessage, type LlmOpenRouterContentBlock, type LlmOpenRouterTextBlock } from './openrouter.chat';
import { loadLlmOpenRouterChatClient } from './openrouter.openai.sdk';

/**
 * The strategy KIND of the OpenRouter chat transport ({@link LlmStrategy.kind}) and the default instance id.
 */
export const LLM_OPENROUTER_STRATEGY_KIND: LlmStrategyId = 'openrouter';

/**
 * OpenRouter's OpenAI-compatible base URL — the chat client, the decision transport and the `/key` credential probe
 * all resolve against it.
 */
export const LLM_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * The default per-request timeout floor (the abort window scales up from it with the completion budget).
 */
export const DEFAULT_LLM_OPENROUTER_TIMEOUT_MS: Milliseconds = 60_000;

/**
 * The default `max_tokens` cap on a completion — the GENERATION-LENGTH guard against a degenerate runaway. The
 * dispatcher's bounded validate-and-retry guards CORRECTNESS, not generation LENGTH: a runaway reply is billed in full
 * before its decode rejects it, and this cap cuts it short at the provider.
 *
 * The floor deliberately errs HIGH, because a TRUNCATED reply is not a saving: it is billed in full, decodes to
 * nothing, and buys a retry that bills again. A cap low enough to truncate real work spends more than the runaway it
 * guards against. Capabilities whose size class is known pin their own budget per call (`LlmRequest.maxOutputTokens`)
 * rather than riding this; it is the floor for a capability nobody has measured yet. Overridable per strategy via
 * {@link LlmOpenRouterStrategyConfig.maxOutputTokens}.
 */
export const DEFAULT_LLM_OPENROUTER_MAX_OUTPUT_TOKENS = 8_192;

/**
 * The model-id prefix that selects the explicit `cache_control` breakpoint path (OpenRouter forwards it to
 * Anthropic). Every other family relies on the provider's implicit auto-prefix caching, so no breakpoint.
 */
const ANTHROPIC_MODEL_PREFIX = 'anthropic/';

/**
 * Config for {@link makeLlmOpenRouterStrategy}.
 */
export interface LlmOpenRouterStrategyConfig {
  /**
   * The INSTANCE name this transport registers under ({@link LlmStrategy.id}); defaults to
   * {@link LLM_OPENROUTER_STRATEGY_KIND}. {@link LlmStrategy.kind} stays `'openrouter'` on every instance.
   */
  readonly id?: LlmStrategyId;
  /**
   * A simple text-in / text-out runner seam. Set ⇒ the client + `response_format` path is bypassed entirely; the
   * request's model id still rides through as the second arg.
   */
  readonly run?: LlmRunner;
  /**
   * An injected OpenAI-compatible client (a spec fake, or the host's own SDK client) — asserts the `response_format`
   * / `cache_control` wiring with no socket. Set ⇒ used instead of building the real `openai` SDK client.
   */
  readonly client?: LlmOpenRouterChatClient;
  /**
   * The OpenRouter API key, supplied by the host. Used only to build the real client; absent ⇒ the real-client path
   * fails loud (the injected seams stay key-free).
   */
  readonly apiKey?: string;
  /**
   * The model id a model-less call routes to. There is NO built-in default (the host supplies it): absent here AND
   * absent on the request ⇒ `complete` throws on the client path. A per-call `LlmRequest.model` overrides it.
   */
  readonly defaultModel?: LlmModelId;
  /**
   * The OpenAI-compatible base URL the real client is pointed at; defaults to {@link LLM_OPENROUTER_BASE_URL}.
   */
  readonly baseUrl?: string;
  /**
   * The request timeout floor; defaults to {@link DEFAULT_LLM_OPENROUTER_TIMEOUT_MS}.
   */
  readonly timeoutMs?: Milliseconds;
  /**
   * The `max_tokens` generation-length cap (the runaway guard); defaults to
   * {@link DEFAULT_LLM_OPENROUTER_MAX_OUTPUT_TOKENS}. Sent on every completion. A per-call
   * `LlmRequest.maxOutputTokens` overrides it.
   */
  readonly maxOutputTokens?: number;
  /**
   * PER-MODEL VISION capability, keyed by the exact slug sent on the wire. A slug this map does not mark `true` is
   * sent the ordinary text-only body even when the request carries attachments, so an absent map sends no images.
   */
  readonly visionByModel?: LlmModelVisionMap;
  /**
   * What the provider's synchronous `usage.cost` figure IS when it is not the bill ({@link LlmCostBasis}) — stamped
   * onto every result's `LlmUsage.costBasis` that carries a cost. Absent ⇒ the figure is read as the bill.
   */
  readonly costBasis?: LlmCostBasis;
  /**
   * The HTTP seam {@link LlmStrategy.credentialProbe} goes through — a spec's fake. Absent ⇒ the global `fetch`. The
   * completion path never touches it (that rides the `openai` SDK client).
   */
  readonly probeFetch?: LlmCredentialProbeFetch;
  /**
   * The account-metering source {@link LlmStrategy.providerStatus} delegates to. Absent ⇒ the transport omits
   * `providerStatus` ENTIRELY ("does not meter an account", not a false all-clear).
   */
  readonly providerStatusSource?: LlmProviderStatusSource;
  /**
   * A credential probe {@link LlmStrategy.credentialProbe} delegates to instead of `GET {baseUrl}/key`. Absent ⇒ the
   * generic probe.
   */
  readonly credentialProbeSource?: LlmCredentialProbe;
  /**
   * Passed to the real `openai` client, which refuses to run in a browser without it. Only read when the real client
   * is built (an injected client / runner ignores it). Only set it for a browser app that holds the user's OWN key.
   */
  readonly dangerouslyAllowBrowser?: boolean;
}

/**
 * The message of an unknown thrown value — for the never-throw {@link LlmStrategy.healthCheck} to report a
 * client-construction failure as an `'error'` issue rather than propagate it.
 *
 * @param error - The thrown value.
 * @returns The message string.
 */
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Copy the blocks with a `cache_control` breakpoint added to the LAST one — the follow-up-call breakpoint that caches
 * the whole replayed history (the provider's longest-prefix lookup still finds the earlier calls' shorter cache
 * entries at prior block boundaries, so moving this breakpoint forward each turn reads the previous write and extends
 * it).
 *
 * @param blocks - The turn's content blocks (always ≥ 1).
 * @returns The blocks with the trailing breakpoint.
 */
function withBreakpointOnLastBlock(blocks: ReadonlyArray<LlmOpenRouterTextBlock>): ReadonlyArray<LlmOpenRouterTextBlock> {
  return blocks.map((block, index) => (index === blocks.length - 1 ? { ...block, cache_control: { type: 'ephemeral' as const } } : block));
}

/**
 * Map the replayed thread turns onto chat messages. On an Anthropic-family route each turn becomes content blocks: a
 * turn with a preserved cache split replays its ORIGINAL prefix-breakpoint block layout byte-identically (so the root
 * call's shared-preamble cache entry still matches), and the LAST prior turn carries a second breakpoint that caches
 * the whole exchanged history for this call ({@link withBreakpointOnLastBlock}). Other routes replay plain string
 * turns and lean on the provider's implicit auto-prefix caching.
 *
 * @param thread - The prior turns, oldest first.
 * @param anthropicRoute - Whether the routed model takes explicit `cache_control` breakpoints.
 * @returns The chat messages to send ahead of the current user message.
 */
function threadMessages(thread: ReadonlyArray<LlmThreadTurn>, anthropicRoute: boolean): LlmOpenRouterChatMessage[] {
  return thread.map((turn, index) => {
    let message: LlmOpenRouterChatMessage;

    if (anthropicRoute) {
      const segments = turn.cacheSegments;
      const blocks: LlmOpenRouterTextBlock[] = [];

      if (segments == null) {
        blocks.push({ type: 'text', text: turn.content });
      } else {
        blocks.push({ type: 'text', text: segments.cachePrefix, cache_control: { type: 'ephemeral' } });

        if (segments.volatileSuffix.length > 0) {
          blocks.push({ type: 'text', text: segments.volatileSuffix });
        }
      }

      message = { role: turn.role, content: index === thread.length - 1 ? withBreakpointOnLastBlock(blocks) : blocks };
    } else {
      message = { role: turn.role, content: turn.content };
    }

    return message;
  });
}

/**
 * Inputs of {@link openRouterUserContent}.
 */
interface OpenRouterUserContentConfig {
  readonly prompt: string;
  readonly segments?: Maybe<LlmPromptCacheSegments>;
  readonly anthropicRoute: boolean;
  readonly images: ReadonlyArray<LlmAttachment>;
}

/**
 * Build the CURRENT user message's content. An Anthropic-family route with a cache split gets the stable prefix as a
 * `cache_control: ephemeral` block (OpenRouter forwards it to Anthropic), followed by the volatile suffix when it is
 * non-empty; every other call gets the plain assembled prompt. Images are APPENDED after whatever text layout was
 * chosen — the prefix block (and its cache breakpoint) keeps its position, so adding a picture never invalidates the
 * warm prompt cache.
 *
 * @param config - The prompt, the cache split, whether the route takes breakpoints, and the images that ride.
 * @returns The message content.
 */
function openRouterUserContent(config: OpenRouterUserContentConfig): string | ReadonlyArray<LlmOpenRouterContentBlock> {
  const { prompt, segments, anthropicRoute, images } = config;
  let content: string | ReadonlyArray<LlmOpenRouterContentBlock> = prompt;

  if (anthropicRoute && segments != null) {
    const blocks: LlmOpenRouterContentBlock[] = [{ type: 'text', text: segments.cachePrefix, cache_control: { type: 'ephemeral' } }];

    if (segments.volatileSuffix.length > 0) {
      blocks.push({ type: 'text', text: segments.volatileSuffix });
    }

    content = blocks;
  }

  if (images.length > 0) {
    const textBlocks: ReadonlyArray<LlmOpenRouterContentBlock> = typeof content === 'string' ? [{ type: 'text', text: content }] : content;
    content = [...textBlocks, ...images.map((attachment) => ({ type: 'image_url' as const, image_url: { url: `data:${attachment.mime};base64,${attachment.dataBase64}` } }))];
  }

  return content;
}

/**
 * Flatten a replayed thread + the current prompt into ONE role-tagged text prompt — the shape the injected
 * {@link LlmRunner} text seam receives on a chained follow-up (the runner contract is text-in / text-out, so the
 * exchange is rendered inline rather than dropped). A thread-less call never comes here.
 *
 * @param thread - The prior turns, oldest first.
 * @param prompt - The current user message.
 * @returns The flattened prompt.
 */
function flattenThreadPrompt(thread: ReadonlyArray<LlmThreadTurn>, prompt: string): string {
  return [...thread.map((turn) => `[${turn.role}]\n${turn.content}`), `[user]\n${prompt}`].join('\n\n');
}

/**
 * Build the `openrouter` {@link LlmStrategy}. With no injected seam it reaches the request's model over OpenRouter's
 * OpenAI-compatible API, enforcing the reply schema via `response_format` when the dispatcher threaded one; with an
 * injected runner / client it stays network-free.
 *
 * @param config - The optional injected runner / client + key, default model, base URL and timeout.
 * @returns The strategy.
 *
 * @example
 * ```ts
 * const chat = makeLlmOpenRouterStrategy({ apiKey, defaultModel: 'anthropic/claude-opus-4.8' });
 * const completion = await chat.complete({ prompt, capability: 'summarize', cacheSegments });
 * ```
 */
export function makeLlmOpenRouterStrategy(config: LlmOpenRouterStrategyConfig = {}): LlmStrategy {
  // The INSTANCE name — what the registry keys on and what every result / probe / health issue is stamped with.
  const id = config.id ?? LLM_OPENROUTER_STRATEGY_KIND;
  const timeoutMs = config.timeoutMs ?? DEFAULT_LLM_OPENROUTER_TIMEOUT_MS;
  const baseUrl = config.baseUrl ?? LLM_OPENROUTER_BASE_URL;
  const maxOutputTokens = config.maxOutputTokens ?? DEFAULT_LLM_OPENROUTER_MAX_OUTPUT_TOKENS;
  const visionByModel = config.visionByModel;
  const costBasis = config.costBasis;
  const providerStatusSource = config.providerStatusSource;
  // The real client is built once on first need and reused; an injected client/runner never triggers it.
  let cachedClient: LlmOpenRouterChatClient | undefined;

  const resolveClient = async (): Promise<LlmOpenRouterChatClient> => {
    let client = config.client ?? cachedClient;

    if (client == null) {
      const apiKey = config.apiKey;

      if (apiKey == null || apiKey === '') {
        // Backstop — a host that gates startup with verifyLlmStrategies + healthCheck fails LOUD at bootstrap; this
        // still fires for a host that does not (or a strategy registered after bootstrap) on the first real call.
        throw new Error(`llm openrouter strategy '${id}': no apiKey configured and no client/runner injected (the host must supply apiKey, inject a client/runner, or gate startup via verifyLlmStrategies).`);
      }

      cachedClient = await loadLlmOpenRouterChatClient({ apiKey, baseUrl, timeoutMs, dangerouslyAllowBrowser: config.dangerouslyAllowBrowser });
      client = cachedClient;
    }

    return client;
  };

  return {
    id,
    kind: LLM_OPENROUTER_STRATEGY_KIND,
    describe: "Any model over OpenRouter's OpenAI-compatible API, routed by the request's model id. Enforces the reply schema at generation via response_format (json_schema, strict) when the dispatcher threads one; parsed by the capability.",
    // Anthropic-family routes get an explicit `cache_control` breakpoint at the stable prefix end.
    caching: 'breakpoint',
    async complete(request: LlmRequest, options?: LlmCompleteOptions): Promise<LlmCompletion> {
      let text: string;
      // The cost-observability telemetry — captured ONLY on the client path (a real completion was read). The
      // injected-run text seam leaves them unset.
      let model: LlmModelId | undefined;
      let usage: LlmUsage | undefined;
      let latencyMs: Milliseconds | undefined;
      // The generation-metadata telemetry (provider id + finish reason) — same client-path-only capture.
      let generationId: string | undefined;
      let finishReason: string | undefined;
      // The upstream endpoint that served the call, when the completion echoed one — the routing evidence.
      let provider: string | undefined;
      // The transport's own attach fact (`LlmCompletion.attachmentsSent`) — client path, attachments requested, only.
      let attachmentsSent: number | undefined;
      // The replayed prior turns of a chained follow-up (empty ⇒ the single-shot path).
      const thread = request.thread ?? [];

      if (config.run == null) {
        const client = await resolveClient();
        // NO built-in default model — fail loud when neither the strategy nor the request names one. The runner seam
        // (below) needs no model.
        const sentModel = request.model ?? config.defaultModel;

        if (sentModel == null || sentModel === '') {
          throw new Error(`llm openrouter strategy '${id}': no model configured; set defaultModel on the strategy or pass request.model. There is no built-in model default.`);
        }

        const anthropicRoute = sentModel.startsWith(ANTHROPIC_MODEL_PREFIX);
        // Anthropic-family routes get the stable prefix as a `cache_control: ephemeral` content block (OpenRouter
        // forwards it to Anthropic); other providers' implicit auto-prefix caching needs none, so they get the plain
        // assembled prompt. A missing `cacheSegments` split also degrades to the plain prompt.
        const segments = request.cacheSegments;
        // Images ride ONLY when the slug being called is declared vision-capable; otherwise the request is built
        // exactly as it always was.
        const images = visionByModel?.[sentModel] === true ? (request.attachments ?? []) : [];
        attachmentsSent = (request.attachments?.length ?? 0) === 0 ? undefined : images.length;
        const content = openRouterUserContent({ prompt: request.prompt, segments, anthropicRoute, images });

        const body: LlmOpenRouterChatCompletionBody = {
          model: sentModel,
          // Replay any prior thread turns (byte-identically, with the Anthropic history breakpoint) ahead of the
          // current user message; a thread-less call sends the single message.
          messages: [...threadMessages(thread, anthropicRoute), { role: 'user', content }],
          // Cap generation length so a degenerate runaway is aborted at the provider, not billed to completion. A
          // per-call `request.maxOutputTokens` wins over the strategy's own default cap.
          max_tokens: request.maxOutputTokens ?? maxOutputTokens,
          // The reasoning controls — sent ONLY when the request carries a reasoning config (some providers reject an
          // unknown `reasoning` param).
          ...(request.reasoning == null ? {} : { reasoning: llmOpenRouterReasoningOf(request.reasoning) }),
          // Opt into OpenRouter usage-accounting so the response `usage` carries `cost`.
          usage: { include: true },
          // response_format enforces the reply shape at GENERATION whenever the request carries a schema hint.
          ...(request.responseSchemaHint == null ? {} : { response_format: { type: 'json_schema', json_schema: { name: request.capability, schema: request.responseSchemaHint, strict: true } } })
        };

        // The per-request abort signal is the HARD wall against a hung / runaway call: its window scales with the
        // completion budget but is capped at 10 min. `maxRetries: 0` on the client means the abort is never silently
        // re-tried by the SDK.
        const callTimeoutMs = llmOpenRouterCallTimeoutMs(timeoutMs, body.max_tokens ?? maxOutputTokens);
        // The EXTERNAL cancellation signal, when threaded, is OR-combined with the timeout: whichever fires first
        // aborts the in-flight call. `AbortSignal.any` also returns an already-aborted signal if cancellation latched
        // before the call, so the call rejects immediately.
        const timeoutSignal = AbortSignal.timeout(callTimeoutMs);
        const callSignal = options?.signal == null ? timeoutSignal : AbortSignal.any([timeoutSignal, options.signal]);
        const start = Date.now();
        const completion = await client.chat.completions.create(body, { signal: callSignal, timeout: callTimeoutMs });
        latencyMs = Date.now() - start;
        text = completion.choices[0]?.message?.content ?? '';
        // `model` = served ?? sent.
        model = completion.model ?? sentModel;
        // The upstream endpoint, when echoed — conditional so a provider-less response stays byte-stable.
        provider = completion.provider ?? undefined;
        // Normalize the provider's snake_case usage block through the ONE shared mapper (`llmUsageFrom`), stamped
        // with the cost BASIS when the host declared the figure a list price.
        usage = llmUsageFrom(completion.usage, { costBasis });
        // The generation id + the finish reason (the normalized `finish_reason`, falling back to the provider-native
        // one). Kept conditional so an echo-less provider stays byte-stable.
        generationId = completion.id ?? undefined;
        finishReason = completion.choices[0]?.finish_reason ?? completion.choices[0]?.native_finish_reason ?? undefined;
      } else {
        // The injected text seam — bypasses the client + response_format; the request's model id rides through. A
        // chained follow-up flattens its replayed thread into the one text prompt the runner contract takes.
        text = await config.run(thread.length === 0 ? request.prompt : flattenThreadPrompt(thread, request.prompt), request.model);
      }

      // schemaEnforced = did THIS call SEND `response_format` json_schema/strict? The injected-run seam never sends
      // one (false); the client path sends it iff a schema hint was threaded — a "requested" signal, NOT a claim the
      // provider honoured it.
      const schemaEnforced = config.run == null ? request.responseSchemaHint != null : false;
      return {
        text,
        strategyId: id,
        strategyKind: LLM_OPENROUTER_STRATEGY_KIND,
        capability: request.capability,
        ...(request.meta == null ? {} : { meta: request.meta }),
        schemaEnforced,
        ...(model == null ? {} : { model }),
        ...(provider == null ? {} : { provider }),
        ...(usage == null ? {} : { usage }),
        ...(latencyMs == null ? {} : { latencyMs }),
        ...(generationId == null ? {} : { generationId }),
        ...(finishReason == null ? {} : { finishReason }),
        ...(attachmentsSent == null ? {} : { attachmentsSent })
      };
    },
    async healthCheck(): Promise<LlmStrategyHealth> {
      // Injected seam ⇒ ready WITHOUT any real check: a fake runner / injected client must never trigger a key/SDK
      // construction (the contract's network-free guarantee).
      if (config.run != null || config.client != null) {
        return { ready: true, issues: [] };
      }

      const apiKey = config.apiKey;

      if (apiKey == null || apiKey === '') {
        return { ready: false, issues: [{ severity: 'error', message: `no apiKey configured and no client/runner injected` }] };
      }

      // Validate the client is CONSTRUCTIBLE (dynamic import + `new OpenAI(...)`) — NOT a network/auth probe.
      // resolveClient() caches, so a successful probe also warms the first real complete() call.
      let health: LlmStrategyHealth;

      try {
        await resolveClient();
        health = { ready: true, issues: [] };
      } catch (error) {
        // swallow site 'llm/openrouter-strategy.client' — the verdict carries the failure.
        health = { ready: false, issues: [{ severity: 'error', message: `openrouter client could not be constructed: ${errorText(error)}` }] };
      }

      return health;
    },
    async credentialProbe(options?: LlmCredentialProbeOptions): Promise<LlmStrategyHealth> {
      // Injected seam ⇒ ready WITHOUT a socket, mirroring healthCheck. An explicit probeFetch is the spec's way to
      // exercise this path anyway, so it wins over the no-op.
      const probeFetch = config.probeFetch;

      if (probeFetch == null && (config.run != null || config.client != null)) {
        return { ready: true, issues: [] };
      }

      const apiKey = config.apiKey;

      if (apiKey == null || apiKey === '') {
        return { ready: false, issues: [{ severity: 'error', message: `no apiKey configured and no client/runner injected` }] };
      }

      if (config.credentialProbeSource != null) {
        return config.credentialProbeSource(options);
      }

      // `GET /key` is OpenRouter's free key-metadata endpoint — a revoked key answers `401 "User not found."`, which is
      // carried through verbatim. A 404 here IS a real error (OpenRouter always implements it), so the endpoint keeps
      // the default `'error'` policy rather than the openai transport's lenient one.
      return probeLlmCredentialEndpoint({
        strategyId: id,
        url: `${baseUrl.replace(/\/+$/, '')}/key`,
        apiKey,
        ...(probeFetch == null ? {} : { fetch: probeFetch }),
        ...(options?.signal == null ? {} : { signal: options.signal })
      });
    },
    // Present ONLY when the host injected a metering source — an aggregator distinguishes "does not meter" (member
    // absent) from "meters, and could not read" (member present, `available: false`).
    ...(providerStatusSource == null
      ? {}
      : {
          providerStatusId: providerStatusSource.providerId,
          providerStatus: (options?: LlmProviderStatusOptions): Promise<LlmProviderStatus> => providerStatusSource.read(options)
        })
  };
}
