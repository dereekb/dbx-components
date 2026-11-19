/**
 * The `openrouter` {@link LlmStrategy} — any model over OpenRouter's OpenAI-compatible API, routed by the request's
 * model id. It is built on the OpenAI-compatible chat base (`makeLlmOpenAiCompatibleChatStrategy` from
 * `@dereekb/llm/openai`), which owns the `openai` SDK client, the model guard, the vision filter, `response_format`,
 * the abort wall, usage folding, health and the credential-probe ladder.
 *
 * What it adds over the base's plain OpenAI-compatible call:
 * - An `anthropic/` route gets the prompt's stable prefix as a `cache_control: { type: 'ephemeral' }` content block
 *   (OpenRouter forwards it to Anthropic), and a chained follow-up puts a second breakpoint on the last replayed turn
 *   so the whole exchanged history is cached. Other routes get the base's plain messages and lean on the provider's
 *   implicit auto-prefix caching.
 * - The request's reasoning config rides as OpenRouter's nested `reasoning` object (an OFF config as
 *   `{ enabled: false }` alone — the base normalizes it first).
 * - `usage: { include: true }` on every call, so the reply carries the provider `cost`.
 * - The served upstream `provider` is echoed, and `native_finish_reason` is the finish-reason fallback.
 * - The generic credential probe is `GET {baseUrl}/key`, where a 404 is a real error.
 *
 * There is NO built-in default model: `defaultModel` (the host supplies it) or a per-call `LlmRequest.model` is
 * REQUIRED — `complete` fails loud when neither is set.
 *
 * The library reads NO environment: the host resolves the key / base URL / model and passes them in.
 */
import { type LlmStrategy, type LlmStrategyId, type LlmThreadTurn } from '@dereekb/llm';
import {
  makeLlmOpenAiCompatibleChatStrategy,
  toLlmOpenAiChatMessages,
  toLlmOpenAiImagePart,
  type LlmOpenAiChatMessage,
  type LlmOpenAiCompatibleCallParams,
  type LlmOpenAiCompatibleChatStrategyConfig,
  type LlmOpenAiCompatibleChatStrategyHooks,
  type LlmOpenAiContentPart,
  type LlmOpenAiTextPart
} from '@dereekb/llm/openai';
import { llmOpenRouterReasoningOf } from './openrouter.chat';

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
 * The model-id prefix that selects the explicit `cache_control` breakpoint path (OpenRouter forwards it to
 * Anthropic). Every other family relies on the provider's implicit auto-prefix caching, so no breakpoint.
 */
const ANTHROPIC_MODEL_PREFIX = 'anthropic/';

/**
 * Config for {@link makeLlmOpenRouterStrategy} — exactly the shared OpenAI-compatible host config. The base URL
 * defaults to {@link LLM_OPENROUTER_BASE_URL}. There is no `tokenLimitParam` / `reasoningOffEncoding` /
 * `usageAccounting`: this wire has one spelling for each (`max_tokens`, the nested `reasoning`, accounting always on).
 */
export type LlmOpenRouterStrategyConfig = LlmOpenAiCompatibleChatStrategyConfig;

/**
 * Copy the blocks with a `cache_control` breakpoint added to the LAST one — the follow-up-call breakpoint that caches
 * the whole replayed history (the provider's longest-prefix lookup still finds the earlier calls' shorter cache
 * entries at prior block boundaries, so moving this breakpoint forward each turn reads the previous write and extends
 * it).
 *
 * @param blocks - The turn's content blocks (always ≥ 1).
 * @returns The blocks with the trailing breakpoint.
 */
function withBreakpointOnLastBlock(blocks: ReadonlyArray<LlmOpenAiTextPart>): ReadonlyArray<LlmOpenAiTextPart> {
  return blocks.map((block, index) => (index === blocks.length - 1 ? { ...block, cache_control: { type: 'ephemeral' as const } } : block));
}

/**
 * Map one replayed thread turn onto Anthropic-route content blocks: a turn with a preserved cache split replays its
 * ORIGINAL prefix-breakpoint block layout byte-identically (so the root call's shared-preamble cache entry still
 * matches); any other turn is one text block.
 *
 * @param turn - The prior turn.
 * @returns The turn's text blocks.
 */
function toLlmOpenRouterAnthropicTurnBlocks(turn: LlmThreadTurn): LlmOpenAiTextPart[] {
  const segments = turn.cacheSegments;
  const blocks: LlmOpenAiTextPart[] = [];

  if (segments == null) {
    blocks.push({ type: 'text', text: turn.content });
  } else {
    blocks.push({ type: 'text', text: segments.cachePrefix, cache_control: { type: 'ephemeral' } });

    if (segments.volatileSuffix.length > 0) {
      blocks.push({ type: 'text', text: segments.volatileSuffix });
    }
  }

  return blocks;
}

/**
 * Build the messages of an `anthropic/` route. Each replayed turn becomes content blocks
 * ({@link toLlmOpenRouterAnthropicTurnBlocks}), and the LAST prior turn carries a second breakpoint that caches the
 * whole exchanged history for this call ({@link withBreakpointOnLastBlock}).
 *
 * The CURRENT message with a cache split gets the stable prefix as a `cache_control: ephemeral` block, followed by the
 * volatile suffix when it is non-empty; without a split it is the plain assembled prompt. Images are APPENDED after
 * whatever text layout was chosen — the prefix block (and its cache breakpoint) keeps its position, so adding a picture
 * never invalidates the warm prompt cache.
 *
 * @param params - The call params from the base.
 * @returns The chat messages, oldest first.
 */
function toLlmOpenRouterAnthropicMessages(params: LlmOpenAiCompatibleCallParams): LlmOpenAiChatMessage[] {
  const { request, attachments } = params;
  const thread = request.thread ?? [];
  const segments = request.cacheSegments;
  const priorMessages: LlmOpenAiChatMessage[] = thread.map((turn, index) => {
    const blocks = toLlmOpenRouterAnthropicTurnBlocks(turn);
    return { role: turn.role, content: index === thread.length - 1 ? withBreakpointOnLastBlock(blocks) : blocks };
  });

  let content: string | ReadonlyArray<LlmOpenAiContentPart> = request.prompt;

  if (segments != null) {
    const blocks: LlmOpenAiTextPart[] = [{ type: 'text', text: segments.cachePrefix, cache_control: { type: 'ephemeral' } }];

    if (segments.volatileSuffix.length > 0) {
      blocks.push({ type: 'text', text: segments.volatileSuffix });
    }

    content = blocks;
  }

  if (attachments.length > 0) {
    const textBlocks: ReadonlyArray<LlmOpenAiContentPart> = typeof content === 'string' ? [{ type: 'text', text: content }] : content;
    content = [...textBlocks, ...attachments.map(toLlmOpenAiImagePart)];
  }

  return [...priorMessages, { role: 'user', content }];
}

/**
 * The OpenRouter transport's hooks over the OpenAI-compatible chat base.
 */
const LLM_OPENROUTER_CHAT_STRATEGY_HOOKS: LlmOpenAiCompatibleChatStrategyHooks = {
  kind: LLM_OPENROUTER_STRATEGY_KIND,
  describe: "Any model over OpenRouter's OpenAI-compatible API, routed by the request's model id. Enforces the reply schema at generation via response_format (json_schema, strict) when the dispatcher threads one; parsed by the capability.",
  // Anthropic-family routes get an explicit `cache_control` breakpoint at the stable prefix end.
  caching: 'breakpoint',
  defaultBaseUrl: LLM_OPENROUTER_BASE_URL,
  // `GET /key` is OpenRouter's free key-metadata endpoint — a revoked key answers `401 "User not found."`, which is
  // carried through verbatim. A 404 here IS a real error (OpenRouter always implements it), so the probe keeps the
  // default `'error'` policy rather than the openai transport's lenient one.
  credentialProbe: { path: '/key' },
  // Anthropic-family routes get the cache breakpoint blocks; every other route gets the base's plain messages.
  messages: (params) => (params.model.startsWith(ANTHROPIC_MODEL_PREFIX) ? toLlmOpenRouterAnthropicMessages(params) : toLlmOpenAiChatMessages({ prompt: params.request.prompt, thread: params.request.thread, attachments: params.attachments })),
  // The reasoning controls — sent ONLY when the request carries a reasoning config (some providers reject an unknown
  // `reasoning` param).
  reasoningParams: ({ reasoning }) => (reasoning == null ? {} : { reasoning: llmOpenRouterReasoningOf(reasoning) }),
  // Opt into OpenRouter usage-accounting so the response `usage` carries `cost`.
  bodyExtras: () => ({ usage: { include: true } }),
  // The upstream endpoint that served the call (the routing evidence), and the provider-native finish reason as the
  // fallback when the normalized one is absent.
  completionExtras: (completion) => ({ provider: completion.provider, fallbackFinishReason: completion.choices[0]?.native_finish_reason })
};

/**
 * Build the `openrouter` {@link LlmStrategy}. With no injected client it reaches the request's model over OpenRouter's
 * OpenAI-compatible API, enforcing the reply schema via `response_format` when the dispatcher threaded one; with an
 * injected client it stays network-free.
 *
 * @param config - The optional injected client + key, default model, base URL and timeout.
 * @returns The strategy.
 *
 * @example
 * ```ts
 * const chat = makeLlmOpenRouterStrategy({ apiKey, defaultModel: 'anthropic/claude-opus-4.8' });
 * const completion = await chat.complete({ prompt, capability: 'summarize', cacheSegments });
 * ```
 */
export function makeLlmOpenRouterStrategy(config: LlmOpenRouterStrategyConfig = {}): LlmStrategy {
  return makeLlmOpenAiCompatibleChatStrategy(config, LLM_OPENROUTER_CHAT_STRATEGY_HOOKS);
}
