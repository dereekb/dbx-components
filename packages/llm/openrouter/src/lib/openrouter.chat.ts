import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type LlmReasoningConfig } from '@dereekb/llm';

/**
 * The OpenRouter chat wire: the request / response shapes the OpenRouter chat strategy sends and reads over its
 * OpenAI-compatible API, and the pure helpers that build their parts. Modeled locally (not from the `openai` SDK
 * types) so the Anthropic-only `cache_control` field type-checks, a spec fake can stand in for the client, and no
 * emitted declaration names the SDK.
 */

// MARK: Timeout
/**
 * The assumed streaming rate (completion tokens per second) the per-call abort timeout budgets against — a generous
 * floor so a legitimately long reply is never aborted for merely being large. A call's abort window is
 * `maxOutputTokens / this × 1000`, floored at the base timeout and capped at
 * {@link LLM_OPENROUTER_MAX_CALL_TIMEOUT_MS}.
 */
export const LLM_OPENROUTER_TOKENS_PER_SEC = 30;

/**
 * The hard ceiling on any single call's abort window (10 min) — even a maximal output budget can never hang a call
 * longer than this before the per-request {@link AbortSignal} fires.
 */
export const LLM_OPENROUTER_MAX_CALL_TIMEOUT_MS: Milliseconds = 600_000;

/**
 * Resolve one call's per-request abort window — `max(baseTimeoutMs, maxOutputTokens / LLM_OPENROUTER_TOKENS_PER_SEC
 * × 1000)`, hard-capped at {@link LLM_OPENROUTER_MAX_CALL_TIMEOUT_MS}. The base (the strategy `timeoutMs`) stays the
 * floor; a big-budget call scales its window up so its budgeted tokens have time to stream.
 *
 * @param baseTimeoutMs - The strategy's base per-request timeout (the floor).
 * @param maxOutputTokens - The completion budget this call was sent with.
 * @returns The abort window in ms.
 *
 * @example
 * ```ts
 * llmOpenRouterCallTimeoutMs(60_000, 8_192); // 273_067
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function llmOpenRouterCallTimeoutMs(baseTimeoutMs: Milliseconds, maxOutputTokens: number): Milliseconds {
  return Math.min(LLM_OPENROUTER_MAX_CALL_TIMEOUT_MS, Math.max(baseTimeoutMs, Math.ceil((maxOutputTokens / LLM_OPENROUTER_TOKENS_PER_SEC) * 1000)));
}

// MARK: Reasoning
/**
 * The OpenRouter `reasoning` request param — the wire shape {@link LlmReasoningConfig} maps onto (the camelCase
 * `maxTokens` becomes the snake_case `max_tokens` the provider expects). Every field is conditionally spread by
 * {@link llmOpenRouterReasoningOf} so only the configured knobs land on the wire.
 */
export interface LlmOpenRouterReasoning {
  /**
   * The effort band (`'low'` / `'medium'` / `'high'`).
   */
  readonly effort?: 'low' | 'medium' | 'high';
  /**
   * A hard reasoning-token budget.
   */
  readonly max_tokens?: number;
  /**
   * Whether to exclude the reasoning trace from the reply.
   */
  readonly exclude?: boolean;
  /**
   * Whether reasoning is enabled at all.
   */
  readonly enabled?: boolean;
}

/**
 * Map a transport-agnostic {@link LlmReasoningConfig} onto the OpenRouter `reasoning` wire param — each field
 * conditionally spread so an unset knob never lands on the wire. The only rename is `maxTokens` → `max_tokens`.
 *
 * @param reasoning - The resolved reasoning config.
 * @returns The OpenRouter `reasoning` param.
 *
 * @example
 * ```ts
 * llmOpenRouterReasoningOf({ effort: 'low', maxTokens: 512 }); // { effort: 'low', max_tokens: 512 }
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function llmOpenRouterReasoningOf(reasoning: LlmReasoningConfig): LlmOpenRouterReasoning {
  return {
    ...(reasoning.effort == null ? {} : { effort: reasoning.effort }),
    ...(reasoning.maxTokens == null ? {} : { max_tokens: reasoning.maxTokens }),
    ...(reasoning.exclude == null ? {} : { exclude: reasoning.exclude }),
    ...(reasoning.enabled == null ? {} : { enabled: reasoning.enabled })
  };
}

// MARK: Wire types
/**
 * One `cache_control`-capable text content block of an OpenRouter chat message. The Anthropic-only `cache_control`
 * field rides through to the wire — the SDK forwards unknown nested fields verbatim.
 */
export interface LlmOpenRouterTextBlock {
  /**
   * The block kind — always `'text'` for an assembled-prompt segment.
   */
  readonly type: 'text';
  /**
   * The segment text (the stable prefix or the volatile suffix).
   */
  readonly text: string;
  /**
   * The Anthropic prompt-cache breakpoint, set ONLY on the stable prefix block of an Anthropic-family route.
   */
  readonly cache_control?: { readonly type: 'ephemeral' };
}

/**
 * One IMAGE content block — an `LlmAttachment` as an OpenAI-compatible `image_url` part carrying a `data:` URL.
 * Appended AFTER the text blocks so the cache-prefix block layout is untouched: the Anthropic breakpoint still sits
 * on the first block, and a call that carries no images sends none.
 */
export interface LlmOpenRouterImageBlock {
  /**
   * The block kind.
   */
  readonly type: 'image_url';
  /**
   * The inline image, as a `data:<mime>;base64,<data>` URL.
   */
  readonly image_url: { readonly url: string };
}

/**
 * One content block of an OpenRouter chat message — a text segment or an inline image.
 */
export type LlmOpenRouterContentBlock = LlmOpenRouterTextBlock | LlmOpenRouterImageBlock;

/**
 * The OpenAI-compatible `response_format` for runtime-guaranteed structured output — the request's JSON-Schema hint
 * sent with `strict: true` so the provider constrains generation to it.
 */
export interface LlmOpenRouterResponseFormat {
  /**
   * Selects JSON-Schema-constrained generation.
   */
  readonly type: 'json_schema';
  /**
   * The named, strict schema the reply must conform to.
   */
  readonly json_schema: {
    /**
     * A stable schema name (the capability key) — surfaced in provider telemetry / errors.
     */
    readonly name: string;
    /**
     * The JSON-Schema object (the request's `responseSchemaHint`).
     */
    readonly schema: unknown;
    /**
     * Enforce exact conformance (no extra / missing fields).
     */
    readonly strict: true;
  };
}

/**
 * One chat message the strategy sends — a replayed prior thread turn or the current user prompt (string content, or
 * content blocks when Anthropic breakpoint caching or images are in play).
 */
export interface LlmOpenRouterChatMessage {
  /**
   * The message role — `'assistant'` only for a replayed prior reply turn.
   */
  readonly role: 'user' | 'assistant';
  /**
   * The message content (string, or `cache_control`-capable blocks on an Anthropic-family route).
   */
  readonly content: string | ReadonlyArray<LlmOpenRouterContentBlock>;
}

/**
 * The minimal chat-completion request body the strategy sends — the subset of the OpenAI-compatible schema it uses.
 */
export interface LlmOpenRouterChatCompletionBody {
  /**
   * The request's model id (OpenRouter routes on it).
   */
  readonly model: string;
  /**
   * The messages — any replayed thread turns (oldest first) followed by the current user message.
   */
  readonly messages: ReadonlyArray<LlmOpenRouterChatMessage>;
  /**
   * The structured-output enforcement, present only when the request carries a schema hint.
   */
  readonly response_format?: LlmOpenRouterResponseFormat;
  /**
   * The generation-length cap (the runaway guard) — the provider stops generating at this many completion tokens, so
   * a degenerate reply is aborted rather than billed to completion. Sent on every call.
   */
  readonly max_tokens?: number;
  /**
   * The hybrid-reasoning controls (the request's reasoning config mapped to OpenRouter's `reasoning` param) — sent
   * ONLY when the request carries a reasoning config, so an un-reasoned call omits it entirely (some providers reject
   * an unknown `reasoning` param).
   */
  readonly reasoning?: LlmOpenRouterReasoning;
  /**
   * OpenRouter usage-accounting opt-in — sent on every call so the response `usage` carries the provider `cost`
   * (+ cost_details) alongside the native token counts.
   */
  readonly usage?: { readonly include: true };
}

/**
 * The minimal chat-completion response shape the strategy reads — the first choice's message text + finish reason,
 * the generation id, the served-model id, the upstream provider, and the token/cost usage block (incl. the cache-hit
 * + cost-detail observability fields).
 */
export interface LlmOpenRouterChatCompletion {
  /**
   * The provider's generation id for this completion (the stable handle for a later metadata lookup).
   */
  readonly id?: string;
  /**
   * The completion choices; the strategy reads `choices[0].message.content` + the finish reason.
   */
  readonly choices: ReadonlyArray<{ readonly message?: { readonly content?: Maybe<string> }; readonly finish_reason?: Maybe<string>; readonly native_finish_reason?: Maybe<string> }>;
  /**
   * The model the provider actually served (may resolve the routed id to a concrete provider/version).
   */
  readonly model?: string;
  /**
   * The UPSTREAM endpoint OpenRouter routed this call to (`'DeepInfra'` / `'Fireworks'` / …). Read only so the
   * per-call endpoint is RECORDED: endpoints of one slug can differ in which request params they honour, and the
   * record is the evidence an endpoint allowlist stands on. No request-side `provider` param is sent.
   */
  readonly provider?: string;
  /**
   * Native token counts + (with `usage: { include: true }`) the provider cost, plus the cache-hit
   * (`prompt_tokens_details.cached_tokens`), cache-write (`prompt_tokens_details.cache_write_tokens` —
   * OpenRouter-normalized across providers; reported only by explicit-caching routes) and cost-detail
   * (`cost_details.upstream_inference_cost`) observability fields when the provider returns them.
   */
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly total_tokens?: number;
    readonly cost?: number;
    readonly prompt_tokens_details?: { readonly cached_tokens?: number; readonly cache_write_tokens?: number };
    readonly completion_tokens_details?: { readonly reasoning_tokens?: number };
    readonly cost_details?: { readonly upstream_inference_cost?: number };
  };
}

/**
 * The per-request options the strategy stamps on `create` — the abort {@link AbortSignal} that hard-aborts a hung call
 * at a budget-scaled wall ({@link llmOpenRouterCallTimeoutMs}) plus a matching per-request `timeout` so the SDK's own
 * client-level timeout floor never fires first on a scaled-up big-budget call. Modeled locally (a subset of the SDK's
 * `RequestOptions`) so a spec fake can read it.
 */
export interface LlmOpenRouterRequestOptions {
  /**
   * The abort signal fired when the call exceeds its budget-scaled wall.
   */
  readonly signal?: AbortSignal;
  /**
   * The per-request timeout (ms) — set to the same budget-scaled wall.
   */
  readonly timeout?: Milliseconds;
}

/**
 * The structural surface of the `openai` SDK client the strategy needs — `client.chat.completions.create`. Modeled
 * locally so a unit test can pass a fake and the real client casts onto it.
 */
export interface LlmOpenRouterChatClient {
  /**
   * The chat namespace — `completions.create` sends one chat-completion request.
   */
  readonly chat: {
    /**
     * The completions namespace.
     */
    readonly completions: {
      /**
       * Send one chat-completion request and resolve its response.
       *
       * @param body - The chat-completion request body.
       * @param options - Optional per-request options — the abort signal + timeout. A spec fake may ignore it.
       * @returns The completion response.
       */
      create(body: LlmOpenRouterChatCompletionBody, options?: LlmOpenRouterRequestOptions): Promise<LlmOpenRouterChatCompletion>;
    };
  };
}
