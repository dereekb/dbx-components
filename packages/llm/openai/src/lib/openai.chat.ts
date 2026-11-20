import { type Maybe, type Milliseconds } from '@dereekb/util';
import { toLlmAttachmentDataUrl, toLlmThreadChatMessages, type LlmAttachment, type LlmReasoningConfig, type LlmReasoningOffEncoding, type LlmThreadRole, type LlmThreadTurn, type RawLlmUsage, type LlmGenerationId, type LlmTokenCount } from '@dereekb/llm';

/**
 * The OpenAI-compatible chat wire: the request / response shapes every OpenAI-compatible transport sends and reads
 * (`/openai` and `/openrouter` alike), and the pure helpers that build their parts. Modeled locally (a structural
 * subset of the `openai` SDK's types) so a spec fake can stand in for the client and no emitted declaration names the
 * SDK.
 *
 * It is ONE superset wire: the fields only OpenRouter sets (`cache_control`, the full nested `reasoning`) or reads
 * (`provider`, `native_finish_reason`) are optional and documented as such; the `openai` transport never sets them.
 */

// MARK: Reasoning
/**
 * The two no-reasoning effort bands the OFF encodings use (`'effort-none'` / `'effort-minimal'`).
 */
export type LlmOpenAiReasoningOffEffort = 'none' | 'minimal';

/**
 * The reasoning-effort bands this transport can emit — the OFF bands plus the {@link LlmReasoningConfig} effort enum.
 */
export type LlmOpenAiReasoningEffort = LlmOpenAiReasoningOffEffort | NonNullable<LlmReasoningConfig['effort']>;

/**
 * The nested `reasoning` request param — OpenRouter's spelling of {@link LlmReasoningConfig} (the camelCase
 * `maxTokens` becomes the snake_case `max_tokens`). OpenRouter sends the full object; the `openai` transport sends
 * only its `{ enabled: false }` subset, for the `'nested-disabled'` OFF encoding.
 */
export interface LlmOpenAiNestedReasoning {
  /**
   * The effort band.
   */
  readonly effort?: LlmReasoningConfig['effort'];
  /**
   * A hard reasoning-token budget.
   */
  readonly max_tokens?: LlmTokenCount;
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
 * The reasoning params one call contributes to the request body — exactly one shape is populated (or neither, for
 * an unconfigured call), so it is spread onto the body verbatim.
 */
export interface LlmOpenAiReasoningParams {
  /**
   * The flat effort band (OpenAI's spelling).
   */
  readonly reasoning_effort?: LlmOpenAiReasoningEffort;
  /**
   * The nested object — OpenRouter's full spelling, or the `openai` transport's `{ enabled: false }` OFF encoding (an
   * aggregator proxying OpenRouter semantics behind an OpenAI-compatible path).
   */
  readonly reasoning?: LlmOpenAiNestedReasoning;
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
 * The inputs {@link toLlmOpenAiReasoningParams} maps — the resolved per-call reasoning config plus the OFF encoding.
 */
export interface ToLlmOpenAiReasoningParamsConfig {
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
 * The OpenAI-compatible chat base hands it an already-normalized config (`normalizeLlmReasoningConfig`); the OFF-first
 * branch stays for direct callers.
 *
 * @param config - The resolved reasoning config (absent ⇒ no params) plus the OFF encoding.
 * @returns The reasoning params to spread onto the request body.
 *
 * @example
 * ```ts
 * toLlmOpenAiReasoningParams({ reasoning: { enabled: false, effort: 'high' }, offEncoding: 'effort-none' });
 * // { reasoning_effort: 'none' }
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function toLlmOpenAiReasoningParams(config: ToLlmOpenAiReasoningParamsConfig): LlmOpenAiReasoningParams {
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
 * The inputs {@link toLlmOpenAiResponseFormat} maps.
 */
export interface LlmOpenAiResponseFormatConfig {
  /**
   * A stable schema name (the capability key).
   */
  readonly name: string;
  /**
   * The JSON-Schema object (the request's `responseSchemaHint`).
   */
  readonly schema: unknown;
}

/**
 * Build the strict `json_schema` {@link LlmOpenAiResponseFormat} for a request's schema hint.
 *
 * @param config - The schema name and the JSON-Schema object.
 * @returns The `response_format` to send.
 *
 * @example
 * ```ts
 * toLlmOpenAiResponseFormat({ name: 'summarize', schema: { type: 'object' } });
 * // { type: 'json_schema', json_schema: { name: 'summarize', schema: { type: 'object' }, strict: true } }
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function toLlmOpenAiResponseFormat(config: LlmOpenAiResponseFormatConfig): LlmOpenAiResponseFormat {
  return { type: 'json_schema', json_schema: { name: config.name, schema: config.schema, strict: true } };
}

/**
 * The Anthropic prompt-cache breakpoint marker a text part may carry.
 */
export interface LlmOpenAiCacheControl {
  /**
   * The cache lifetime class — always `'ephemeral'`.
   */
  readonly type: 'ephemeral';
}

/**
 * One TEXT content part — the plain assembled prompt, or one segment of it.
 */
export interface LlmOpenAiTextPart {
  /**
   * The part kind.
   */
  readonly type: 'text';
  /**
   * The text.
   */
  readonly text: string;
  /**
   * The Anthropic prompt-cache breakpoint. Set ONLY by OpenRouter's `anthropic/` route (OpenRouter forwards it to
   * Anthropic); the SDK forwards the unknown nested field verbatim.
   */
  readonly cache_control?: LlmOpenAiCacheControl;
}

/**
 * One IMAGE content part — an {@link LlmAttachment} as an `image_url` part carrying a `data:` URL.
 */
export interface LlmOpenAiImagePart {
  /**
   * The part kind.
   */
  readonly type: 'image_url';
  /**
   * The inline image, as a `data:<mime>;base64,<data>` URL.
   */
  readonly image_url: { readonly url: string };
}

/**
 * One CONTENT PART of a multimodal or block-structured message — a text part or an inline image. Image parts ride
 * ONLY when the slug being called is declared vision-capable, and always AFTER the text parts.
 */
export type LlmOpenAiContentPart = LlmOpenAiTextPart | LlmOpenAiImagePart;

/**
 * Build the `image_url` content part of one attachment.
 *
 * @param attachment - The attachment.
 * @returns The image part, carrying the attachment's `data:` URL.
 *
 * @example
 * ```ts
 * toLlmOpenAiImagePart({ kind: 'image', mime: 'image/png', dataBase64: 'QUJD' });
 * // { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } }
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function toLlmOpenAiImagePart(attachment: LlmAttachment): LlmOpenAiImagePart {
  return { type: 'image_url', image_url: { url: toLlmAttachmentDataUrl(attachment) } };
}

/**
 * One chat message the strategy sends — a replayed prior thread turn or the current user prompt. Plain string
 * content on an ordinary call; an ARRAY of {@link LlmOpenAiContentPart}s for a vision call carrying attachments, or
 * for OpenRouter's `cache_control` blocks.
 */
export interface LlmOpenAiChatMessage {
  /**
   * The message role — `'assistant'` only for a replayed prior reply turn.
   */
  readonly role: LlmThreadRole;
  /**
   * The message content — a plain string, or the content-part array.
   */
  readonly content: string | ReadonlyArray<LlmOpenAiContentPart>;
}

/**
 * The inputs {@link toLlmOpenAiChatMessages} maps.
 */
export interface LlmOpenAiChatMessagesConfig {
  /**
   * The current assembled prompt.
   */
  readonly prompt: string;
  /**
   * The replayed prior turns, oldest first; absent ⇒ a single-shot call.
   */
  readonly thread?: Maybe<ReadonlyArray<LlmThreadTurn>>;
  /**
   * The attachments that RIDE (already filtered by the slug's vision fact); empty ⇒ plain-string content.
   */
  readonly attachments: ReadonlyArray<LlmAttachment>;
}

/**
 * Build the plain chat messages of one call: the replayed thread as plain strings (cache splits dropped), then the
 * current user message. Its content is the plain prompt, or — when attachments ride — the prompt as a text part
 * followed by one image part per attachment, in order.
 *
 * @param config - The prompt, the optional thread and the attachments that ride.
 * @returns The chat messages, oldest first.
 *
 * @example
 * ```ts
 * toLlmOpenAiChatMessages({ prompt: 'Describe it', attachments: [] }); // [{ role: 'user', content: 'Describe it' }]
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function toLlmOpenAiChatMessages(config: LlmOpenAiChatMessagesConfig): LlmOpenAiChatMessage[] {
  const { prompt, thread, attachments } = config;
  const content: string | ReadonlyArray<LlmOpenAiContentPart> = attachments.length === 0 ? prompt : [{ type: 'text', text: prompt }, ...attachments.map(toLlmOpenAiImagePart)];
  return [...toLlmThreadChatMessages(thread ?? []), { role: 'user', content }];
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
  readonly max_tokens?: LlmTokenCount;
  /**
   * The generation-length cap under the newer `max_completion_tokens` key — present when the token-limit param is
   * `'max_completion_tokens'`.
   */
  readonly max_completion_tokens?: LlmTokenCount;
  /**
   * The reasoning-effort band (the request's reasoning config mapped to OpenAI's flat `reasoning_effort`) — the
   * resolved `effort` when reasoning is on, or the OFF band (`'none'` / `'minimal'`) when the dispatcher's
   * reasoning-OFF floor is encoded that way. An UNCONFIGURED reasoning request omits it entirely (some models reject
   * an unknown param).
   */
  readonly reasoning_effort?: LlmOpenAiReasoningEffort;
  /**
   * The OpenRouter-flavoured nested reasoning object. OpenRouter sends the full object whenever the request carries a
   * reasoning config; the `openai` transport sends it ONLY for the `'nested-disabled'` OFF encoding, so a bare OpenAI
   * gateway sees no unknown param.
   */
  readonly reasoning?: LlmOpenAiNestedReasoning;
  /**
   * The OpenRouter-flavoured usage-accounting opt-in — it asks the gateway to return `usage.cost`. OpenRouter sends it
   * on every call; the `openai` transport only under its `usageAccounting` (default OFF).
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
  readonly id?: LlmGenerationId;
  /**
   * The completion choices; the strategy reads `choices[0].message.content` + the finish reason. The provider-native
   * `native_finish_reason` is OpenRouter's, read only by the transport that asks for it.
   */
  readonly choices: ReadonlyArray<{ readonly message?: { readonly content?: Maybe<string> }; readonly finish_reason?: Maybe<string>; readonly native_finish_reason?: Maybe<string> }>;
  /**
   * The model the provider actually served (may resolve the routed id to a concrete provider/version).
   */
  readonly model?: string;
  /**
   * The upstream endpoint that served the call — OpenRouter's routing echo, read only by the transport that asks for
   * it.
   */
  readonly provider?: Maybe<string>;
  /**
   * Native token counts plus the cache-hit (`prompt_tokens_details.cached_tokens`) and hidden-reasoning
   * (`completion_tokens_details.reasoning_tokens`) observability fields when the provider returns them, plus the
   * OpenRouter-flavoured `cost` / `cost_details` an AGGREGATOR gateway may volunteer (absent on a bare endpoint; a
   * list-price figure on some gateways — see the strategy's `costBasis`). Some gateways send those two costs as
   * numeric STRINGS; `toLlmUsage` folds them to numbers. The core {@link RawLlmUsage} shape.
   */
  readonly usage?: Maybe<RawLlmUsage>;
}

/**
 * The per-request options the strategy stamps on `create` — the abort {@link AbortSignal} that hard-aborts a hung call
 * at a budget-scaled wall (`resolveLlmCompletionCallTimeoutMs` from `@dereekb/llm`) plus a matching per-request `timeout` so the SDK's own
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
