/**
 * The `openai` {@link LlmStrategy} — a PROVIDER-NEUTRAL transport that reaches any OpenAI-compatible
 * chat-completions endpoint (bare OpenAI, ZenMux `https://zenmux.ai/api/v1`, a self-hosted gateway, …) over the
 * `openai` SDK. It is one set of hooks over the shared OpenAI-compatible chat base
 * ({@link makeLlmOpenAiCompatibleChatStrategy}), with no OpenRouter-specific wire extension, so a strict
 * OpenAI-compatible gateway accepts every request.
 *
 * **The hooks this transport passes to the base:**
 * - Messages are ALWAYS plain `{ role, content: string }` (the base's default builder) — no Anthropic `cache_control`
 *   breakpoint blocks (those are an OpenRouter→Anthropic forwarding extension); the provider's implicit auto-prefix
 *   caching needs none. A vision call appends image parts after the prompt.
 * - No `native_finish_reason` / `provider` read, and the `usage: { include: true }` accounting opt-in is OFF by
 *   default ({@link LlmOpenAiStrategyConfig.usageAccounting}) — it is an OpenRouter param a strict gateway may reject.
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
 * - The generic credential probe is `GET {baseUrl}/models`, and a 404 there is a `'warning'` on a still-`ready`
 *   verdict (a gateway may simply not implement it).
 *
 * There is NO built-in default model: {@link LlmOpenAiCompatibleChatStrategyConfig.defaultModel} (the host resolves it)
 * or a per-call `LlmRequest.model` is REQUIRED — `complete` fails loud when neither is set, so a guessed slug can never
 * silently 404 against an unknown gateway.
 *
 * The library reads NO environment: the host resolves the key / base URL / token-limit param / model from its own
 * configuration and passes them in.
 */
import { DEFAULT_LLM_REASONING_OFF_ENCODING, llmReasoningOffEncodingFor, probeLlmCredentialEndpoint, type LlmModelReasoningOffMap, type LlmTransportCredentialProbe, type LlmReasoningOffEncoding, type LlmStrategy, type LlmStrategyId, type LlmTokenLimitParam } from '@dereekb/llm';
import { llmOpenAiReasoningParamsOf } from './openai.chat';
import { makeLlmOpenAiCompatibleChatStrategy, type LlmOpenAiCompatibleChatStrategyConfig, type LlmOpenAiCompatibleChatStrategyHooks } from './openai.compatible.strategy';

/**
 * The strategy KIND of the OpenAI-compatible transport ({@link LlmStrategy.kind}) and the default instance id.
 */
export const LLM_OPENAI_STRATEGY_KIND: LlmStrategyId = 'openai';

/**
 * The default OpenAI-compatible base URL — bare OpenAI.
 */
export const DEFAULT_LLM_OPENAI_BASE_URL = 'https://api.openai.com/v1';

/**
 * Config for {@link makeLlmOpenAiStrategy} — the shared OpenAI-compatible host config plus this transport's wire
 * knobs. The base URL defaults to {@link DEFAULT_LLM_OPENAI_BASE_URL}.
 */
export interface LlmOpenAiStrategyConfig extends LlmOpenAiCompatibleChatStrategyConfig {
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
   * Opt into OpenRouter-style usage accounting (`usage: { include: true }` on the body) so an AGGREGATOR gateway
   * returns `usage.cost`. Defaults to `false`: a strict OpenAI-compatible endpoint may reject the unknown param. Turn
   * it on only for a gateway known to proxy OpenRouter accounting semantics. The RESPONSE-side cost read is
   * unconditional and needs no opt-in.
   */
  readonly usageAccounting?: boolean;
}

/**
 * The OpenAI transport's own credential probe: `GET {baseUrl}/models`, the widest-compatible authenticated, no-cost
 * endpoint across OpenAI-compatible gateways. This transport is PROVIDER-NEUTRAL, so a gateway that simply does not
 * implement it must not be called dead: a 404 degrades to a `'warning'` on a still-`ready` verdict.
 *
 * @param params - The strategy id, trimmed base URL, key, fetch seam and signal.
 * @returns The credential verdict.
 */
const LLM_OPENAI_CREDENTIAL_PROBE: LlmTransportCredentialProbe = (params) => probeLlmCredentialEndpoint({ ...params, url: `${params.baseUrl}/models`, notFoundSeverity: 'warning' });

/**
 * Build the `openai` {@link LlmStrategy} — a provider-neutral transport over any OpenAI-compatible chat-completions
 * endpoint. With no injected client it reaches the endpoint over the `openai` SDK, enforcing the reply schema via
 * `response_format` when the dispatcher threaded one; with an injected client it stays network-free.
 *
 * @param config - The optional injected client + key, model, base URL, timeout, token-limit param, and reasoning-OFF
 *   encoding.
 * @returns The strategy.
 *
 * @example
 * ```ts
 * const gateway = makeLlmOpenAiStrategy({ id: 'gateway', apiKey, baseUrl: 'https://zenmux.ai/api/v1', defaultModel: 'vendor/model-flash' });
 * const completion = await gateway.complete({ prompt, capability: 'summarize' });
 * ```
 */
export function makeLlmOpenAiStrategy(config: LlmOpenAiStrategyConfig = {}): LlmStrategy {
  const { reasoningOffByModel } = config;
  const reasoningOffEncoding = config.reasoningOffEncoding ?? DEFAULT_LLM_REASONING_OFF_ENCODING;

  const hooks: LlmOpenAiCompatibleChatStrategyHooks = {
    kind: LLM_OPENAI_STRATEGY_KIND,
    describe: 'Any OpenAI-compatible chat-completions endpoint (bare OpenAI, ZenMux, a self-hosted gateway) over the openai SDK. Enforces the reply schema at generation via response_format (json_schema, strict) when the dispatcher threads one; parsed by the capability.',
    // The provider's implicit auto-prefix caching handles the stable preamble; no explicit breakpoint is sent.
    caching: 'auto-prefix',
    defaultBaseUrl: DEFAULT_LLM_OPENAI_BASE_URL,
    tokenLimitParam: config.tokenLimitParam,
    credentialProbe: LLM_OPENAI_CREDENTIAL_PROBE,
    // Reasoning maps onto the flat `reasoning_effort` (or, for the `nested-disabled` encoding, the nested object) — an
    // explicit OFF is ENCODED, never dropped; an unconfigured call still sends nothing. The OFF encoding is resolved
    // for THE SLUG being sent: whether `'none'` is accepted is a per-model fact.
    reasoningParams: ({ reasoning, model }) => llmOpenAiReasoningParamsOf({ reasoning, offEncoding: llmReasoningOffEncodingFor({ model, byModel: reasoningOffByModel, fallback: reasoningOffEncoding }) }),
    // OFF by default, so a strict gateway never sees this OpenRouter param.
    ...(config.usageAccounting === true ? { bodyExtras: () => ({ usage: { include: true as const } }) } : {})
  };

  return makeLlmOpenAiCompatibleChatStrategy(config, hooks);
}
