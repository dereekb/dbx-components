/**
 * The OpenAI-compatible chat BASE — the one implementation every OpenAI-compatible chat transport is built on. It owns
 * the shared skeleton: the lazy `openai` SDK client (built once, `maxRetries: 0`) or an injected structural client,
 * the no-built-in-model guard, the per-slug vision filter and `attachmentsSent`, `response_format`, the budget-scaled
 * abort wall, usage folding through `llmUsageFrom`, result assembly, `healthCheck`, the credential-probe ladder and the
 * optional `providerStatus` delegation.
 *
 * A transport is a set of {@link LlmOpenAiCompatibleChatStrategyHooks}: its identity, its default base URL and probe
 * path, and the few per-call places the wires differ (the messages, the reasoning params, body extras and completion
 * extras). `makeLlmOpenAiStrategy` and `/openrouter`'s `makeLlmOpenRouterStrategy` are each one set of hooks.
 *
 * The library reads NO environment: the host resolves the key / base URL / model and passes them in.
 */
import { errorMessageOf, isNotNullOrEmptyString, makeTimeoutAbortSignal, type Maybe, type Milliseconds, removeTrailingSlashes } from '@dereekb/util';
import {
  DEFAULT_LLM_COMPLETION_TIMEOUT_MS,
  DEFAULT_LLM_MAX_OUTPUT_TOKENS,
  DEFAULT_LLM_TOKEN_LIMIT_PARAM,
  llmUsageFrom,
  normalizeLlmReasoningConfig,
  runLlmCredentialProbeLadder,
  type LlmAttachment,
  type LlmCacheMode,
  type LlmCompleteOptions,
  type LlmCompletion,
  type LlmCostBasis,
  type LlmCredentialProbe,
  type LlmCredentialProbeOptions,
  type LlmModelId,
  type LlmModelVisionMap,
  type LlmProviderStatus,
  type LlmProviderStatusOptions,
  type LlmProviderStatusSource,
  type LlmReasoningConfig,
  type LlmRequest,
  type LlmStrategy,
  type LlmStrategyHealth,
  type LlmStrategyId,
  type LlmTokenLimitParam,
  type LlmTransportCredentialProbe
} from '@dereekb/llm';
import { type ConfiguredFetch } from '@dereekb/util/fetch';
import { llmOpenAiCallTimeoutMs, toLlmOpenAiChatMessages, toLlmOpenAiResponseFormat, type LlmOpenAiChatClient, type LlmOpenAiChatCompletion, type LlmOpenAiChatCompletionBody, type LlmOpenAiChatMessage, type LlmOpenAiReasoningParams } from './openai.chat';
import { loadLlmOpenAiChatClient } from './openai.sdk';

/**
 * What every OpenAI-compatible transport's HOST configures. `LlmOpenAiStrategyConfig` extends it; `/openrouter`'s
 * config is it.
 */
export interface LlmOpenAiCompatibleChatStrategyConfig {
  /**
   * The INSTANCE name this transport registers under ({@link LlmStrategy.id}); defaults to the transport's
   * {@link LlmOpenAiCompatibleChatStrategyHooks.kind}.
   *
   * One process may hold SEVERAL instances of one transport — a LAN-served local model beside a remote gateway, or two
   * keys against one gateway — and the registry keys on the instance name. {@link LlmStrategy.kind} stays the
   * transport's kind on every instance, so telemetry and the transport-shaped lookups still see one transport.
   */
  readonly id?: LlmStrategyId;
  /**
   * An injected OpenAI-compatible client (a spec fake, or the host's own SDK client) — asserts the wire with no
   * socket. Set ⇒ used instead of building the real `openai` SDK client.
   */
  readonly client?: LlmOpenAiChatClient;
  /**
   * The API key, supplied by the host. Used to build the real client and by the generic credential probe; absent ⇒
   * the real-client path fails loud (an injected client stays key-free).
   */
  readonly apiKey?: string;
  /**
   * The model id a model-less call routes to. There is NO built-in default: absent here AND absent on the request ⇒
   * `complete` throws (a guessed slug would 404 against an unknown gateway). A per-call `LlmRequest.model` overrides
   * it.
   */
  readonly defaultModel?: LlmModelId;
  /**
   * The OpenAI-compatible base URL the real client and the generic credential probe are pointed at; defaults to the
   * transport's {@link LlmOpenAiCompatibleChatStrategyHooks.defaultBaseUrl}.
   */
  readonly baseUrl?: string;
  /**
   * The request timeout floor; defaults to `DEFAULT_LLM_COMPLETION_TIMEOUT_MS` (60 s). Each call's abort window scales
   * up from it with the call's completion budget ({@link llmOpenAiCallTimeoutMs}).
   */
  readonly timeoutMs?: Milliseconds;
  /**
   * The completion-length cap (the runaway guard); defaults to `DEFAULT_LLM_MAX_OUTPUT_TOKENS` (8,192). Sent on every
   * completion. A per-call `LlmRequest.maxOutputTokens` overrides it. A model with a smaller output limit (an older
   * OpenAI model, a small-context local model) needs it set.
   */
  readonly maxOutputTokens?: number;
  /**
   * PER-MODEL VISION capability, keyed by the exact slug sent on the wire. A slug this map does not mark `true` is
   * sent the text-only message even when the request carries attachments, so an absent map sends no image parts. The
   * host supplies it from its model facts.
   */
  readonly visionByModel?: LlmModelVisionMap;
  /**
   * What the provider's synchronous `usage.cost` figure IS when it is not the bill ({@link LlmCostBasis}) — stamped
   * onto every result's `LlmUsage.costBasis` that carries a cost. The host derives it from the provider's DECLARED
   * metering, never from the base URL. Absent ⇒ the figure is read as the bill.
   */
  readonly costBasis?: LlmCostBasis;
  /**
   * The HTTP seam {@link LlmStrategy.credentialProbe} goes through — a spec's fake. Absent ⇒ the global `fetch`. The
   * completion path never touches it (that rides the `openai` SDK client).
   */
  readonly probeFetch?: ConfiguredFetch;
  /**
   * The account-metering source {@link LlmStrategy.providerStatus} delegates to — the seam that lets a
   * provider-neutral transport answer "how much of the period's quota is spent?" without knowing which gateway it is
   * pointed at. Absent ⇒ the transport omits `providerStatus` ENTIRELY, so an aggregator reads "this transport does
   * not meter an account" rather than a false all-clear.
   */
  readonly providerStatusSource?: LlmProviderStatusSource;
  /**
   * A gateway-SPECIFIC credential probe {@link LlmStrategy.credentialProbe} delegates to instead of the transport's
   * generic one (a gateway that answers the generic probe 200 to any key needs its own). It runs even when a `client`
   * is injected: an explicit probe outranks the injected-client no-op. Absent ⇒ the generic probe.
   */
  readonly credentialProbeSource?: LlmCredentialProbe;
  /**
   * Passed to the real `openai` client, which refuses to run in a browser without it. Only read when the real client
   * is built (an injected client ignores it). Only set it for a browser app that holds the user's OWN key.
   */
  readonly dangerouslyAllowBrowser?: boolean;
}

/**
 * What every per-call hook receives — the request plus what the base already resolved for it.
 */
export interface LlmOpenAiCompatibleCallParams {
  /**
   * The request being sent.
   */
  readonly request: LlmRequest;
  /**
   * The model slug being sent (`request.model ?? config.defaultModel`).
   */
  readonly model: LlmModelId;
  /**
   * The request's reasoning config, normalized ONCE (`normalizeLlmReasoningConfig`): an OFF config arrives as
   * `{ enabled: false }` alone.
   */
  readonly reasoning: Maybe<LlmReasoningConfig>;
  /**
   * The attachments that RIDE — the request's attachments when the slug is declared vision-capable, else empty.
   */
  readonly attachments: ReadonlyArray<LlmAttachment>;
}

/**
 * The body keys a transport may append after the standard ones.
 */
export type LlmOpenAiCompatibleBodyExtras = Pick<LlmOpenAiChatCompletionBody, 'usage'>;

/**
 * What a transport reads off the completion beyond the standard fields.
 */
export interface LlmOpenAiCompatibleCompletionExtras {
  /**
   * The upstream endpoint that served the call ({@link LlmCompletion.provider}).
   */
  readonly provider?: Maybe<string>;
  /**
   * The finish reason used ONLY when the choice's `finish_reason` is absent.
   */
  readonly fallbackFinishReason?: Maybe<string>;
}

/**
 * The transport definition — what makes one OpenAI-compatible transport differ from another.
 */
export interface LlmOpenAiCompatibleChatStrategyHooks {
  /**
   * The transport KIND ({@link LlmStrategy.kind}) — also the default instance id and the prefix of every error.
   */
  readonly kind: LlmStrategyId;
  /**
   * The strategy's one-line description ({@link LlmStrategy.describe}).
   */
  readonly describe: string;
  /**
   * How the transport caches the stable preamble ({@link LlmStrategy.caching}).
   */
  readonly caching: LlmCacheMode;
  /**
   * The base URL used when the host sets none.
   */
  readonly defaultBaseUrl: string;
  /**
   * Which request key carries the completion-length cap; defaults to `DEFAULT_LLM_TOKEN_LIMIT_PARAM` (`max_tokens`).
   */
  readonly tokenLimitParam?: Maybe<LlmTokenLimitParam>;
  /**
   * The transport's own credential probe — an authenticated, free request (e.g. `GET {baseUrl}/models`). The shared
   * `runLlmCredentialProbeLadder` calls it once a key is present and no probe source or injected client answers first.
   */
  readonly credentialProbe: LlmTransportCredentialProbe;
  /**
   * Build the call's messages. Defaults to the plain builder (`toLlmOpenAiChatMessages`).
   */
  readonly messages?: (params: LlmOpenAiCompatibleCallParams) => ReadonlyArray<LlmOpenAiChatMessage>;
  /**
   * Map the call's (normalized) reasoning config onto the body's reasoning params.
   */
  readonly reasoningParams: (params: LlmOpenAiCompatibleCallParams) => LlmOpenAiReasoningParams;
  /**
   * The transport's extra body keys, appended LAST (after `response_format`).
   */
  readonly bodyExtras?: (params: LlmOpenAiCompatibleCallParams) => LlmOpenAiCompatibleBodyExtras;
  /**
   * Read the transport's extra completion fields.
   */
  readonly completionExtras?: (completion: LlmOpenAiChatCompletion) => LlmOpenAiCompatibleCompletionExtras;
}

/**
 * The default message builder — plain-string thread turns, then the current prompt with any riding images after it.
 *
 * @param params - The call params.
 * @returns The chat messages.
 */
function defaultLlmOpenAiCompatibleMessages(params: LlmOpenAiCompatibleCallParams): ReadonlyArray<LlmOpenAiChatMessage> {
  return toLlmOpenAiChatMessages({ prompt: params.request.prompt, thread: params.request.thread, attachments: params.attachments });
}

/**
 * Build an OpenAI-compatible chat {@link LlmStrategy} from the host's config and the transport's hooks. With no
 * injected client it reaches the endpoint over the `openai` SDK, enforcing the reply schema via `response_format` when
 * the dispatcher threaded one; with an injected client it stays network-free.
 *
 * @param config - The host's config: the optional injected client, key, model, base URL, timeout and cap.
 * @param hooks - The transport definition.
 * @returns The strategy.
 *
 * @example
 * ```ts
 * const strategy = makeLlmOpenAiCompatibleChatStrategy(
 *   { apiKey, defaultModel: 'acme/model-flash' },
 *   { kind: 'acme', describe: 'Acme chat.', caching: 'auto-prefix', defaultBaseUrl: 'https://acme.example/v1', credentialProbe: (params) => probeLlmCredentialEndpoint({ ...params, url: `${params.baseUrl}/models` }), reasoningParams: () => ({}) }
 * );
 * ```
 */
export function makeLlmOpenAiCompatibleChatStrategy(config: LlmOpenAiCompatibleChatStrategyConfig, hooks: LlmOpenAiCompatibleChatStrategyHooks): LlmStrategy {
  const { kind } = hooks;
  // The INSTANCE name — what the registry keys on and what every result / probe / health issue is stamped with.
  const id = config.id ?? kind;
  const baseUrl = config.baseUrl ?? hooks.defaultBaseUrl;
  const timeoutMs = config.timeoutMs ?? DEFAULT_LLM_COMPLETION_TIMEOUT_MS;
  const maxOutputTokens = config.maxOutputTokens ?? DEFAULT_LLM_MAX_OUTPUT_TOKENS;
  const tokenLimitParam = hooks.tokenLimitParam ?? DEFAULT_LLM_TOKEN_LIMIT_PARAM;
  const buildMessages = hooks.messages ?? defaultLlmOpenAiCompatibleMessages;
  const { visionByModel, costBasis, providerStatusSource, credentialProbeSource } = config;
  // The real client is built once on first need and reused; an injected client never triggers it.
  let cachedClient: LlmOpenAiChatClient | undefined;

  const resolveClient = async (): Promise<LlmOpenAiChatClient> => {
    let client = config.client ?? cachedClient;

    if (client == null) {
      const apiKey = config.apiKey;

      if (!isNotNullOrEmptyString(apiKey)) {
        // Backstop — a host that gates startup with verifyLlmStrategies + healthCheck fails LOUD at bootstrap; this
        // still fires for a host that does not (or a strategy registered after bootstrap) on the first real call.
        throw new Error(`llm ${kind} strategy '${id}': no apiKey configured and no client injected (the host must supply apiKey, inject a client, or gate startup via verifyLlmStrategies).`);
      }

      cachedClient = await loadLlmOpenAiChatClient({ apiKey, baseUrl, timeoutMs, dangerouslyAllowBrowser: config.dangerouslyAllowBrowser });
      client = cachedClient;
    }

    return client;
  };

  return {
    id,
    kind,
    describe: hooks.describe,
    caching: hooks.caching,
    async complete(request: LlmRequest, options?: LlmCompleteOptions): Promise<LlmCompletion> {
      const client = await resolveClient();
      // NO built-in default model — fail loud when neither the strategy nor the request names one (a guessed slug
      // would 404 against an unknown gateway). The readiness surface warns earlier; this is the call-time backstop.
      const sentModel = request.model ?? config.defaultModel;

      if (!isNotNullOrEmptyString(sentModel)) {
        throw new Error(`llm ${kind} strategy '${id}': no model configured; set defaultModel on the strategy or pass request.model. There is no built-in model default.`);
      }

      // The completion-length cap (a per-call budget wins over the strategy default) rides under the transport's
      // token-limit key — exactly one of max_tokens / max_completion_tokens is sent.
      const tokenLimit = request.maxOutputTokens ?? maxOutputTokens;
      // The transport's own attach fact: the image parts ride only for a slug declared `vision: true`, so what was
      // SENT is decided here, beside the body, and stamped on the result (`LlmCompletion.attachmentsSent`).
      const requested = request.attachments ?? [];
      const attachments = visionByModel?.[sentModel] === true ? requested : [];
      // The reasoning-OFF precedence is normalized ONCE here, before the transport's mapper reads it.
      const params: LlmOpenAiCompatibleCallParams = { request, model: sentModel, reasoning: normalizeLlmReasoningConfig(request.reasoning), attachments };

      const body: LlmOpenAiChatCompletionBody = {
        model: sentModel,
        // Replay any prior thread turns ahead of the current user message; a thread-less call sends the single message.
        messages: buildMessages(params),
        ...(tokenLimitParam === 'max_completion_tokens' ? { max_completion_tokens: tokenLimit } : { max_tokens: tokenLimit }),
        ...hooks.reasoningParams(params),
        // response_format enforces the reply shape at GENERATION whenever the request carries a schema hint.
        ...(request.responseSchemaHint == null ? {} : { response_format: toLlmOpenAiResponseFormat({ name: request.capability, schema: request.responseSchemaHint }) }),
        // Transport extensions ride LAST, after every standard field.
        ...hooks.bodyExtras?.(params)
      };

      // The per-request abort signal is the HARD wall against a hung / runaway call: its window scales with the
      // completion budget but is capped at 10 min. `maxRetries: 0` on the client means the abort is never silently
      // re-tried by the SDK.
      const callTimeoutMs = llmOpenAiCallTimeoutMs(timeoutMs, tokenLimit);
      // The EXTERNAL cancellation signal, when threaded, is OR-combined with the timeout: whichever fires first aborts
      // the in-flight call. `makeTimeoutAbortSignal` also returns an already-aborted signal if cancellation latched
      // before the call, so the call rejects immediately.
      const callSignal = makeTimeoutAbortSignal({ timeout: callTimeoutMs, signal: options?.signal });
      const start = Date.now();
      const completion = await client.chat.completions.create(body, { signal: callSignal, timeout: callTimeoutMs });
      const latencyMs = Date.now() - start;
      const choice = completion.choices[0];
      const extras = hooks.completionExtras?.(completion);
      // `model` = served ?? sent — handles the model-less default and a per-call override alike.
      const model = completion.model ?? sentModel;
      // The upstream endpoint, when the transport reads one — conditional so a provider-less response stays byte-stable.
      const provider = extras?.provider ?? undefined;
      // Normalize the provider's snake_case usage block through the ONE shared mapper (`llmUsageFrom`): a bare endpoint
      // returns no `cost` and the key stays ABSENT, while one that volunteers it gets a real dollar figure — stamped
      // with the provider's cost BASIS when the figure is a list price, not the bill.
      const usage = llmUsageFrom(completion.usage, { costBasis });
      // The generation-metadata telemetry, kept conditional so an echo-less provider stays byte-stable.
      const generationId = completion.id ?? undefined;
      const finishReason = choice?.finish_reason ?? extras?.fallbackFinishReason ?? undefined;
      const attachmentsSent = requested.length === 0 ? undefined : attachments.length;

      // schemaEnforced = did THIS call SEND `response_format` json_schema/strict? — a "requested" signal, NOT a claim
      // the provider honoured it.
      return {
        text: choice?.message?.content ?? '',
        strategyId: id,
        strategyKind: kind,
        capability: request.capability,
        ...(request.meta == null ? {} : { meta: request.meta }),
        schemaEnforced: request.responseSchemaHint != null,
        model,
        ...(provider == null ? {} : { provider }),
        ...(usage == null ? {} : { usage }),
        latencyMs,
        ...(generationId == null ? {} : { generationId }),
        ...(finishReason == null ? {} : { finishReason }),
        ...(attachmentsSent == null ? {} : { attachmentsSent })
      };
    },
    async healthCheck(): Promise<LlmStrategyHealth> {
      let health: LlmStrategyHealth;

      if (config.client != null) {
        // Injected client ⇒ ready WITHOUT any real check: a fake must never trigger a key/SDK construction (the
        // contract's network-free guarantee).
        health = { ready: true, issues: [] };
      } else if (isNotNullOrEmptyString(config.apiKey)) {
        // Validate the client is CONSTRUCTIBLE (dynamic import + `new OpenAI(...)`) — NOT a network/auth probe.
        // resolveClient() caches, so a successful probe also warms the first real complete() call.
        try {
          await resolveClient();
          health = { ready: true, issues: [] };
        } catch (error) {
          // swallow site 'llm/<kind>-strategy.client' (each transport registers its own) — the verdict carries the
          // failure.
          health = { ready: false, issues: [{ severity: 'error', message: `${kind} client could not be constructed: ${errorMessageOf(error)}` }] };
        }
      } else {
        health = { ready: false, issues: [{ severity: 'error', message: `no apiKey configured and no client injected` }] };
      }

      return health;
    },
    credentialProbe(options?: LlmCredentialProbeOptions): Promise<LlmStrategyHealth> {
      // The shared ladder: missing key → host probe source (outranks an injected client) → injected-client no-op (an
      // explicit probeFetch is the spec's way to exercise the transport probe anyway) → the transport's own probe.
      return runLlmCredentialProbeLadder({
        strategyId: id,
        baseUrl: removeTrailingSlashes(baseUrl),
        apiKey: config.apiKey,
        injected: config.client != null,
        missingKeyMessage: 'no apiKey configured and no client injected',
        probeFetch: config.probeFetch,
        probeSource: credentialProbeSource,
        probe: hooks.credentialProbe,
        options
      });
    },
    // Present ONLY when the host injected a metering source. A conditional spread rather than a member that returns an
    // empty status, because an aggregator distinguishes "does not meter" (member absent) from "meters, and could not
    // read" (member present, `available: false`).
    ...(providerStatusSource == null
      ? {}
      : {
          // The account id rides ALONGSIDE the read, so an aggregator over several instances can fold them onto one
          // account BEFORE spending a round-trip per instance.
          providerStatusId: providerStatusSource.providerId,
          providerStatus: (options?: LlmProviderStatusOptions): Promise<LlmProviderStatus> => providerStatusSource.read(options)
        })
  };
}
