import { describe, expect, it } from 'vitest';
import { DEFAULT_LLM_COMPLETION_TIMEOUT_MS, DEFAULT_LLM_MAX_OUTPUT_TOKENS, type LlmCredentialProbeFetch, type LlmRequest } from '@dereekb/llm';
import { llmOpenAiCallTimeoutMs, type LlmOpenAiChatClient, type LlmOpenAiRequestOptions } from '@dereekb/llm/openai';
import { LLM_OPENROUTER_STRATEGY_KIND, makeLlmOpenRouterStrategy } from './openrouter.strategy';

/**
 * The `openrouter` chat strategy — OpenRouter's hooks over the OpenAI-compatible chat base. Proves it (1) reaches an
 * injected client network-free, with the default timeout floor, (2) builds a strict `response_format` from the schema hint named by the capability and omits it
 * when there is none, (3) honours the per-call model + the default-model fallback and fails loud when neither is set,
 * (4) sends `usage: { include: true }` and the max_tokens runaway guard on every call, (5) maps the reasoning config
 * onto the nested `reasoning` param, (6) places the Anthropic `cache_control` breakpoints, (7) echoes the served model,
 * the upstream provider, usage, the generation id and the finish reason, and (8) reports the `healthCheck` /
 * `credentialProbe` verdicts.
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
  readonly reasoning?: unknown;
  readonly usage?: unknown;
}

/**
 * The provider-shaped (snake_case) usage block the fake completion carries — the cost-observability source,
 * incl. the cache-hit (`prompt_tokens_details.cached_tokens`) + cost-detail (`cost_details`) fields.
 */
interface FakeUsage {
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
  readonly total_tokens?: number;
  readonly cost?: number;
  readonly prompt_tokens_details?: { readonly cached_tokens?: number; readonly cache_write_tokens?: number };
  readonly completion_tokens_details?: { readonly reasoning_tokens?: number };
  readonly cost_details?: { readonly upstream_inference_cost?: number };
}

/**
 * The default served model + usage the fake completion returns — a non-Anthropic flash route with token
 * counts + a provider cost, mirroring the live DeepSeek V4 routing.
 */
const DEFAULT_FAKE_MODEL = DEFAULT_MODEL;
const DEFAULT_FAKE_USAGE: FakeUsage = { prompt_tokens: 1200, completion_tokens: 300, total_tokens: 1500, cost: 0.00031 };

/**
 * A fake OpenAI-compatible client that records each request body and returns a canned completion — the
 * network-free seam the strategy unit tests assert the `response_format` / `cache_control` + cost-telemetry
 * wiring through. By default the completion carries a served `model` + token/cost `usage`; pass
 * `includeModel:false` / `includeUsage:false` to exercise the byte-stable omission paths, or `usage` to
 * override the counts (e.g. omit `cost`).
 *
 * @param opts - The canned reply text + served-model / usage overrides.
 * @returns The fake client + the recorded bodies.
 */
function makeFakeClient(opts: { readonly reply?: string; readonly model?: string; readonly provider?: string; readonly usage?: FakeUsage; readonly includeModel?: boolean; readonly includeUsage?: boolean; readonly id?: string; readonly finishReason?: string; readonly nativeFinishReason?: string } = {}): {
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
            choices: [{ message: { content: reply }, ...(opts.finishReason == null ? {} : { finish_reason: opts.finishReason }), ...(opts.nativeFinishReason == null ? {} : { native_finish_reason: opts.nativeFinishReason }) }],
            ...(opts.id == null ? {} : { id: opts.id }),
            ...(includeModel ? { model } : {}),
            ...(opts.provider == null ? {} : { provider: opts.provider }),
            ...(includeUsage ? { usage } : {})
          };
        }
      }
    }
  };
  return { client, bodies, options };
}

describe('makeLlmOpenRouterStrategy()', () => {
  it('builds a strict json_schema response_format from the hint, named by the capability', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });
    const hint = { type: 'object', properties: { ok: { type: 'boolean' } }, additionalProperties: false };

    const result = await strategy.complete({ prompt: 'hi', capability: 'Summarize', responseSchemaHint: hint });

    // The client path sent the strict schema, so schemaEnforced is true (enforcement was REQUESTED); it also
    // read the completion, so the cost-telemetry rides along — the served model, mapped (snake→camel) usage
    // with cost, and a numeric latency.
    expect(result).toEqual({
      text: 'fake-reply',
      strategyId: LLM_OPENROUTER_STRATEGY_KIND,
      strategyKind: LLM_OPENROUTER_STRATEGY_KIND,
      capability: 'Summarize',
      schemaEnforced: true,
      model: DEFAULT_FAKE_MODEL,
      usage: { promptTokens: 1200, completionTokens: 300, totalTokens: 1500, cost: 0.00031 },
      latencyMs: expect.any(Number)
    });
    expect(bodies[0]?.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'Summarize', schema: hint, strict: true } });
  });

  it('omits response_format when there is no schema hint (a plain-text capability) and reports schemaEnforced: false', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });

    const result = await strategy.complete({ prompt: 'hi', capability: 'Line' });

    expect(bodies[0]?.response_format).toBeUndefined();
    // schemaEnforced tracks "was a strict hint sent" — false here (no hint), true on the client+hint path above.
    expect(result.schemaEnforced).toBe(false);
  });

  it('honours the per-call model and falls back to the default model', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });

    await strategy.complete({ prompt: 'hi', capability: 'X', model: 'anthropic/claude-opus-4.8' });
    await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(bodies[0]?.model).toBe('anthropic/claude-opus-4.8');
    expect(bodies[1]?.model).toBe('anthropic/claude-sonnet-4.6');
  });

  it('sends the usage-accounting opt-in on the body so the response carries cost', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });

    await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(bodies[0]?.usage).toEqual({ include: true });
  });

  it('caps generation length with a default max_tokens (the runaway guard)', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });

    await strategy.complete({ prompt: 'hi', capability: 'X' });

    // The default cap rides on every body so a degenerate generation is aborted, not billed to completion.
    // Asserted against the exported constant: the VALUE is a calibration that has moved (4 k ⇒ 8 k) and will
    // move again; what this pins is that a cap is always sent, which is what makes the guard a guard.
    expect(bodies[0]?.max_tokens).toBe(DEFAULT_LLM_MAX_OUTPUT_TOKENS);
  });

  it('honours a configured maxOutputTokens override on the body', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6', maxOutputTokens: 512 });

    await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(bodies[0]?.max_tokens).toBe(512);
  });

  it('a per-call request.maxOutputTokens WINS over the strategy default cap (the per-call budget / retry-raise seam)', async () => {
    // Config caps at 512; the per-call budget (a big staging lever, or a truncation-retry raise) is threaded higher.
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6', maxOutputTokens: 512 });

    await strategy.complete({ prompt: 'hi', capability: 'PlaceAndStage', maxOutputTokens: 16_384 });

    expect(bodies[0]?.max_tokens).toBe(16_384);
  });

  it('sends the reasoning param (renaming maxTokens → max_tokens) ONLY when the request configures one', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });

    await strategy.complete({ prompt: 'hi', capability: 'X', reasoning: { effort: 'high', maxTokens: 2048, exclude: true, enabled: true } });

    // The transport-agnostic LlmReasoningConfig maps onto OpenRouter's `reasoning` param; the only rename is
    // camelCase `maxTokens` → snake_case `max_tokens`, every other field verbatim.
    expect(bodies[0]?.reasoning).toEqual({ effort: 'high', max_tokens: 2048, exclude: true, enabled: true });
  });

  it('sends an OFF config as { enabled: false } alone, dropping every co-present knob (B15)', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });

    await strategy.complete({ prompt: 'hi', capability: 'X', reasoning: { effort: 'high', maxTokens: 512, exclude: true, enabled: false } });

    expect(bodies[0]?.reasoning).toEqual({ enabled: false });
  });

  it('conditionally spreads each reasoning field; an unset knob never lands on the wire', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });

    await strategy.complete({ prompt: 'hi', capability: 'X', reasoning: { effort: 'low' } });

    // Only the configured `effort` rides; no `max_tokens` / `exclude` / `enabled` for an effort-only config.
    expect(bodies[0]?.reasoning).toEqual({ effort: 'low' });
  });

  it('OMITS the reasoning param entirely when the request configures none (the un-reasoned body is byte-identical to before)', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });

    await strategy.complete({ prompt: 'hi', capability: 'X' });

    // Some providers reject an unknown `reasoning` param, so an un-reasoned call must send NONE (byte-stable).
    expect(bodies[0]).not.toHaveProperty('reasoning');
    expect(JSON.stringify(bodies[0])).not.toContain('reasoning');
  });

  it('appends image blocks AFTER the text blocks on an Anthropic route, leaving the cache breakpoint in place', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6', visionByModel: { 'anthropic/claude-sonnet-4.6': true } });

    await strategy.complete({ prompt: 'ABCD', capability: 'ExpandExternalData', cacheSegments: { cachePrefix: 'AB', volatileSuffix: 'CD' }, attachments: [{ kind: 'image', mime: 'image/jpeg', dataBase64: 'QUJD' }] });

    // The PREFIX block keeps its position and its breakpoint — adding a picture must never invalidate the warm
    // prompt cache, which is exactly what putting the image first would do.
    expect(bodies[0]?.messages[0].content).toEqual([
      { type: 'text', text: 'AB', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'CD' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,QUJD' } }
    ]);
  });

  it('ignores attachments for a slug NOT declared vision-capable (byte-identical to the attachment-free body)', async () => {
    const withAttachment = makeFakeClient();
    await makeLlmOpenRouterStrategy({ client: withAttachment.client, defaultModel: 'text/only' }).complete({ prompt: 'hi', capability: 'X', attachments: [{ kind: 'image', mime: 'image/png', dataBase64: 'QUJD' }] });

    const without = makeFakeClient();
    await makeLlmOpenRouterStrategy({ client: without.client, defaultModel: 'text/only' }).complete({ prompt: 'hi', capability: 'X' });

    expect(JSON.stringify(withAttachment.bodies[0])).toBe(JSON.stringify(without.bodies[0]));
  });

  it('stamps attachmentsSent: the parts that rode, 0 when the slug dropped them, absent on a text call', async () => {
    const { client } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'text/only', visionByModel: { 'sees/things': true } });
    const attachments = [{ kind: 'image' as const, mime: 'image/png', dataBase64: 'QUJD' }];

    expect((await strategy.complete({ prompt: 'hi', capability: 'X', model: 'sees/things', attachments })).attachmentsSent).toBe(1);
    expect((await strategy.complete({ prompt: 'hi', capability: 'X', attachments })).attachmentsSent).toBe(0);
    expect(await strategy.complete({ prompt: 'hi', capability: 'X' })).not.toHaveProperty('attachmentsSent');
  });

  it('reports the SERVED model over the sent model (tier attribution)', async () => {
    // Sent: one slug; served (per the completion): a DIFFERENT slug — the result reports what actually served.
    const { client } = makeFakeClient({ model: 'vendor/served-model' });
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'vendor/sent-model' });

    const result = await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(result.model).toBe('vendor/served-model');
    expect(result.latencyMs).toEqual(expect.any(Number));
  });

  it('captures the UPSTREAM provider when the completion echoes one, and omits it otherwise (byte-stable)', async () => {
    // Read-only routing evidence: the slug's endpoints differ on whether they honour `reasoning.enabled: false`,
    // and nothing recorded WHICH one served a call, so the decision to pin an allowlist had no data to stand on.
    // No request-side `provider` param is sent — capturing it must not constrain routing.
    const served = makeFakeClient({ provider: 'DeepInfra' });
    const servedStrategy = makeLlmOpenRouterStrategy({ client: served.client, defaultModel: DEFAULT_MODEL });
    const result = await servedStrategy.complete({ prompt: 'hi', capability: 'X' });

    expect(result.provider).toBe('DeepInfra');
    expect(served.bodies[0]).not.toHaveProperty('provider');

    const bare = makeFakeClient();
    const bareStrategy = makeLlmOpenRouterStrategy({ client: bare.client, defaultModel: DEFAULT_MODEL });
    expect(await bareStrategy.complete({ prompt: 'hi', capability: 'X' })).not.toHaveProperty('provider');
  });

  it('falls back to the SENT model when the completion echoes no model', async () => {
    const { client } = makeFakeClient({ includeModel: false });
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'vendor/model-pro' });

    const result = await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(result.model).toBe('vendor/model-pro');
  });

  it('maps usage snake_case→camelCase and includes cost when the provider returns it', async () => {
    const { client } = makeFakeClient({ usage: { prompt_tokens: 42, completion_tokens: 7, total_tokens: 49, cost: 0.000123 } });
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: DEFAULT_MODEL });

    const result = await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(result.usage).toEqual({ promptTokens: 42, completionTokens: 7, totalTokens: 49, cost: 0.000123 });
  });

  it('omits cost when the provider returns usage without it (degrades gracefully)', async () => {
    const { client } = makeFakeClient({ usage: { prompt_tokens: 42, completion_tokens: 7, total_tokens: 49 } });
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: DEFAULT_MODEL });

    const result = await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(result.usage).toEqual({ promptTokens: 42, completionTokens: 7, totalTokens: 49 });
    expect(result.usage).not.toHaveProperty('cost');
  });

  it('omits usage entirely when the completion carries none', async () => {
    const { client } = makeFakeClient({ includeUsage: false });
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: DEFAULT_MODEL });

    const result = await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(result).not.toHaveProperty('usage');
    // The served model + latency are still captured (only `usage` is absent).
    expect(result.model).toBe(DEFAULT_MODEL);
    expect(result.latencyMs).toEqual(expect.any(Number));
  });

  it('captures cached tokens, cost_details, the generation id, and the finish reason (the cache/echo observability)', async () => {
    const { client } = makeFakeClient({
      id: 'gen-abc123',
      finishReason: 'stop',
      usage: { prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200, cost: 0.0004, prompt_tokens_details: { cached_tokens: 768, cache_write_tokens: 120 }, cost_details: { upstream_inference_cost: 0.00035 } }
    });
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });

    const result = await strategy.complete({ prompt: 'hi', capability: 'Summarize' });

    expect(result.usage).toEqual({ promptTokens: 1000, completionTokens: 200, totalTokens: 1200, cost: 0.0004, cachedTokens: 768, cacheWriteTokens: 120, costDetails: { upstreamInferenceCost: 0.00035 } });
    expect(result.generationId).toBe('gen-abc123');
    expect(result.finishReason).toBe('stop');
  });

  it('falls back to native_finish_reason when the normalized finish_reason is absent', async () => {
    const { client } = makeFakeClient({ nativeFinishReason: 'end_turn' });
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });

    const result = await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(result.finishReason).toBe('end_turn');
  });

  it('omits cachedTokens / costDetails / generationId / finishReason when the provider echoes none (byte-stable)', async () => {
    // The default fake carries usage with cost but NO cache detail, NO id, NO finish reason.
    const { client } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: DEFAULT_MODEL });

    const result = await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(result.usage).toEqual({ promptTokens: 1200, completionTokens: 300, totalTokens: 1500, cost: 0.00031 });
    expect(result.usage).not.toHaveProperty('cachedTokens');
    expect(result.usage).not.toHaveProperty('costDetails');
    expect(result).not.toHaveProperty('generationId');
    expect(result).not.toHaveProperty('finishReason');
  });

  it('normalizes completion_tokens_details.reasoning_tokens → usage.reasoningTokens (the hidden-reasoning cost signal)', async () => {
    const { client } = makeFakeClient({ usage: { prompt_tokens: 100, completion_tokens: 400, total_tokens: 500, completion_tokens_details: { reasoning_tokens: 350 } } });
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: DEFAULT_MODEL });

    const result = await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(result.usage?.reasoningTokens).toBe(350);
  });

  it('omits reasoningTokens when the provider reports none (byte-stable; an un-reasoned call carries no field)', async () => {
    const { client } = makeFakeClient({ usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } });
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: DEFAULT_MODEL });

    const result = await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(result.usage).not.toHaveProperty('reasoningTokens');
  });

  it('stamps a per-request abort signal + matching timeout on every real-client call (the hard-abort wall)', async () => {
    const { client, options } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ defaultModel: DEFAULT_MODEL, client });

    await strategy.complete({ prompt: 'hi', capability: 'X' });

    expect(options.length).toBe(1);
    expect(options[0]?.signal).toBeInstanceOf(AbortSignal);
    // The per-request timeout mirrors the abort window (the default floor scaled by the default cap) so the SDK's
    // client-level timeout floor never fires first.
    expect(options[0]?.timeout).toBe(llmOpenAiCallTimeoutMs(DEFAULT_LLM_COMPLETION_TIMEOUT_MS, DEFAULT_LLM_MAX_OUTPUT_TOKENS));
  });

  it("the abort window SCALES with the call's completion budget (a big-budget lever gets a longer wall)", async () => {
    const { client, options } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ defaultModel: DEFAULT_MODEL, client, timeoutMs: 60_000 });

    // A small default-budget call floors at the base timeout; a 16k-token setup lever scales its window up.
    await strategy.complete({ prompt: 'small', capability: 'X', maxOutputTokens: 100 });
    await strategy.complete({ prompt: 'big', capability: 'X', maxOutputTokens: 16_384 });

    expect(options[0]?.timeout).toBe(llmOpenAiCallTimeoutMs(60_000, 100));
    expect(options[1]?.timeout).toBe(llmOpenAiCallTimeoutMs(60_000, 16_384));
    expect(options[1]!.timeout!).toBeGreaterThan(options[0]!.timeout!);
  });

  it('sends an Anthropic cache_control breakpoint on the stable prefix block', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });

    await strategy.complete({ prompt: 'PREFIXSUFFIX', capability: 'X', cacheSegments: { cachePrefix: 'PREFIX', volatileSuffix: 'SUFFIX' } });

    expect(bodies[0]?.messages[0]?.content).toEqual([
      { type: 'text', text: 'PREFIX', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'SUFFIX' }
    ]);
  });

  it('drops the empty volatile block (only the cached prefix block) when the suffix is empty', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });

    await strategy.complete({ prompt: 'PREFIX', capability: 'X', cacheSegments: { cachePrefix: 'PREFIX', volatileSuffix: '' } });

    expect(bodies[0]?.messages[0]?.content).toEqual([{ type: 'text', text: 'PREFIX', cache_control: { type: 'ephemeral' } }]);
  });

  it('sends a plain prompt string for a non-Anthropic route (implicit auto-prefix caching, no breakpoint)', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'openai/gpt-4o' });

    await strategy.complete({ prompt: 'PREFIXSUFFIX', capability: 'X', cacheSegments: { cachePrefix: 'PREFIX', volatileSuffix: 'SUFFIX' } });

    expect(bodies[0]?.messages[0]?.content).toBe('PREFIXSUFFIX');
  });

  it('sends the plain prompt when no cacheSegments split is provided', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });

    await strategy.complete({ prompt: 'whole-prompt', capability: 'X' });

    expect(bodies[0]?.messages[0]?.content).toBe('whole-prompt');
  });

  it('replays thread turns as Anthropic blocks; the segmented root turn keeps its prefix breakpoint, the last prior turn carries the history breakpoint', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: 'anthropic/claude-sonnet-4.6' });

    await strategy.complete({
      prompt: 'FOLLOW',
      capability: 'X',
      thread: [
        { role: 'user', content: 'PREFIXSUFFIX', cacheSegments: { cachePrefix: 'PREFIX', volatileSuffix: 'SUFFIX' } },
        { role: 'assistant', content: 'REPLY' }
      ]
    });

    expect(bodies[0]?.messages).toEqual([
      // The root turn replays its ORIGINAL block layout byte-identically, so its prefix cache entry still matches.
      {
        role: 'user',
        content: [
          { type: 'text', text: 'PREFIX', cache_control: { type: 'ephemeral' } },
          { type: 'text', text: 'SUFFIX' }
        ]
      },
      // The LAST prior turn carries the second breakpoint — the whole exchanged history is cached for this call.
      { role: 'assistant', content: [{ type: 'text', text: 'REPLY', cache_control: { type: 'ephemeral' } }] },
      // The current follow-up message is the only NEW (uncached) content.
      { role: 'user', content: 'FOLLOW' }
    ]);
  });

  it('replays thread turns as plain string messages on a non-Anthropic route (implicit auto-prefix caching)', async () => {
    const { client, bodies } = makeFakeClient();
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: DEFAULT_MODEL });

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
  });

  it('declares breakpoint caching, the openrouter id, and no warm seam', () => {
    const strategy = makeLlmOpenRouterStrategy();
    expect(strategy.id).toBe(LLM_OPENROUTER_STRATEGY_KIND);
    expect(strategy.caching).toBe('breakpoint');
    expect(strategy.warm).toBeUndefined();
  });

  describe('healthCheck', () => {
    it('is ready WITHOUT touching an injected client (network-free; create is never called)', async () => {
      const { client, bodies } = makeFakeClient();
      const strategy = makeLlmOpenRouterStrategy({ defaultModel: DEFAULT_MODEL, client });

      const health = await strategy.healthCheck?.();

      expect(health).toEqual({ ready: true, issues: [] });
      expect(bodies).toHaveLength(0);
    });

    it('is ready (construct-only, no network) with a dummy apiKey and no injected seam', async () => {
      const strategy = makeLlmOpenRouterStrategy({ apiKey: 'dummy-key-no-network' });

      await expect(strategy.healthCheck?.()).resolves.toEqual({ ready: true, issues: [] });
    });
  });

  describe('with no apiKey configured', () => {
    it('fails loud (no network) when no client is injected', async () => {
      const strategy = makeLlmOpenRouterStrategy();
      const request: LlmRequest = { prompt: 'hi', capability: 'X' };

      await expect(strategy.complete(request)).rejects.toThrow(/no apiKey configured/);
    });

    it('healthCheck reports not-ready (never throws) with an apiKey error issue', async () => {
      const strategy = makeLlmOpenRouterStrategy();

      const health = await strategy.healthCheck?.();

      expect(health?.ready).toBe(false);
      expect(health?.issues).toEqual([{ severity: 'error', message: expect.stringContaining('apiKey') }]);
    });
  });

  describe('credentialProbe', () => {
    it('GETs `{baseUrl}/key` with the credential and reports ready on a 200', async () => {
      const calls: string[] = [];
      const probeFetch: LlmCredentialProbeFetch = async (url) => {
        calls.push(url);
        return { ok: true, status: 200, text: async () => '{"data":{"label":"app"}}' };
      };
      const strategy = makeLlmOpenRouterStrategy({ apiKey: 'sk-or-live', probeFetch });

      await expect(strategy.credentialProbe?.()).resolves.toEqual({ ready: true, issues: [] });
      expect(calls).toEqual(['https://openrouter.ai/api/v1/key']);
    });

    it('reports NOT ready on the revoked-key 401, carrying OpenRouter’s own message', async () => {
      // The exact wire answer the dead key in the dev environment produced. healthCheck cannot see this — it is
      // network-free by contract — which is why every gate downstream of it went green on a revoked credential.
      const probeFetch: LlmCredentialProbeFetch = async () => ({ ok: false, status: 401, text: async () => '{"error":{"message":"User not found.","code":401}}' });
      const strategy = makeLlmOpenRouterStrategy({ apiKey: 'sk-or-dead', probeFetch });

      const health = await strategy.credentialProbe?.();

      expect(health?.ready).toBe(false);
      expect(health?.issues[0]?.severity).toBe('error');
      expect(health?.issues[0]?.message).toContain('User not found.');
    });

    it('is ready WITHOUT a socket when a client is injected', async () => {
      const { client, bodies } = makeFakeClient();
      const injected = makeLlmOpenRouterStrategy({ defaultModel: DEFAULT_MODEL, client });

      await expect(injected.credentialProbe?.()).resolves.toEqual({ ready: true, issues: [] });
      expect(bodies).toHaveLength(0);
    });

    it('grades a 404 from GET /key as an error (OpenRouter always implements it)', async () => {
      const probeFetch: LlmCredentialProbeFetch = async () => ({ ok: false, status: 404, text: async () => '' });
      const health = await makeLlmOpenRouterStrategy({ apiKey: 'sk-or-live', probeFetch }).credentialProbe?.();

      expect(health?.ready).toBe(false);
      expect(health?.issues[0]?.severity).toBe('error');
    });

    it('delegates to a credentialProbeSource even when a client is injected (B15)', async () => {
      const { client } = makeFakeClient();
      const verdict = { ready: false, issues: [{ severity: 'error' as const, message: 'the account rejected the credential' }] };
      const strategy = makeLlmOpenRouterStrategy({ client, credentialProbeSource: async () => verdict });

      await expect(strategy.credentialProbe?.()).resolves.toEqual(verdict);
    });

    it('reports not-ready (never throws) with no apiKey and no seam', async () => {
      const health = await makeLlmOpenRouterStrategy().credentialProbe?.();

      expect(health?.ready).toBe(false);
      expect(health?.issues).toEqual([{ severity: 'error', message: expect.stringContaining('apiKey') }]);
    });
  });
});

describe('makeLlmOpenRouterStrategy() model, wire shape and account facets', () => {
  it('FAILS LOUD when neither a defaultModel nor a per-call model is configured, on the client path', async () => {
    const strategy = makeLlmOpenRouterStrategy({ id: 'router-a', client: makeFakeClient().client });
    await expect(strategy.complete({ prompt: 'hi', capability: 'X' })).rejects.toThrow(/llm openrouter strategy 'router-a': no model configured/);
  });

  it('names the instance id in the no-key error', async () => {
    await expect(makeLlmOpenRouterStrategy({ id: 'router-a', defaultModel: DEFAULT_MODEL }).complete({ prompt: 'hi', capability: 'X' })).rejects.toThrow(/llm openrouter strategy 'router-a': no apiKey configured/);
  });

  it('sends the default body keys in order', async () => {
    const { client, bodies } = makeFakeClient();
    await makeLlmOpenRouterStrategy({ client, defaultModel: DEFAULT_MODEL }).complete({ prompt: 'hi', capability: 'X' });

    expect(Object.keys(bodies[0] ?? {})).toEqual(['model', 'messages', 'max_tokens', 'usage']);
  });

  it('sends a reasoning + schema body keys in order', async () => {
    const { client, bodies } = makeFakeClient();
    await makeLlmOpenRouterStrategy({ client, defaultModel: DEFAULT_MODEL }).complete({ prompt: 'hi', capability: 'X', reasoning: { effort: 'low' }, responseSchemaHint: { type: 'object' } });

    expect(Object.keys(bodies[0] ?? {})).toEqual(['model', 'messages', 'max_tokens', 'reasoning', 'response_format', 'usage']);
  });

  it('returns a fully echoed result with its keys in order', async () => {
    const { client } = makeFakeClient({ provider: 'DeepInfra', id: 'gen-1', finishReason: 'stop' });
    const strategy = makeLlmOpenRouterStrategy({ client, defaultModel: DEFAULT_MODEL, visionByModel: { [DEFAULT_MODEL]: true } });
    const result = await strategy.complete({ prompt: 'hi', capability: 'X', meta: { requestId: 'r-7' }, attachments: [{ kind: 'image', mime: 'image/png', dataBase64: 'QUJD' }] });

    expect(Object.keys(result)).toEqual(['text', 'strategyId', 'strategyKind', 'capability', 'meta', 'schemaEnforced', 'model', 'provider', 'usage', 'latencyMs', 'generationId', 'finishReason', 'attachmentsSent']);
  });

  it('stamps the configured cost basis on a priced reply, and nothing without one', async () => {
    const listed = await makeLlmOpenRouterStrategy({ client: makeFakeClient().client, defaultModel: DEFAULT_MODEL, costBasis: 'list' }).complete({ prompt: 'hi', capability: 'X' });
    const unstamped = await makeLlmOpenRouterStrategy({ client: makeFakeClient().client, defaultModel: DEFAULT_MODEL }).complete({ prompt: 'hi', capability: 'X' });
    const unpriced = await makeLlmOpenRouterStrategy({ client: makeFakeClient({ usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }).client, defaultModel: DEFAULT_MODEL, costBasis: 'list' }).complete({ prompt: 'hi', capability: 'X' });

    expect(listed.usage).toMatchObject({ cost: 0.00031, costBasis: 'list' });
    expect(unstamped.usage).not.toHaveProperty('costBasis');
    expect(unpriced.usage).not.toHaveProperty('costBasis');
  });

  it('exposes providerStatus / providerStatusId only with a source', async () => {
    const source = { providerId: 'router-account', read: async () => ({ providerId: 'router-account', available: true, windows: [], issues: [] }) };
    const metered = makeLlmOpenRouterStrategy({ client: makeFakeClient().client, providerStatusSource: source });
    const unmetered = makeLlmOpenRouterStrategy({ client: makeFakeClient().client });

    expect(metered.providerStatusId).toBe('router-account');
    await expect(metered.providerStatus?.()).resolves.toMatchObject({ providerId: 'router-account', available: true });
    expect(unmetered).not.toHaveProperty('providerStatus');
    expect(unmetered).not.toHaveProperty('providerStatusId');
  });

  it('delegates to a credentialProbeSource instead of GET /key', async () => {
    const calls: string[] = [];
    const probeFetch: LlmCredentialProbeFetch = async (url) => {
      calls.push(url);
      return { ok: true, status: 200, text: async () => '{}' };
    };
    const strategy = makeLlmOpenRouterStrategy({ apiKey: 'sk-or', probeFetch, credentialProbeSource: async () => ({ ready: false, issues: [{ severity: 'error', message: 'the account rejected the credential' }] }) });

    await expect(strategy.credentialProbe?.()).resolves.toEqual({ ready: false, issues: [{ severity: 'error', message: 'the account rejected the credential' }] });
    expect(calls).toEqual([]);
  });

  it('pins describe', () => {
    expect(makeLlmOpenRouterStrategy().describe).toBe("Any model over OpenRouter's OpenAI-compatible API, routed by the request's model id. Enforces the reply schema at generation via response_format (json_schema, strict) when the dispatcher threads one; parsed by the capability.");
  });
});
