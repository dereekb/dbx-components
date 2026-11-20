import { describe, expect, it } from 'vitest';
import { type ConfiguredFetch } from '@dereekb/util/fetch';
import { DEFAULT_LLM_COMPLETION_TIMEOUT_MS, DEFAULT_LLM_MAX_OUTPUT_TOKENS, DEFAULT_LLM_REASONING_OFF_ENCODING, type LlmRequest } from '@dereekb/llm';
import { LLM_OPENAI_STRATEGY_KIND, makeLlmOpenAiStrategy } from './openai.strategy';
import { llmOpenAiCallTimeoutMs, type LlmOpenAiChatClient, type LlmOpenAiRequestOptions } from './openai.chat';

/**
 * The `openai` strategy — the provider-neutral hook set over the OpenAI-compatible chat base. Proves it (1) reaches
 * an injected client network-free, with the default cap + timeout floor and an external signal threaded, (2) builds a strict `response_format`
 * from the schema hint named by the capability and omits it when there is none, (3) honours the per-call model + the
 * default-model fallback AND fails loud when neither is set (no built-in model default), (4) ALWAYS sends
 * plain-string messages — no `cache_control` anywhere, even when `cacheSegments` is set, (5) sends NO OpenRouter-only
 * fields (`usage:{include:true}`, the nested `reasoning` object) on the DEFAULT encoding, (6) maps reasoning onto the
 * flat `reasoning_effort` — an effort band when reasoning is on, and an ENCODED negative (per `reasoningOffEncoding`,
 * default `'none'`) when it is explicitly disabled, (7) emits the completion-length cap under the configured
 * `tokenLimitParam` key, (8) declares `auto-prefix` caching with no warm seam, (9) fails loud (no network) with no
 * key + no seam, and the startup `healthCheck` verdict, plus (10) usage normalization and the chained-thread replay as
 * plain messages.
 *
 * Every network-touching case uses an injected fake client; the real `openai` SDK is constructed only for the
 * dummy-key probe (offline).
 */

const DEFAULT_MODEL = 'vendor/model-flash';

/**
 * The chat-completion body shape the fake client records — the subset the assertions read.
 */
interface RecordedBody {
  readonly model: string;
  readonly messages: ReadonlyArray<{ readonly role: string; readonly content: unknown }>;
  readonly response_format?: unknown;
  readonly max_tokens?: number;
  readonly max_completion_tokens?: number;
  readonly reasoning_effort?: unknown;
  readonly reasoning?: unknown;
  readonly usage?: unknown;
}

/**
 * The provider-shaped (snake_case) usage block the fake completion carries — the cache-hit
 * (`prompt_tokens_details.cached_tokens`) + hidden-reasoning (`completion_tokens_details.reasoning_tokens`) fields.
 */
interface FakeUsage {
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
  readonly total_tokens?: number;
  readonly prompt_tokens_details?: { readonly cached_tokens?: number };
  readonly completion_tokens_details?: { readonly reasoning_tokens?: number };
  readonly cost?: number | string;
  readonly cost_details?: { readonly upstream_inference_cost?: number | string };
}

/**
 * The default served model + usage the fake completion returns — an OpenAI route with token counts (no cost — a
 * bare OpenAI endpoint returns none).
 */
const DEFAULT_FAKE_MODEL = 'gpt-4o-mini';
const DEFAULT_FAKE_USAGE: FakeUsage = { prompt_tokens: 1200, completion_tokens: 300, total_tokens: 1500 };

/**
 * A fake OpenAI-compatible client that records each request body and returns a canned completion — the network-free
 * seam the strategy unit tests assert the wiring through.
 *
 * @param opts - The canned reply text + served-model / usage overrides.
 * @returns The fake client + the recorded bodies + the recorded per-request options.
 */
function makeFakeClient(opts: { readonly reply?: string; readonly model?: string; readonly usage?: FakeUsage; readonly includeModel?: boolean; readonly includeUsage?: boolean; readonly id?: string; readonly finishReason?: string } = {}): {
  readonly client: LlmOpenAiChatClient;
  readonly bodies: RecordedBody[];
  readonly options: LlmOpenAiRequestOptions[];
} {
  const reply = opts.reply ?? 'fake-reply';
  const includeModel = opts.includeModel ?? true;
  const includeUsage = opts.includeUsage ?? true;
  const model = opts.model ?? DEFAULT_FAKE_MODEL;
  const usage = opts.usage ?? DEFAULT_FAKE_USAGE;
  const bodies: RecordedBody[] = [];
  const options: LlmOpenAiRequestOptions[] = [];
  const client: LlmOpenAiChatClient = {
    chat: {
      completions: {
        create: async (body, requestOptions) => {
          bodies.push(body as RecordedBody);
          if (requestOptions != null) {
            options.push(requestOptions);
          }
          return {
            choices: [{ message: { content: reply }, ...(opts.finishReason == null ? {} : { finish_reason: opts.finishReason }) }],
            ...(opts.id == null ? {} : { id: opts.id }),
            ...(includeModel ? { model } : {}),
            ...(includeUsage ? { usage } : {})
          };
        }
      }
    }
  };
  return { client, bodies, options };
}

describe('makeLlmOpenAiStrategy()', () => {
  it('builds a strict json_schema response_format from the hint, named by the capability', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'gpt-4o' });
    const hint = { type: 'object', properties: { ok: { type: 'boolean' } }, additionalProperties: false };

    const result = await strategy.complete({ prompt: 'hi', capability: 'Summarize', responseSchemaHint: hint });

    expect(result).toEqual({ text: 'fake-reply', strategyId: LLM_OPENAI_STRATEGY_KIND, strategyKind: LLM_OPENAI_STRATEGY_KIND, capability: 'Summarize', schemaEnforced: true, model: DEFAULT_FAKE_MODEL, usage: { promptTokens: 1200, completionTokens: 300, totalTokens: 1500 }, latencyMs: expect.any(Number) });
    expect(bodies[0]?.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'Summarize', schema: hint, strict: true } });
  });

  it('omits response_format when there is no schema hint (a plain-text capability) and reports schemaEnforced: false', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'gpt-4o' });

    const result = await strategy.complete({ prompt: 'hi', capability: 'Line' });

    expect(bodies[0]?.response_format).toBeUndefined();
    expect(result.schemaEnforced).toBe(false);
  });

  it('honours the per-call model and falls back to the default model', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'gpt-4o-mini' });

    await strategy.complete({ prompt: 'hi', capability: 'X', model: 'gpt-4o' });
    await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(bodies[0]?.model).toBe('gpt-4o');
    expect(bodies[1]?.model).toBe('gpt-4o-mini');
  });

  it('FAILS LOUD when neither a defaultModel nor a per-call model is configured (no built-in model default)', async () => {
    const { client } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client });

    await expect(strategy.complete({ prompt: 'hi', capability: 'X' })).rejects.toThrow(/no model configured/);
  });

  it('does NOT send the OpenRouter usage-accounting opt-in nor a nested reasoning object', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'gpt-4o' });

    // Reasoning ON with an effort band — the flat `reasoning_effort` path, which is where the nested object would
    // leak if this backend ever forked the OpenRouter mapper. The opt-in `'nested-disabled'` encoding is the ONE
    // arm allowed to send a nested object; it is covered separately below, so this stays scoped to reasoning-ON.
    await strategy.complete({ prompt: 'hi', capability: 'X', reasoning: { effort: 'high' } });

    // No `usage` request field and no nested `reasoning` object anywhere in the serialized body.
    expect(bodies[0]).not.toHaveProperty('usage');
    expect(bodies[0]).not.toHaveProperty('reasoning');
    expect(JSON.stringify(bodies[0])).not.toContain('"usage"');
    expect(JSON.stringify(bodies[0])).not.toContain('"reasoning"');
  });

  it('caps generation length with a default max_tokens (the runaway guard)', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'gpt-4o' });

    await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(bodies[0]?.max_tokens).toBe(DEFAULT_LLM_MAX_OUTPUT_TOKENS);
    expect(bodies[0]).not.toHaveProperty('max_completion_tokens');
  });

  it('emits the cap under max_completion_tokens when tokenLimitParam is configured (and NOT max_tokens)', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'gpt-4o', tokenLimitParam: 'max_completion_tokens' });

    await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(bodies[0]?.max_completion_tokens).toBe(DEFAULT_LLM_MAX_OUTPUT_TOKENS);
    expect(bodies[0]).not.toHaveProperty('max_tokens');
  });

  it('honours a configured maxOutputTokens override and a per-call maxOutputTokens (which wins)', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'gpt-4o', maxOutputTokens: 512 });

    await strategy.complete({ prompt: 'hi', capability: 'X' });
    await strategy.complete({ prompt: 'hi', capability: 'PlaceAndStage', maxOutputTokens: 16_384 });

    expect(bodies[0]?.max_tokens).toBe(512);
    expect(bodies[1]?.max_tokens).toBe(16_384);
  });

  it('maps an effort band onto the flat reasoning_effort, and ENCODES an explicit reasoning-OFF as none', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'gpt-4o' });

    await strategy.complete({ prompt: 'a', capability: 'X', reasoning: { effort: 'low' } });
    // The dispatcher's global OFF floor. Dropping it (the pre-fix behaviour) means "provider default", which on a
    // hybrid-reasoning model is reasoning ON — so the negative is SENT, and an explicit OFF beats a co-present band.
    await strategy.complete({ prompt: 'b', capability: 'X', reasoning: { effort: 'high', enabled: false } });
    await strategy.complete({ prompt: 'c', capability: 'X', reasoning: { maxTokens: 2048 } }); // no effort, not OFF ⇒ omitted
    await strategy.complete({ prompt: 'd', capability: 'X' }); // unconfigured ⇒ omitted (byte-identical body)

    expect(bodies[0]?.reasoning_effort).toBe('low');
    expect(bodies[1]?.reasoning_effort).toBe('none');
    expect(bodies[1]).not.toHaveProperty('reasoning');
    expect(bodies[2]).not.toHaveProperty('reasoning_effort');
    expect(bodies[3]).not.toHaveProperty('reasoning_effort');
    expect(bodies[3]).not.toHaveProperty('reasoning');
  });

  it('encodes reasoning-OFF per the configured reasoningOffEncoding (every arm)', async () => {
    const minimal = makeFakeClient();
    await makeLlmOpenAiStrategy({ client: minimal.client, defaultModel: 'gpt-4o', reasoningOffEncoding: 'effort-minimal' }).complete({ prompt: 'hi', capability: 'X', reasoning: { enabled: false } });
    expect(minimal.bodies[0]?.reasoning_effort).toBe('minimal');

    const nested = makeFakeClient();
    await makeLlmOpenAiStrategy({ client: nested.client, defaultModel: 'gpt-4o', reasoningOffEncoding: 'nested-disabled' }).complete({ prompt: 'hi', capability: 'X', reasoning: { enabled: false } });
    expect(nested.bodies[0]?.reasoning).toEqual({ enabled: false });
    expect(nested.bodies[0]).not.toHaveProperty('reasoning_effort');

    const explicitDefault = makeFakeClient();
    await makeLlmOpenAiStrategy({ client: explicitDefault.client, defaultModel: 'gpt-4o', reasoningOffEncoding: DEFAULT_LLM_REASONING_OFF_ENCODING }).complete({ prompt: 'hi', capability: 'X', reasoning: { enabled: false } });
    expect(explicitDefault.bodies[0]?.reasoning_effort).toBe('none');
  });

  it('encodes reasoning-OFF PER MODEL, with the per-model entry beating the strategy-wide default', async () => {
    // The case this exists for: one gateway, two slugs that disagree. `glm-5.3-free` always thinks and 400s on
    // `'none'`; `deepseek-v4.1-flash` honours it and must KEEP it, or every paid call bills hidden reasoning tokens.
    // A single global encoding cannot hold both facts.
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: DEFAULT_MODEL, reasoningOffByModel: { 'z-ai/glm-5.3-free': 'effort-minimal' } });

    await strategy.complete({ prompt: 'hi', capability: 'X', model: 'z-ai/glm-5.3-free', reasoning: { enabled: false } });
    await strategy.complete({ prompt: 'hi', capability: 'X', reasoning: { enabled: false } });

    expect(bodies[0]?.reasoning_effort).toBe('minimal');
    // The unnamed slug is untouched — it still gets the floor the dispatcher asked for.
    expect(bodies[1]?.reasoning_effort).toBe('none');
  });

  it('a per-model entry beats an explicit strategy-wide reasoningOffEncoding (specificity, not surface)', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'a/b', reasoningOffEncoding: 'omit', reasoningOffByModel: { 'a/b': 'effort-minimal' } });

    await strategy.complete({ prompt: 'hi', capability: 'X', reasoning: { enabled: false } });

    expect(bodies[0]?.reasoning_effort).toBe('minimal');
  });

  it('an EMPTY per-model map leaves the body byte-identical to one built without it', async () => {
    const withMap = makeFakeClient();
    await makeLlmOpenAiStrategy({ client: withMap.client, defaultModel: 'a/b', reasoningOffByModel: {} }).complete({ prompt: 'hi', capability: 'X', reasoning: { enabled: false } });

    const without = makeFakeClient();
    await makeLlmOpenAiStrategy({ client: without.client, defaultModel: 'a/b' }).complete({ prompt: 'hi', capability: 'X', reasoning: { enabled: false } });

    expect(JSON.stringify(withMap.bodies[0])).toBe(JSON.stringify(without.bodies[0]));
  });

  it("the 'omit' escape hatch reproduces the pre-fix body (nothing about reasoning on the wire)", async () => {
    // PINNED so a regression back to the silent default is VISIBLE: this arm is the documented escape hatch for a
    // gateway that 400s on every band, and a run under it is flagged by the ledger's reasoning-floor detector.
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'gpt-4o', reasoningOffEncoding: 'omit' });

    await strategy.complete({ prompt: 'hi', capability: 'X', reasoning: { effort: 'high', enabled: false } });

    expect(bodies[0]).not.toHaveProperty('reasoning_effort');
    expect(bodies[0]).not.toHaveProperty('reasoning');
    expect(JSON.stringify(bodies[0])).not.toContain('reasoning');
  });

  it('ALWAYS sends plain-string messages; no cache_control even when cacheSegments is set', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });

    // Even an Anthropic-slugged model gets a plain string (this backend never sends breakpoint blocks).
    await strategy.complete({ prompt: 'PREFIXSUFFIX', capability: 'X', cacheSegments: { cachePrefix: 'PREFIX', volatileSuffix: 'SUFFIX' } });

    expect(bodies[0]?.messages[0]?.content).toBe('PREFIXSUFFIX');
    expect(JSON.stringify(bodies[0])).not.toContain('cache_control');
  });

  it('replays thread turns as plain string messages (cacheSegments ignored)', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'gpt-4o' });

    await strategy.complete({
      prompt: 'FOLLOW',
      capability: 'X',
      thread: [
        { role: 'user', content: 'PREFIXSUFFIX', cacheSegments: { cachePrefix: 'PREFIX', volatileSuffix: 'SUFFIX' } },
        { role: 'assistant', content: 'REPLY' }
      ]
    });

    expect(bodies[0]?.messages).toEqual([
      { role: 'user', content: 'PREFIXSUFFIX' },
      { role: 'assistant', content: 'REPLY' },
      { role: 'user', content: 'FOLLOW' }
    ]);
    expect(JSON.stringify(bodies[0])).not.toContain('cache_control');
  });

  it('normalizes usage snake_case→camelCase incl. cached + reasoning tokens; omits them when absent', async () => {
    const withDetails = makeFakeClient({ usage: { prompt_tokens: 1000, completion_tokens: 400, total_tokens: 1400, prompt_tokens_details: { cached_tokens: 768 }, completion_tokens_details: { reasoning_tokens: 350 } } });
    const detailedStrategy = makeLlmOpenAiStrategy({ client: withDetails.client, defaultModel: 'gpt-4o' });
    const detailed = await detailedStrategy.complete({ prompt: 'hi', capability: 'X' });

    expect(detailed.usage).toEqual({ promptTokens: 1000, completionTokens: 400, totalTokens: 1400, cachedTokens: 768, reasoningTokens: 350 });

    const plain = makeFakeClient({ usage: { prompt_tokens: 42, completion_tokens: 7, total_tokens: 49 } });
    const plainStrategy = makeLlmOpenAiStrategy({ client: plain.client, defaultModel: 'gpt-4o' });
    const result = await plainStrategy.complete({ prompt: 'hi', capability: 'X' });

    expect(result.usage).toEqual({ promptTokens: 42, completionTokens: 7, totalTokens: 49 });
    expect(result.usage).not.toHaveProperty('cachedTokens');
    expect(result.usage).not.toHaveProperty('reasoningTokens');
  });

  it('reads a volunteered usage.cost / cost_details, and leaves the key ABSENT when the gateway offers none', async () => {
    // An AGGREGATOR gateway that prices the call — the strategy takes the dollar figure it is handed.
    const priced = makeFakeClient({ usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, cost: 0.0001897, cost_details: { upstream_inference_cost: 0.0001897 } } });
    const pricedResult = await makeLlmOpenAiStrategy({ client: priced.client, defaultModel: 'gpt-4o' }).complete({ prompt: 'hi', capability: 'X' });

    expect(pricedResult.usage).toEqual({ promptTokens: 100, completionTokens: 20, totalTokens: 120, cost: 0.0001897, costDetails: { upstreamInferenceCost: 0.0001897 } });

    // A bare OpenAI endpoint prices nothing. The key must stay ABSENT, not default to 0 — the absence is exactly
    // what the ledger's `costPartial` counts, and a manufactured 0 is what made a run read as free.
    const silent = makeFakeClient({ usage: { prompt_tokens: 42, completion_tokens: 7, total_tokens: 49 } });
    const silentResult = await makeLlmOpenAiStrategy({ client: silent.client, defaultModel: 'gpt-4o' }).complete({ prompt: 'hi', capability: 'X' });

    expect(silentResult.usage).not.toHaveProperty('cost');
    expect(silentResult.usage).not.toHaveProperty('costDetails');
  });

  it('folds a STRING usage.cost / upstream_inference_cost to numbers, and drops a non-numeric one', async () => {
    // The gateway behind z-ai/glm-5.3 + xiaomi/mimo-v2.6 sends `"cost":"0.00065716"`. Passed through, every
    // downstream sum concatenated and the turn footer's `cost.toFixed` threw, killing the `:auto` slice.
    const stringly = makeFakeClient({ usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, cost: '0.00065716', cost_details: { upstream_inference_cost: '0.0005' } } });
    const stringlyResult = await makeLlmOpenAiStrategy({ client: stringly.client, defaultModel: 'z-ai/glm-5.3' }).complete({ prompt: 'hi', capability: 'X' });

    expect(stringlyResult.usage).toEqual({ promptTokens: 100, completionTokens: 20, totalTokens: 120, cost: 0.00065716, costDetails: { upstreamInferenceCost: 0.0005 } });
    expect(typeof stringlyResult.usage?.cost).toBe('number');

    // A cost that is not a number is UNKNOWN, not free: the key stays absent rather than becoming a made-up 0.
    const garbled = makeFakeClient({ usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 'n/a', cost_details: { upstream_inference_cost: '' } } });
    const garbledResult = await makeLlmOpenAiStrategy({ client: garbled.client, defaultModel: 'z-ai/glm-5.3' }).complete({ prompt: 'hi', capability: 'X' });

    expect(garbledResult.usage).toEqual({ promptTokens: 1, completionTokens: 1, totalTokens: 2 });
    expect(garbledResult.usage).not.toHaveProperty('cost');
    expect(garbledResult.usage).not.toHaveProperty('costDetails');
  });

  it('stamps the configured cost BASIS on a priced reply, and nothing without one (a list-price gateway)', async () => {
    // A list-price gateway's usage block: the synchronous figure is the LIST amount, not the bill.
    const listPriced = makeFakeClient({ usage: { prompt_tokens: 1245, completion_tokens: 648, total_tokens: 1893, prompt_tokens_details: { cached_tokens: 0 }, cost: '0.00057555' } });
    const listed = await makeLlmOpenAiStrategy({ client: listPriced.client, defaultModel: 'vendor/model-flash', costBasis: 'list' }).complete({ prompt: 'hi', capability: 'X' });

    expect(listed.usage).toEqual({ promptTokens: 1245, completionTokens: 648, totalTokens: 1893, cachedTokens: 0, cost: 0.00057555, costBasis: 'list' });

    // No basis configured ⇒ byte-identical to before the field existed.
    const unstamped = await makeLlmOpenAiStrategy({ client: makeFakeClient({ usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 0.001 } }).client, defaultModel: 'gpt-4o' }).complete({ prompt: 'hi', capability: 'X' });

    expect(unstamped.usage).not.toHaveProperty('costBasis');

    // A basis with no figure describes nothing: an unpriced reply on a list-basis instance carries neither.
    const unpriced = await makeLlmOpenAiStrategy({ client: makeFakeClient({ usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }).client, defaultModel: 'gpt-4o', costBasis: 'list' }).complete({ prompt: 'hi', capability: 'X' });

    expect(unpriced.usage).not.toHaveProperty('cost');
    expect(unpriced.usage).not.toHaveProperty('costBasis');
  });

  it('sends `usage: { include: true }` ONLY under the usageAccounting opt-in (default body is byte-stable)', async () => {
    const off = makeFakeClient();
    await makeLlmOpenAiStrategy({ client: off.client, defaultModel: 'gpt-4o' }).complete({ prompt: 'hi', capability: 'X' });

    // The byte-stability guarantee: a strict OpenAI-compatible gateway never sees this OpenRouter param.
    expect(off.bodies[0]).not.toHaveProperty('usage');

    const on = makeFakeClient();
    await makeLlmOpenAiStrategy({ client: on.client, defaultModel: 'gpt-4o', usageAccounting: true }).complete({ prompt: 'hi', capability: 'X' });

    expect(on.bodies[0]?.usage).toEqual({ include: true });
  });

  it('omits usage entirely when the completion carries none (still captures served model + latency)', async () => {
    const { client } = makeFakeClient({ includeUsage: false });
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'gpt-4o' });

    const result = await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(result).not.toHaveProperty('usage');
    expect(result.model).toBe(DEFAULT_FAKE_MODEL);
    expect(result.latencyMs).toEqual(expect.any(Number));
  });

  it('reports the served model over the sent model, falling back to the sent model when the completion echoes none', async () => {
    const served = makeFakeClient({ model: 'gpt-4o-2024' });
    const servedStrategy = makeLlmOpenAiStrategy({ client: served.client, defaultModel: 'gpt-4o' });
    expect((await servedStrategy.complete({ prompt: 'hi', capability: 'X' })).model).toBe('gpt-4o-2024');

    const echoless = makeFakeClient({ includeModel: false });
    const echolessStrategy = makeLlmOpenAiStrategy({ client: echoless.client, defaultModel: 'gpt-4o-pro' });
    expect((await echolessStrategy.complete({ prompt: 'hi', capability: 'X' })).model).toBe('gpt-4o-pro');
  });

  it('captures the generation id + finish reason, omitting them when the provider echoes none (byte-stable)', async () => {
    const withMeta = makeFakeClient({ id: 'chatcmpl-abc', finishReason: 'stop' });
    const metaStrategy = makeLlmOpenAiStrategy({ client: withMeta.client, defaultModel: 'gpt-4o' });
    const withResult = await metaStrategy.complete({ prompt: 'hi', capability: 'X' });
    expect(withResult.generationId).toBe('chatcmpl-abc');
    expect(withResult.finishReason).toBe('stop');

    const bare = makeFakeClient();
    const bareStrategy = makeLlmOpenAiStrategy({ client: bare.client, defaultModel: 'gpt-4o' });
    const bareResult = await bareStrategy.complete({ prompt: 'hi', capability: 'X' });
    expect(bareResult).not.toHaveProperty('generationId');
    expect(bareResult).not.toHaveProperty('finishReason');
  });

  it('stamps a per-request abort signal + matching timeout that SCALES with the completion budget', async () => {
    const { client, options } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'gpt-4o', timeoutMs: 60_000 });

    await strategy.complete({ prompt: 'small', capability: 'X', maxOutputTokens: 100 });
    await strategy.complete({ prompt: 'big', capability: 'X', maxOutputTokens: 16_384 });

    expect(options[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(options[0]?.timeout).toBe(llmOpenAiCallTimeoutMs(60_000, 100));
    expect(options[1]?.timeout).toBe(llmOpenAiCallTimeoutMs(60_000, 16_384));
    expect(options[1]!.timeout!).toBeGreaterThan(options[0]!.timeout!);
  });

  it('floors the abort window at the default timeout, scaled by the default cap', async () => {
    const { client, options } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'gpt-4o' });

    await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(options[0]?.timeout).toBe(llmOpenAiCallTimeoutMs(DEFAULT_LLM_COMPLETION_TIMEOUT_MS, DEFAULT_LLM_MAX_OUTPUT_TOKENS));
  });

  it('OR-merges an external cancellation signal into the per-request signal', async () => {
    const { client, options } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'gpt-4o' });
    const controller = new AbortController();
    controller.abort();

    await strategy.complete({ prompt: 'hi', capability: 'X' }, { signal: controller.signal });

    expect(options[0]?.signal?.aborted).toBe(true);
  });

  it('declares auto-prefix caching, the openai id, and no warm seam', () => {
    const strategy = makeLlmOpenAiStrategy();
    expect(strategy.id).toBe(LLM_OPENAI_STRATEGY_KIND);
    expect(strategy.caching).toBe('auto-prefix');
    expect(strategy.warm).toBeUndefined();
  });

  describe('healthCheck', () => {
    it('is ready WITHOUT touching an injected client (network-free; create is never called)', async () => {
      const { client, bodies } = makeFakeClient();
      const strategy = makeLlmOpenAiStrategy({ client });

      const health = await strategy.healthCheck?.();

      expect(health).toEqual({ ready: true, issues: [] });
      expect(bodies).toHaveLength(0);
    });

    it('is ready (construct-only, no network) with a dummy apiKey and no injected seam', async () => {
      const strategy = makeLlmOpenAiStrategy({ apiKey: 'dummy-key-no-network' });
      await expect(strategy.healthCheck?.()).resolves.toEqual({ ready: true, issues: [] });
    });
  });

  describe('with no apiKey configured', () => {
    it('fails loud (no network) when no client is injected', async () => {
      const strategy = makeLlmOpenAiStrategy();
      const request: LlmRequest = { prompt: 'hi', capability: 'X' };

      await expect(strategy.complete(request)).rejects.toThrow(/no apiKey configured/);
    });

    it('healthCheck reports not-ready (never throws) with an apiKey error issue', async () => {
      const strategy = makeLlmOpenAiStrategy();

      const health = await strategy.healthCheck?.();

      expect(health?.ready).toBe(false);
      expect(health?.issues).toEqual([{ severity: 'error', message: expect.stringContaining('apiKey') }]);
    });
  });

  describe('credentialProbe', () => {
    it('GETs `{baseUrl}/models` with the credential and reports ready on a 200', async () => {
      const calls: string[] = [];
      const probeFetch: ConfiguredFetch = async (input) => {
        const url = String(input);
        calls.push(url);
        return new Response('{"data":[]}', { status: 200 });
      };
      const strategy = makeLlmOpenAiStrategy({ apiKey: 'sk-live', baseUrl: 'https://zenmux.ai/api/v1', probeFetch });

      await expect(strategy.credentialProbe?.()).resolves.toEqual({ ready: true, issues: [] });
      expect(calls).toEqual(['https://zenmux.ai/api/v1/models']);
    });

    it('reports NOT ready on a rejected credential, carrying the provider message', async () => {
      const probeFetch: ConfiguredFetch = async () => new Response('{"error":{"message":"Invalid API key"}}', { status: 401 });
      const strategy = makeLlmOpenAiStrategy({ apiKey: 'sk-dead', probeFetch });

      const health = await strategy.credentialProbe?.();

      expect(health?.ready).toBe(false);
      expect(health?.issues[0]?.message).toContain('Invalid API key');
    });

    it('delegates to a host-supplied credentialProbeSource instead of GET /models', async () => {
      const calls: string[] = [];
      const probeFetch: ConfiguredFetch = async (input) => {
        const url = String(input);
        calls.push(url);
        return new Response('{}', { status: 200 });
      };
      const strategy = makeLlmOpenAiStrategy({ apiKey: 'sk-dead', baseUrl: 'https://zenmux.ai/api/v1', probeFetch, credentialProbeSource: async () => ({ ready: false, issues: [{ severity: 'error', message: 'zenmux rejected the configured credential' }] }) });

      const health = await strategy.credentialProbe?.();

      expect(health?.ready).toBe(false);
      expect(calls).toEqual([]);
    });

    it('degrades a gateway with no /models endpoint to a READY warning', async () => {
      const probeFetch: ConfiguredFetch = async () => new Response('', { status: 404 });
      const strategy = makeLlmOpenAiStrategy({ apiKey: 'sk-live', probeFetch });

      const health = await strategy.credentialProbe?.();

      expect(health?.ready).toBe(true);
      expect(health?.issues[0]?.severity).toBe('warning');
    });

    it('is ready WITHOUT a socket when a client is injected', async () => {
      const { client } = makeFakeClient();
      const injected = makeLlmOpenAiStrategy({ client });

      await expect(injected.credentialProbe?.()).resolves.toEqual({ ready: true, issues: [] });
    });

    it('delegates to a credentialProbeSource even when a client is injected (B15)', async () => {
      const { client } = makeFakeClient();
      const verdict = { ready: false, issues: [{ severity: 'error' as const, message: 'gateway rejected the configured credential' }] };
      const strategy = makeLlmOpenAiStrategy({ client, credentialProbeSource: async () => verdict });

      await expect(strategy.credentialProbe?.()).resolves.toEqual(verdict);
    });

    it('reports not-ready (never throws) with no apiKey and no seam', async () => {
      const health = await makeLlmOpenAiStrategy().credentialProbe?.();

      expect(health?.ready).toBe(false);
      expect(health?.issues).toEqual([{ severity: 'error', message: expect.stringContaining('apiKey') }]);
    });
  });
});

describe('vision on the wire', () => {
  it('sends inline image content parts ONLY for a slug declared vision-capable', async () => {
    // The per-model fact, on the wire. A vision-marked slug gets `[text, image_url…]`; the SAME request against
    // an unmarked slug keeps the plain-string content — because image parts sent to a text-only model are a 400,
    // and the prompt already carries every image's description (the degrade is lossy, never broken).
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'text/only', visionByModel: { 'sees/things': true } });
    const attachments = [{ kind: 'image' as const, mime: 'image/png', dataBase64: 'QUJD', label: 'xd-0' }];

    await strategy.complete({ prompt: 'look', capability: 'X', model: 'sees/things', attachments });
    await strategy.complete({ prompt: 'look', capability: 'X', attachments });

    expect(bodies[0]?.messages[0].content).toEqual([
      { type: 'text', text: 'look' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } }
    ]);
    expect(bodies[1]?.messages[0].content).toBe('look');
  });

  it('stamps attachmentsSent: the parts that rode, 0 when the slug dropped them, absent on a text call', async () => {
    // The transport's own fact — what a caller reads before trusting a reply about an image.
    const { client } = makeFakeClient();
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: 'text/only', visionByModel: { 'sees/things': true } });
    const attachments = [
      { kind: 'image' as const, mime: 'image/png', dataBase64: 'QUJD', label: 'as-1' },
      { kind: 'image' as const, mime: 'image/png', dataBase64: 'REVG', label: 'as-2' }
    ];

    expect((await strategy.complete({ prompt: 'look', capability: 'X', model: 'sees/things', attachments })).attachmentsSent).toBe(2);
    expect((await strategy.complete({ prompt: 'look', capability: 'X', attachments })).attachmentsSent).toBe(0);
    expect(await strategy.complete({ prompt: 'look', capability: 'X', model: 'sees/things' })).not.toHaveProperty('attachmentsSent');
  });

  it('leaves the body BYTE-IDENTICAL to today when no attachments ride, vision fact or not', async () => {
    const marked = makeFakeClient();
    await makeLlmOpenAiStrategy({ client: marked.client, defaultModel: 'sees/things', visionByModel: { 'sees/things': true } }).complete({ prompt: 'hi', capability: 'X' });

    const plain = makeFakeClient();
    await makeLlmOpenAiStrategy({ client: plain.client, defaultModel: 'sees/things' }).complete({ prompt: 'hi', capability: 'X' });

    expect(JSON.stringify(marked.bodies[0])).toBe(JSON.stringify(plain.bodies[0]));
  });
});
describe('makeLlmOpenAiStrategy() wire shape', () => {
  it('sends the default body keys in order', async () => {
    const { client, bodies } = makeFakeClient();
    await makeLlmOpenAiStrategy({ client, defaultModel: DEFAULT_MODEL }).complete({ prompt: 'hi', capability: 'X' });

    expect(Object.keys(bodies[0] ?? {})).toEqual(['model', 'messages', 'max_tokens']);
  });

  it('sends a fully loaded body keys in order', async () => {
    const { client, bodies } = makeFakeClient();
    await makeLlmOpenAiStrategy({ client, defaultModel: DEFAULT_MODEL, tokenLimitParam: 'max_completion_tokens', usageAccounting: true }).complete({ prompt: 'hi', capability: 'X', reasoning: { effort: 'low' }, responseSchemaHint: { type: 'object' } });

    expect(Object.keys(bodies[0] ?? {})).toEqual(['model', 'messages', 'max_completion_tokens', 'reasoning_effort', 'response_format', 'usage']);
  });

  it('returns a fully echoed result with its keys in order', async () => {
    const { client } = makeFakeClient({ id: 'gen-1', finishReason: 'stop' });
    const strategy = makeLlmOpenAiStrategy({ client, defaultModel: DEFAULT_MODEL, visionByModel: { [DEFAULT_MODEL]: true } });
    const result = await strategy.complete({ prompt: 'hi', capability: 'X', meta: { requestId: 'r-7' }, attachments: [{ kind: 'image', mime: 'image/png', dataBase64: 'QUJD' }] });

    expect(Object.keys(result)).toEqual(['text', 'strategyId', 'strategyKind', 'capability', 'meta', 'schemaEnforced', 'model', 'usage', 'latencyMs', 'generationId', 'finishReason', 'attachmentsSent']);
    expect(result.meta).toEqual({ requestId: 'r-7' });
  });

  it('names the instance id in the no-key and no-model errors', async () => {
    await expect(makeLlmOpenAiStrategy({ id: 'gateway-a', defaultModel: DEFAULT_MODEL }).complete({ prompt: 'hi', capability: 'X' })).rejects.toThrow(/llm openai strategy 'gateway-a': no apiKey configured/);
    await expect(makeLlmOpenAiStrategy({ id: 'gateway-a', client: makeFakeClient().client }).complete({ prompt: 'hi', capability: 'X' })).rejects.toThrow(/llm openai strategy 'gateway-a': no model configured/);
  });

  it('pins describe', () => {
    expect(makeLlmOpenAiStrategy().describe).toBe('Any OpenAI-compatible chat-completions endpoint (bare OpenAI, ZenMux, a self-hosted gateway) over the openai SDK. Enforces the reply schema at generation via response_format (json_schema, strict) when the dispatcher threads one; parsed by the capability.');
  });
});
