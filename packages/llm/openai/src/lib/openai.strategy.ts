/**
 * The `openai` {@link LlmStrategy} — a PROVIDER-NEUTRAL transport that reaches any OpenAI-compatible
 * chat-completions endpoint (bare OpenAI, ZenMux `https://zenmux.ai/api/v1`, a self-hosted gateway, …) over the
 * `openai` SDK. It is the sibling of the OpenRouter chat strategy (`@dereekb/llm/openrouter`): same skeleton (lazy
 * SDK load, `maxRetries: 0`, injectable structural client + text `run` seam, `healthCheck` as a constructibility
 * probe), but with the OpenRouter-specific wire extensions STRIPPED so a strict OpenAI-compatible gateway accepts
 * every request.
 *
 * **Deltas vs the OpenRouter strategy** (the reason this is a separate transport, not a config flag):
 * - Messages are ALWAYS plain `{ role, content: string }` — no Anthropic `cache_control` breakpoint blocks (those are
 *   an OpenRouter→Anthropic forwarding extension); the provider's implicit auto-prefix caching needs none.
 * - No `native_finish_reason` read, and the `usage: { include: true }` accounting opt-in is OFF by default
 *   ({@link LlmOpenAiStrategyConfig.usageAccounting}) — it is an OpenRouter param a strict gateway may reject.
 *   `cost` / `cost_details` ARE read opportunistically off the RESPONSE (a zero-request-byte change): a bare
 *   endpoint returns neither and the `LlmUsage.cost` key stays absent, but an aggregator that volunteers them
 *   reports real dollars.
 * - Reasoning maps onto OpenAI's `reasoning_effort` (a bare string) rather than OpenRouter's nested `reasoning`
 *   object. An explicit reasoning-OFF (`LlmReasoningConfig.enabled === false`, the dispatcher's global floor) is
 *   ENCODED — per {@link LlmOpenAiStrategyConfig.reasoningOffEncoding} (or, for the slug being sent,
 *   {@link LlmOpenAiStrategyConfig.reasoningOffByModel}), default `reasoning_effort: 'none'` — NOT dropped: the flat
 *   string has no `false`, and saying nothing about thinking is not the same assertion as "do not think" on a
 *   hybrid-reasoning model. An UNSET reasoning config still contributes nothing.
 * - The completion-length cap is emitted under a CONFIGURABLE key ({@link LlmOpenAiStrategyConfig.tokenLimitParam},
 *   default `max_tokens`) so a gateway that requires `max_completion_tokens` is served without a fork.
 * - There is NO built-in default model: {@link LlmOpenAiStrategyConfig.defaultModel} (the host resolves it) or a
 *   per-call `LlmRequest.model` is REQUIRED — `complete` fails loud when neither is set, so a guessed slug can never
 *   silently 404 against an unknown gateway.
 *
 * The library reads NO environment: the host resolves the key / base URL / token-limit param / model from its own
 * configuration and passes them in.
 */
import { type Maybe, type Milliseconds } from '@dereekb/util';
import {
  DEFAULT_LLM_REASONING_OFF_ENCODING,
  DEFAULT_LLM_TOKEN_LIMIT_PARAM,
  llmReasoningOffEncodingFor,
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
  type LlmModelReasoningOffMap,
  type LlmModelVisionMap,
  type LlmProviderStatus,
  type LlmProviderStatusOptions,
  type LlmProviderStatusSource,
  type LlmReasoningOffEncoding,
  type LlmRequest,
  type LlmRunner,
  type LlmStrategy,
  type LlmStrategyHealth,
  type LlmStrategyId,
  type LlmThreadTurn,
  type LlmTokenLimitParam,
  type LlmUsage
} from '@dereekb/llm';
import { llmOpenAiCallTimeoutMs, llmOpenAiReasoningParamsOf, type LlmOpenAiChatClient, type LlmOpenAiChatCompletionBody, type LlmOpenAiChatMessage, type LlmOpenAiContentPart } from './openai.chat';
import { loadLlmOpenAiChatClient } from './openai.sdk';

/**
 * The strategy KIND of the OpenAI-compatible transport ({@link LlmStrategy.kind}) and the default instance id.
 */
export const LLM_OPENAI_STRATEGY_KIND: LlmStrategyId = 'openai';

/**
 * The default OpenAI-compatible base URL — bare OpenAI.
 */
export const DEFAULT_LLM_OPENAI_BASE_URL = 'https://api.openai.com/v1';

/**
 * The default per-request timeout floor (the abort window scales up from it with the completion budget).
 */
export const DEFAULT_LLM_OPENAI_TIMEOUT_MS: Milliseconds = 60_000;

/**
 * The default completion-length cap (the runaway guard) — the provider stops generating at this many completion
 * tokens, so a degenerate reply is aborted at the provider rather than billed to completion. Overridable per
 * strategy via {@link LlmOpenAiStrategyConfig.maxOutputTokens}, and per call via `LlmRequest.maxOutputTokens`.
 */
export const DEFAULT_LLM_OPENAI_MAX_OUTPUT_TOKENS = 4_096;

/**
 * Config for {@link makeLlmOpenAiStrategy}.
 */
export interface LlmOpenAiStrategyConfig {
  /**
   * The INSTANCE name this transport registers under ({@link LlmStrategy.id}); defaults to
   * {@link LLM_OPENAI_STRATEGY_KIND}.
   *
   * One process may hold SEVERAL `openai` transports — a LAN-served local model beside a remote gateway, or two keys
   * against one gateway — and the registry keys on the instance name. {@link LlmStrategy.kind} stays `'openai'` on
   * every instance, so telemetry and the transport-shaped lookups still see one transport.
   */
  readonly id?: LlmStrategyId;
  /**
   * A simple text-in / text-out runner seam. Set ⇒ the client + `response_format` path is bypassed entirely; the
   * request's model id still rides through as the second arg.
   */
  readonly run?: LlmRunner;
  /**
   * An injected OpenAI-compatible client (a spec fake, or the host's own SDK client). Set ⇒ used instead of building
   * the real `openai` SDK client.
   */
  readonly client?: LlmOpenAiChatClient;
  /**
   * The OpenAI-compatible API key, supplied by the host. Used only to build the real client; absent ⇒ the real-client
   * path fails loud (the injected seams stay key-free).
   */
  readonly apiKey?: string;
  /**
   * The model id a model-less call routes to. There is NO built-in default: absent here AND absent on the request ⇒
   * `complete` throws (a guessed slug would 404 against an unknown gateway). A per-call `LlmRequest.model` overrides
   * it.
   */
  readonly defaultModel?: LlmModelId;
  /**
   * The OpenAI-compatible base URL the real client is pointed at; defaults to {@link DEFAULT_LLM_OPENAI_BASE_URL}.
   */
  readonly baseUrl?: string;
  /**
   * The request timeout floor; defaults to {@link DEFAULT_LLM_OPENAI_TIMEOUT_MS}.
   */
  readonly timeoutMs?: Milliseconds;
  /**
   * The completion-length cap (the runaway guard); defaults to {@link DEFAULT_LLM_OPENAI_MAX_OUTPUT_TOKENS}. A
   * per-call `LlmRequest.maxOutputTokens` overrides it.
   */
  readonly maxOutputTokens?: number;
  /**
   * Which request key carries the completion-length cap; defaults to `DEFAULT_LLM_TOKEN_LIMIT_PARAM` (`max_tokens`).
   */
  readonly tokenLimitParam?: LlmTokenLimitParam;
  /**
   * How a reasoning-OFF call encodes the negative on the wire; defaults to `DEFAULT_LLM_REASONING_OFF_ENCODING`
   * (`reasoning_effort: 'none'`). Configurable for the same reason {@link tokenLimitParam} is: gateways vary, and a
   * hardcoded band a gateway rejects would 400 every call.
   *
   * The GLOBAL rung — {@link reasoningOffByModel} overrides it for the slugs it names.
   */
  readonly reasoningOffEncoding?: LlmReasoningOffEncoding;
  /**
   * PER-MODEL reasoning-OFF encodings, keyed by the exact slug sent on the wire — the narrowest rung: whether
   * `reasoning_effort: 'none'` is accepted is a property of the MODEL, not of the gateway. One gateway may serve a
   * model that 400s on `'none'` (it always thinks) beside one that honours it, so a single global encoding either
   * 400s one or silently drops the reasoning floor on the other.
   *
   * A slug this map does not name falls back to {@link reasoningOffEncoding} and then to the default, so an absent
   * map changes nothing. The host supplies it from its model facts.
   */
  readonly reasoningOffByModel?: LlmModelReasoningOffMap;
  /**
   * PER-MODEL VISION capability, keyed by the exact slug sent on the wire — the twin of {@link reasoningOffByModel}.
   * A slug this map does not mark `true` is called with a plain-string message even when the request carries
   * attachments, so an absent map sends no image parts. The host supplies it from its model facts.
   */
  readonly visionByModel?: LlmModelVisionMap;
  /**
   * Opt into OpenRouter-style usage accounting (`usage: { include: true }` on the body) so an AGGREGATOR gateway
   * returns `usage.cost`. Defaults to `false`: a strict OpenAI-compatible endpoint may reject the unknown param. Turn
   * it on only for a gateway known to proxy OpenRouter accounting semantics. The RESPONSE-side cost read is
   * unconditional and needs no opt-in.
   */
  readonly usageAccounting?: boolean;
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
  readonly probeFetch?: LlmCredentialProbeFetch;
  /**
   * The provider-SPECIFIC account-metering source {@link LlmStrategy.providerStatus} delegates to — the seam that lets
   * this PROVIDER-NEUTRAL transport answer "how much of the period's quota is spent?" without knowing which gateway
   * it is pointed at. Absent ⇒ the transport omits `providerStatus` ENTIRELY, so an aggregator reads "this transport
   * does not meter an account" rather than a false all-clear.
   */
  readonly providerStatusSource?: LlmProviderStatusSource;
  /**
   * The gateway-SPECIFIC credential probe {@link LlmStrategy.credentialProbe} delegates to (a gateway that answers the
   * generic `GET /models` probe 200 to any key needs its own). Absent ⇒ the generic probe.
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
 * Map the replayed thread turns onto plain-string chat messages (cache splits ignored — this transport sends no
 * `cache_control` blocks and leans on the provider's implicit auto-prefix caching).
 *
 * @param thread - The prior turns, oldest first.
 * @returns The chat messages to send ahead of the current user message.
 */
function threadMessages(thread: ReadonlyArray<LlmThreadTurn>): LlmOpenAiChatMessage[] {
  return thread.map((turn) => ({ role: turn.role, content: turn.content }));
}

/**
 * Inputs of {@link openAiUserContent}.
 */
interface OpenAiUserContentConfig {
  readonly prompt: string;
  readonly attachments?: Maybe<ReadonlyArray<LlmAttachment>>;
  readonly vision: boolean;
}

/**
 * Build the CURRENT user message's content — the plain assembled prompt, or (only when the slug being called is
 * declared vision-capable AND the request carries attachments) a content-part array with the prompt first and one
 * `image_url` data-URL part per attachment.
 *
 * With no vision fact, or no attachments, this returns the plain prompt string, so the request body carries no image
 * parts and the model still receives whatever the prompt says about each attachment.
 *
 * @param config - The prompt, the optional attachments, and whether the target slug accepts them.
 * @returns The message content.
 */
function openAiUserContent(config: OpenAiUserContentConfig): string | ReadonlyArray<LlmOpenAiContentPart> {
  const { prompt, attachments, vision } = config;
  return !vision || attachments == null || attachments.length === 0 ? prompt : [{ type: 'text' as const, text: prompt }, ...attachments.map((attachment) => ({ type: 'image_url' as const, image_url: { url: `data:${attachment.mime};base64,${attachment.dataBase64}` } }))];
}

/**
 * Flatten a replayed thread + the current prompt into ONE role-tagged text prompt — the shape the injected
 * {@link LlmRunner} text seam receives on a chained follow-up (the runner contract is text-in / text-out). A
 * thread-less call never comes here — its prompt passes through unchanged.
 *
 * @param thread - The prior turns, oldest first.
 * @param prompt - The current user message.
 * @returns The flattened prompt.
 */
function flattenThreadPrompt(thread: ReadonlyArray<LlmThreadTurn>, prompt: string): string {
  return [...thread.map((turn) => `[${turn.role}]\n${turn.content}`), `[user]\n${prompt}`].join('\n\n');
}

/**
 * Build the `openai` {@link LlmStrategy} — a provider-neutral transport over any OpenAI-compatible chat-completions
 * endpoint. With no injected seam it reaches the endpoint over the `openai` SDK, enforcing the reply schema via
 * `response_format` when the dispatcher threaded one; with an injected runner / client it stays network-free.
 *
 * @param config - The optional injected runner / client + key, model, base URL, timeout, token-limit param, and
 *   reasoning-OFF encoding.
 * @returns The strategy.
 *
 * @example
 * ```ts
 * const gateway = makeLlmOpenAiStrategy({ id: 'gateway', apiKey, baseUrl: 'https://zenmux.ai/api/v1', defaultModel: 'vendor/model-flash' });
 * const completion = await gateway.complete({ prompt, capability: 'summarize' });
 * ```
 */
export function makeLlmOpenAiStrategy(config: LlmOpenAiStrategyConfig = {}): LlmStrategy {
  // The INSTANCE name — what the registry keys on and what every result / probe / health issue is stamped with.
  const id = config.id ?? LLM_OPENAI_STRATEGY_KIND;
  const timeoutMs = config.timeoutMs ?? DEFAULT_LLM_OPENAI_TIMEOUT_MS;
  const baseUrl = config.baseUrl ?? DEFAULT_LLM_OPENAI_BASE_URL;
  const maxOutputTokens = config.maxOutputTokens ?? DEFAULT_LLM_OPENAI_MAX_OUTPUT_TOKENS;
  const tokenLimitParam = config.tokenLimitParam ?? DEFAULT_LLM_TOKEN_LIMIT_PARAM;
  const reasoningOffEncoding = config.reasoningOffEncoding ?? DEFAULT_LLM_REASONING_OFF_ENCODING;
  const reasoningOffByModel = config.reasoningOffByModel;
  const visionByModel = config.visionByModel;
  const usageAccounting = config.usageAccounting === true;
  const costBasis = config.costBasis;
  const providerStatusSource = config.providerStatusSource;
  // The real client is built once on first need and reused; an injected client/runner never triggers it.
  let cachedClient: LlmOpenAiChatClient | undefined;

  const resolveClient = async (): Promise<LlmOpenAiChatClient> => {
    let client = config.client ?? cachedClient;

    if (client == null) {
      const apiKey = config.apiKey;

      if (apiKey == null || apiKey === '') {
        // Backstop — a host that gates startup with verifyLlmStrategies + healthCheck fails LOUD at bootstrap; this
        // still fires for a host that does not, on the first real call.
        throw new Error(`llm openai strategy '${id}': no apiKey configured and no client/runner injected (the host must supply apiKey, inject a client/runner, or gate startup via verifyLlmStrategies).`);
      }

      cachedClient = await loadLlmOpenAiChatClient({ apiKey, baseUrl, timeoutMs, dangerouslyAllowBrowser: config.dangerouslyAllowBrowser });
      client = cachedClient;
    }

    return client;
  };

  return {
    id,
    kind: LLM_OPENAI_STRATEGY_KIND,
    describe: 'Any OpenAI-compatible chat-completions endpoint (bare OpenAI, ZenMux, a self-hosted gateway) over the openai SDK. Enforces the reply schema at generation via response_format (json_schema, strict) when the dispatcher threads one; parsed by the capability.',
    // The provider's implicit auto-prefix caching handles the stable preamble; no explicit breakpoint is sent.
    caching: 'auto-prefix',
    async complete(request: LlmRequest, options?: LlmCompleteOptions): Promise<LlmCompletion> {
      let text: string;
      // The cost-observability telemetry — captured ONLY on the client path (a real completion was read). The
      // injected-run text seam leaves them unset.
      let model: LlmModelId | undefined;
      let usage: LlmUsage | undefined;
      let latencyMs: Milliseconds | undefined;
      let generationId: string | undefined;
      let finishReason: string | undefined;
      let attachmentsSent: number | undefined;
      // The replayed prior turns of a chained follow-up (empty ⇒ the single-shot path).
      const thread = request.thread ?? [];

      if (config.run == null) {
        const client = await resolveClient();
        // NO built-in default model — fail loud when neither the strategy nor the request names one (a guessed slug
        // would 404 against an unknown gateway). The readiness surface warns earlier; this is the call-time backstop.
        const sentModel = request.model ?? config.defaultModel;

        if (sentModel == null || sentModel === '') {
          throw new Error(`llm openai strategy '${id}': no model configured; set defaultModel on the strategy or pass request.model. There is no built-in model default.`);
        }

        // The completion-length cap (a per-call budget wins over the strategy default) rides under the configured
        // token-limit key — exactly one of max_tokens / max_completion_tokens is sent.
        const tokenLimit = request.maxOutputTokens ?? maxOutputTokens;
        // Reasoning maps onto the flat `reasoning_effort` (or, for the `nested-disabled` encoding, the nested
        // object) — an explicit OFF is ENCODED, never dropped; an unconfigured call still sends nothing. The OFF
        // encoding is resolved for THE SLUG being sent: whether `'none'` is accepted is a per-model fact.
        const reasoningParams = llmOpenAiReasoningParamsOf({ ...(request.reasoning == null ? {} : { reasoning: request.reasoning }), offEncoding: llmReasoningOffEncodingFor({ model: sentModel, byModel: reasoningOffByModel, fallback: reasoningOffEncoding }) });

        // The transport's own attach fact: the image parts ride only for a slug declared `vision: true`, so what was
        // SENT is decided here, beside the body, and stamped on the result (`LlmCompletion.attachmentsSent`).
        const sentVision = visionByModel?.[sentModel] === true;
        const requestedAttachments = request.attachments?.length ?? 0;
        const sentAttachments = sentVision ? requestedAttachments : 0;
        attachmentsSent = requestedAttachments === 0 ? undefined : sentAttachments;

        const body: LlmOpenAiChatCompletionBody = {
          model: sentModel,
          // Replay any prior thread turns (plain strings) ahead of the current user message; a thread-less call
          // sends the single message.
          messages: [...threadMessages(thread), { role: 'user', content: openAiUserContent({ prompt: request.prompt, attachments: request.attachments, vision: sentVision }) }],
          ...(tokenLimitParam === 'max_completion_tokens' ? { max_completion_tokens: tokenLimit } : { max_tokens: tokenLimit }),
          ...reasoningParams,
          // response_format enforces the reply shape at GENERATION whenever the request carries a schema hint.
          ...(request.responseSchemaHint == null ? {} : { response_format: { type: 'json_schema', json_schema: { name: request.capability, schema: request.responseSchemaHint, strict: true } } }),
          // OFF by default, so a strict gateway never sees this OpenRouter param.
          ...(usageAccounting ? { usage: { include: true as const } } : {})
        };

        // The per-request abort signal is the HARD wall against a hung / runaway call: its window scales with the
        // completion budget but is capped at 10 min. `maxRetries: 0` on the client means the abort is never silently
        // re-tried by the SDK.
        const callTimeoutMs = llmOpenAiCallTimeoutMs(timeoutMs, tokenLimit);
        // The EXTERNAL cancellation signal, when threaded, is OR-combined with the timeout: whichever fires first
        // aborts the in-flight call.
        const timeoutSignal = AbortSignal.timeout(callTimeoutMs);
        const callSignal = options?.signal == null ? timeoutSignal : AbortSignal.any([timeoutSignal, options.signal]);
        const start = Date.now();
        const completion = await client.chat.completions.create(body, { signal: callSignal, timeout: callTimeoutMs });
        latencyMs = Date.now() - start;
        text = completion.choices[0]?.message?.content ?? '';
        // `model` = served ?? sent — handles the model-less default and a per-call override alike.
        model = completion.model ?? sentModel;

        // Normalize the provider's snake_case usage block through the ONE shared mapper (`llmUsageFrom`): a bare
        // OpenAI endpoint returns no `cost` and the key stays ABSENT, while an aggregator that volunteers one gets a
        // real dollar figure — stamped with the provider's cost BASIS when the figure is a list price, not the bill.
        usage = llmUsageFrom(completion.usage, { costBasis });

        // The generation-metadata telemetry, kept conditional so an echo-less provider stays byte-stable.
        generationId = completion.id ?? undefined;
        finishReason = completion.choices[0]?.finish_reason ?? undefined;
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
        strategyKind: LLM_OPENAI_STRATEGY_KIND,
        capability: request.capability,
        ...(request.meta == null ? {} : { meta: request.meta }),
        schemaEnforced,
        ...(model == null ? {} : { model }),
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
        // swallow site 'llm/openai-strategy.client' — the verdict carries the failure.
        health = { ready: false, issues: [{ severity: 'error', message: `openai client could not be constructed: ${errorText(error)}` }] };
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

      // `GET /models` is the widest-compatible authenticated, no-cost endpoint across OpenAI-compatible gateways.
      // This transport is PROVIDER-NEUTRAL, so a gateway that simply does not implement it must not be called dead:
      // a 404 degrades to a `'warning'` on a still-`ready` verdict, while a 401/403 — the revoked-credential case — is
      // a hard error carrying the provider's own words.
      return probeLlmCredentialEndpoint({
        strategyId: id,
        url: `${baseUrl.replace(/\/+$/, '')}/models`,
        apiKey,
        notFoundSeverity: 'warning',
        ...(probeFetch == null ? {} : { fetch: probeFetch }),
        ...(options?.signal == null ? {} : { signal: options.signal })
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
