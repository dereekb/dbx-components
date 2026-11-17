import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type LlmReasoningConfig, type LlmReasoningOffEncoding } from '@dereekb/llm';

/**
 * The OpenAI-compatible chat wire: the request / response shapes the OpenAI-compatible strategy sends and reads, and
 * the pure helpers that build their parts. Modeled locally (a structural subset of the `openai` SDK's types) so a
 * spec fake can stand in for the client and no emitted declaration names the SDK.
 */

// MARK: Reasoning
/**
 * The reasoning-effort bands this transport can emit — the OpenAI / OpenRouter effort enum plus the two
 * no-reasoning bands (`'none'` / `'minimal'`) the OFF encodings use.
 */
export type LlmOpenAiReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high';

/**
 * The reasoning params one call contributes to the request body — exactly one shape is populated (or neither, for
 * an unconfigured call), so it is spread onto the body verbatim.
 */
export interface LlmOpenAiReasoningParams {
  /**
   * The flat effort band (OpenAI's spelling).
   */
  readonly reasoning_effort?: LlmOpenAiReasoningEffort;
  /**
   * The nested OFF object (an aggregator proxying OpenRouter semantics behind an OpenAI-compatible path).
   */
  readonly reasoning?: { readonly enabled: false };
}

/**
 * The wire params each reasoning-OFF encoding contributes — keyed so the mapping is data, not branches.
 *
 * `LLM_REASONING_OFF_ENCODINGS` (root) is the source of truth for the encodings; this map is typed exhaustive, so a
 * new encoding fails this entry's compile until it is mapped here.
 */
export const LLM_OPENAI_REASONING_OFF_PARAMS: Readonly<Record<LlmReasoningOffEncoding, LlmOpenAiReasoningParams>> = {
  'effort-none': { reasoning_effort: 'none' },
  'effort-minimal': { reasoning_effort: 'minimal' },
  'nested-disabled': { reasoning: { enabled: false } },
  omit: {}
};

/**
 * The inputs {@link llmOpenAiReasoningParamsOf} maps — the resolved per-call reasoning config plus the OFF encoding.
 */
export interface LlmOpenAiReasoningParamsConfig {
  /**
   * The resolved {@link LlmReasoningConfig} for this call; absent ⇒ no reasoning params at all.
   */
  readonly reasoning?: Maybe<LlmReasoningConfig>;
  /**
   * The resolved OFF encoding the `enabled: false` case is expressed as.
   */
  readonly offEncoding: LlmReasoningOffEncoding;
}

/**
 * Map a resolved {@link LlmReasoningConfig} onto the OpenAI-compatible reasoning params. An explicit
 * `enabled: false` is ENCODED (per {@link LlmReasoningOffEncoding}) rather than dropped — the flat string has no
 * `false`, and saying nothing about thinking is not the same assertion as "do not think" on a hybrid-reasoning
 * model, which would bill every call for invisible reasoning. An unset config still contributes nothing, so an
 * un-reasoned body stays byte-identical.
 *
 * @param config - The resolved reasoning config (absent ⇒ no params) plus the OFF encoding.
 * @returns The reasoning params to spread onto the request body.
 *
 * @example
 * ```ts
 * llmOpenAiReasoningParamsOf({ reasoning: { enabled: false, effort: 'high' }, offEncoding: 'effort-none' });
 * // { reasoning_effort: 'none' }
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function llmOpenAiReasoningParamsOf(config: LlmOpenAiReasoningParamsConfig): LlmOpenAiReasoningParams {
  const { reasoning, offEncoding } = config;
  let params: LlmOpenAiReasoningParams;

  if (reasoning == null) {
    params = {};
  } else if (reasoning.enabled === false) {
    // An explicit OFF beats a co-present `effort` — the dispatcher's floor is an ASSERTION the model must not
    // think, and it outranks whatever band a descriptor / tier left set.
    params = LLM_OPENAI_REASONING_OFF_PARAMS[offEncoding];
  } else {
    params = reasoning.effort == null ? {} : { reasoning_effort: reasoning.effort };
  }

  return params;
}

// MARK: Timeout
/**
 * The assumed streaming rate (completion tokens per second) the per-call abort timeout budgets against — a generous
 * floor so a legitimately long reply is never aborted for merely being large. A call's abort window is
 * `maxOutputTokens / this × 1000`, floored at the base timeout and capped at {@link LLM_OPENAI_MAX_CALL_TIMEOUT_MS}.
 */
export const LLM_OPENAI_TOKENS_PER_SEC = 30;

/**
 * The hard ceiling on any single call's abort window (10 min) — even a maximal output budget can never hang a call
 * longer than this before the per-request {@link AbortSignal} fires.
 */
export const LLM_OPENAI_MAX_CALL_TIMEOUT_MS: Milliseconds = 600_000;

/**
 * Resolve one call's per-request abort window — `max(baseTimeoutMs, maxOutputTokens / LLM_OPENAI_TOKENS_PER_SEC ×
 * 1000)`, hard-capped at {@link LLM_OPENAI_MAX_CALL_TIMEOUT_MS}. The base (the strategy `timeoutMs`) stays the floor; a
 * big-budget call scales its window up so its budgeted tokens have time to stream. (The OpenRouter entry keeps its
 * own copy, so the two transports stay independently tunable.)
 *
 * @param baseTimeoutMs - The strategy's base per-request timeout (the floor).
 * @param maxOutputTokens - The completion budget this call was sent with.
 * @returns The abort window in ms.
 *
 * @example
 * ```ts
 * llmOpenAiCallTimeoutMs(60_000, 4_096); // 136_534
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function llmOpenAiCallTimeoutMs(baseTimeoutMs: Milliseconds, maxOutputTokens: number): Milliseconds {
  return Math.min(LLM_OPENAI_MAX_CALL_TIMEOUT_MS, Math.max(baseTimeoutMs, Math.ceil((maxOutputTokens / LLM_OPENAI_TOKENS_PER_SEC) * 1000)));
}

// MARK: Wire types
/**
 * The OpenAI-compatible `response_format` for runtime-guaranteed structured output — the request's JSON-Schema hint
 * sent with `strict: true` so the provider constrains generation to it.
 */
export interface LlmOpenAiResponseFormat {
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
 * One CONTENT PART of a multimodal user message — the plain assembled prompt as a `text` part, and one `image_url`
 * part per attachment carrying a `data:` URL. Sent ONLY when the slug being called is declared vision-capable;
 * otherwise the message keeps its plain-string content.
 */
export type LlmOpenAiContentPart = { readonly type: 'text'; readonly text: string } | { readonly type: 'image_url'; readonly image_url: { readonly url: string } };

/**
 * One chat message the strategy sends — a replayed prior thread turn or the current user prompt. Plain string
 * content on every ordinary call (this transport sends no `cache_control` content blocks); an ARRAY of
 * {@link LlmOpenAiContentPart}s only for a vision call carrying attachments.
 */
export interface LlmOpenAiChatMessage {
  /**
   * The message role — `'assistant'` only for a replayed prior reply turn.
   */
  readonly role: 'user' | 'assistant';
  /**
   * The message content — a plain string, or the multimodal content-part array of a vision call.
   */
  readonly content: string | ReadonlyArray<LlmOpenAiContentPart>;
}

/**
 * The minimal chat-completion request body the strategy sends — the subset of the OpenAI-compatible schema it uses.
 * The completion-length cap rides under EITHER `max_tokens` or `max_completion_tokens` per the configured token-limit
 * param (exactly one is sent).
 */
export interface LlmOpenAiChatCompletionBody {
  /**
   * The request's model id.
   */
  readonly model: string;
  /**
   * The messages — any replayed thread turns (oldest first) followed by the current assembled-prompt user message.
   */
  readonly messages: ReadonlyArray<LlmOpenAiChatMessage>;
  /**
   * The structured-output enforcement, present only when the request carries a schema hint.
   */
  readonly response_format?: LlmOpenAiResponseFormat;
  /**
   * The generation-length cap under the historical `max_tokens` key — present when the token-limit param is
   * `'max_tokens'` (the default).
   */
  readonly max_tokens?: number;
  /**
   * The generation-length cap under the newer `max_completion_tokens` key — present when the token-limit param is
   * `'max_completion_tokens'`.
   */
  readonly max_completion_tokens?: number;
  /**
   * The reasoning-effort band (the request's reasoning config mapped to OpenAI's flat `reasoning_effort`) — the
   * resolved `effort` when reasoning is on, or the OFF band (`'none'` / `'minimal'`) when the dispatcher's
   * reasoning-OFF floor is encoded that way. An UNCONFIGURED reasoning request omits it entirely (some models reject
   * an unknown param).
   */
  readonly reasoning_effort?: LlmOpenAiReasoningEffort;
  /**
   * The OpenRouter-flavoured nested reasoning object — emitted ONLY for the `'nested-disabled'` OFF encoding. Never
   * sent otherwise, so a bare OpenAI gateway sees no unknown param.
   */
  readonly reasoning?: { readonly enabled: false };
  /**
   * The OpenRouter-flavoured usage-accounting opt-in, emitted ONLY under the strategy's `usageAccounting` (default
   * OFF) — it asks an AGGREGATOR gateway to return `usage.cost`. Never sent otherwise.
   */
  readonly usage?: { readonly include: true };
}

/**
 * The minimal chat-completion response shape the strategy reads — the first choice's message text + finish reason,
 * the generation id, the served-model id, and the native token counts (incl. the cache-hit + hidden-reasoning
 * observability fields). `cost` / `cost_details` are read OPPORTUNISTICALLY: a bare OpenAI endpoint returns neither,
 * but an aggregator gateway may volunteer them, and reading a field that is offered costs nothing.
 */
export interface LlmOpenAiChatCompletion {
  /**
   * The provider's generation id for this completion.
   */
  readonly id?: string;
  /**
   * The completion choices; the strategy reads `choices[0].message.content` + the finish reason.
   */
  readonly choices: ReadonlyArray<{ readonly message?: { readonly content?: Maybe<string> }; readonly finish_reason?: Maybe<string> }>;
  /**
   * The model the provider actually served (may resolve the routed id to a concrete provider/version).
   */
  readonly model?: string;
  /**
   * Native token counts plus the cache-hit (`prompt_tokens_details.cached_tokens`) and hidden-reasoning
   * (`completion_tokens_details.reasoning_tokens`) observability fields when the provider returns them, plus the
   * OpenRouter-flavoured `cost` / `cost_details` an AGGREGATOR gateway may volunteer (absent on a bare endpoint; a
   * list-price figure on some gateways — see the strategy's `costBasis`). Some gateways send those two costs as
   * numeric STRINGS; `llmUsageFrom` folds them to numbers.
   */
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly total_tokens?: number;
    readonly prompt_tokens_details?: { readonly cached_tokens?: number };
    readonly completion_tokens_details?: { readonly reasoning_tokens?: number };
    readonly cost?: number | string;
    readonly cost_details?: { readonly upstream_inference_cost?: number | string };
  };
}

/**
 * The per-request options the strategy stamps on `create` — the abort {@link AbortSignal} that hard-aborts a hung call
 * at a budget-scaled wall ({@link llmOpenAiCallTimeoutMs}) plus a matching per-request `timeout` so the SDK's own
 * client-level timeout floor never fires first. Modeled locally (a subset of the SDK's `RequestOptions`) so a spec
 * fake can read it.
 */
export interface LlmOpenAiRequestOptions {
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
export interface LlmOpenAiChatClient {
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
       * @param options - Optional per-request options — the abort signal + timeout.
       * @returns The completion response.
       */
      create(body: LlmOpenAiChatCompletionBody, options?: LlmOpenAiRequestOptions): Promise<LlmOpenAiChatCompletion>;
    };
  };
}
