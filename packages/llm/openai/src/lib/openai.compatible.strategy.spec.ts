import { describe, expect, it } from 'vitest';
import { type ConfiguredFetch } from '@dereekb/util/fetch';
import { DEFAULT_LLM_COMPLETION_TIMEOUT_MS, DEFAULT_LLM_MAX_OUTPUT_TOKENS, makeLlmDispatcher, makeLlmStrategyRegistry, probeLlmCredentialEndpoint, makeLlmTieredPromptTemplateResolver, resolveLlmCompletionCallTimeoutMs, type LlmReasoningConfig } from '@dereekb/llm';
import { makeLlmOpenAiChatClientFake } from '@dereekb/llm/test';
import { type LlmOpenAiChatCompletion, type LlmOpenAiChatCompletionBody } from './openai.chat';
import { makeLlmOpenAiCompatibleChatStrategy, type LlmOpenAiCompatibleCallParams, type LlmOpenAiCompatibleChatStrategyConfig, type LlmOpenAiCompatibleChatStrategyHooks } from './openai.compatible.strategy';

/**
 * The OpenAI-compatible chat base, driven through a minimal `'acme'` transport: identity and defaults, hook wiring and
 * key order, completion extras, the credential-probe ladder (one case per row) and health. The two stock transports'
 * own specs cover their hooks.
 */

const ACME_MODEL = 'acme/model';
const ACME_BASE_URL = 'https://acme.example/v1';

/**
 * The `'acme'` hooks fixture; each case overrides what it exercises.
 *
 * @param overrides - Hook overrides.
 * @returns The hooks.
 */
function acmeHooks(overrides: Partial<LlmOpenAiCompatibleChatStrategyHooks> = {}): LlmOpenAiCompatibleChatStrategyHooks {
  return { kind: 'acme', describe: 'Acme chat.', caching: 'auto-prefix', defaultBaseUrl: ACME_BASE_URL, credentialProbe: (params) => probeLlmCredentialEndpoint({ ...params, url: `${params.baseUrl}/models` }), reasoningParams: () => ({}), ...overrides };
}

function acme(config: LlmOpenAiCompatibleChatStrategyConfig = {}, overrides: Partial<LlmOpenAiCompatibleChatStrategyHooks> = {}) {
  return makeLlmOpenAiCompatibleChatStrategy(config, acmeHooks(overrides));
}

const IMAGE = { kind: 'image' as const, mime: 'image/png', dataBase64: 'QUJD' };

describe('makeLlmOpenAiCompatibleChatStrategy()', () => {
  describe('identity and defaults', () => {
    it('takes kind / describe / caching from the hooks and defaults the id to the kind', () => {
      const strategy = acme();

      expect(strategy.id).toBe('acme');
      expect(strategy.kind).toBe('acme');
      expect(strategy.describe).toBe('Acme chat.');
      expect(strategy.caching).toBe('auto-prefix');
      expect(acme({ id: 'acme-b' }).id).toBe('acme-b');
    });

    it('defaults the base URL to the hooks (the generic probe URL proves it)', async () => {
      const urls: string[] = [];
      const probeFetch: ConfiguredFetch = async (input) => {
        const url = String(input);
        urls.push(url);
        return new Response('{}', { status: 200 });
      };

      await acme({ apiKey: 'k', probeFetch }).credentialProbe?.();

      expect(urls).toEqual([`${ACME_BASE_URL}/models`]);
    });

    it('pins the core defaults and sends them when nothing is configured', async () => {
      const { client, bodies, options } = makeLlmOpenAiChatClientFake<LlmOpenAiChatCompletionBody>({ reply: 'ok' });

      await acme({ client, defaultModel: ACME_MODEL }).complete({ prompt: 'hi', capability: 'X' });

      expect(DEFAULT_LLM_MAX_OUTPUT_TOKENS).toBe(8_192);
      expect(DEFAULT_LLM_COMPLETION_TIMEOUT_MS).toBe(60_000);
      expect(bodies[0]?.max_tokens).toBe(DEFAULT_LLM_MAX_OUTPUT_TOKENS);
      expect(options[0]?.timeout).toBe(resolveLlmCompletionCallTimeoutMs({ timeoutMs: DEFAULT_LLM_COMPLETION_TIMEOUT_MS, maxOutputTokens: DEFAULT_LLM_MAX_OUTPUT_TOKENS }));
    });
  });

  describe('hook wiring', () => {
    it('hands messages the vision-filtered attachments and stamps attachmentsSent', async () => {
      const seen: Array<ReadonlyArray<unknown>> = [];
      const { client } = makeLlmOpenAiChatClientFake<LlmOpenAiChatCompletionBody>({ reply: 'ok' });
      const strategy = acme(
        { client, defaultModel: ACME_MODEL, visionByModel: { 'acme/eyes': true } },
        {
          messages: (params) => {
            seen.push(params.attachments);
            return [{ role: 'user', content: params.request.prompt }];
          }
        }
      );

      const blind = await strategy.complete({ prompt: 'hi', capability: 'X', attachments: [IMAGE] });
      const sighted = await strategy.complete({ prompt: 'hi', capability: 'X', model: 'acme/eyes', attachments: [IMAGE] });
      const text = await strategy.complete({ prompt: 'hi', capability: 'X' });

      expect(seen).toEqual([[], [IMAGE], []]);
      expect(blind.attachmentsSent).toBe(0);
      expect(sighted.attachmentsSent).toBe(1);
      expect(text).not.toHaveProperty('attachmentsSent');
    });

    it('hands reasoningParams the normalized reasoning config', async () => {
      const seen: Array<LlmOpenAiCompatibleCallParams['reasoning']> = [];
      const { client } = makeLlmOpenAiChatClientFake<LlmOpenAiChatCompletionBody>({ reply: 'ok' });
      const strategy = acme(
        { client, defaultModel: ACME_MODEL },
        {
          reasoningParams: ({ reasoning }) => {
            seen.push(reasoning);
            return {};
          }
        }
      );
      const effort: LlmReasoningConfig = { effort: 'low' };

      await strategy.complete({ prompt: 'hi', capability: 'X', reasoning: { effort: 'high', maxTokens: 9, enabled: false } });
      await strategy.complete({ prompt: 'hi', capability: 'X', reasoning: effort });
      await strategy.complete({ prompt: 'hi', capability: 'X' });

      expect(seen[0]).toEqual({ enabled: false });
      expect(seen[1]).toBe(effort);
      expect(seen[2]).toBeUndefined();
    });

    it('appends bodyExtras after response_format, in the unified key order', async () => {
      const { client, bodies } = makeLlmOpenAiChatClientFake<LlmOpenAiChatCompletionBody>({ reply: 'ok' });
      const strategy = acme({ client, defaultModel: ACME_MODEL }, { reasoningParams: () => ({ reasoning_effort: 'low' }), bodyExtras: () => ({ usage: { include: true } }) });

      await strategy.complete({ prompt: 'hi', capability: 'X', responseSchemaHint: { type: 'object' } });

      expect(Object.keys(bodies[0] ?? {})).toEqual(['model', 'messages', 'max_tokens', 'reasoning_effort', 'response_format', 'usage']);
    });

    it('moves the cap under max_completion_tokens when the hooks say so', async () => {
      const { client, bodies } = makeLlmOpenAiChatClientFake<LlmOpenAiChatCompletionBody>({ reply: 'ok' });

      await acme({ client, defaultModel: ACME_MODEL, maxOutputTokens: 300 }, { tokenLimitParam: 'max_completion_tokens' }).complete({ prompt: 'hi', capability: 'X' });

      expect(bodies[0]?.max_completion_tokens).toBe(300);
      expect(bodies[0]).not.toHaveProperty('max_tokens');
    });

    it('falls back to the plain message builder when the hooks name none', async () => {
      const { client, bodies } = makeLlmOpenAiChatClientFake<LlmOpenAiChatCompletionBody>({ reply: 'ok' });

      await acme({ client, defaultModel: ACME_MODEL }).complete({ prompt: 'now', capability: 'X', thread: [{ role: 'user', content: 'then' }] });

      expect(bodies[0]?.messages).toEqual([
        { role: 'user', content: 'then' },
        { role: 'user', content: 'now' }
      ]);
    });
  });

  describe('completion extras', () => {
    const echoed: LlmOpenAiChatCompletion = { id: 'gen-1', model: 'acme/served', provider: 'Upstream', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }, choices: [{ message: { content: 'ok' }, native_finish_reason: 'end_turn' }] };
    const extras: Partial<LlmOpenAiCompatibleChatStrategyHooks> = { completionExtras: (completion) => ({ provider: completion.provider, fallbackFinishReason: completion.choices[0]?.native_finish_reason }) };

    it('places provider between model and usage, and uses the fallback finish reason only when finish_reason is absent', async () => {
      const result = await acme({ client: makeLlmOpenAiChatClientFake({ completion: echoed }).client, defaultModel: ACME_MODEL }, extras).complete({ prompt: 'hi', capability: 'X' });

      expect(Object.keys(result)).toEqual(['text', 'strategyId', 'strategyKind', 'capability', 'schemaEnforced', 'model', 'provider', 'usage', 'latencyMs', 'generationId', 'finishReason']);
      expect(result.provider).toBe('Upstream');
      expect(result.finishReason).toBe('end_turn');

      const normalized = await acme({ client: makeLlmOpenAiChatClientFake({ completion: { ...echoed, choices: [{ message: { content: 'ok' }, finish_reason: 'stop', native_finish_reason: 'end_turn' }] } }).client, defaultModel: ACME_MODEL }, extras).complete({ prompt: 'hi', capability: 'X' });
      expect(normalized.finishReason).toBe('stop');
    });

    it('reads no provider without an extras hook', async () => {
      const result = await acme({ client: makeLlmOpenAiChatClientFake({ completion: echoed }).client, defaultModel: ACME_MODEL }).complete({ prompt: 'hi', capability: 'X' });

      expect(result).not.toHaveProperty('provider');
      expect(result).not.toHaveProperty('finishReason');
    });
  });

  describe('credentialProbe ladder', () => {
    const verdict = { ready: false, issues: [{ severity: 'error' as const, message: 'acme rejected the credential' }] };

    it('row 1: no key and no client is an error, and the source is never called', async () => {
      let called = false;
      const health = await acme({
        credentialProbeSource: async () => {
          called = true;
          return verdict;
        }
      }).credentialProbe?.();

      expect(health).toEqual({ ready: false, issues: [{ severity: 'error', message: 'no apiKey configured and no client injected' }] });
      expect(called).toBe(false);
    });

    it('row 2: a credentialProbeSource is delegated to, even with an injected client', async () => {
      await expect(acme({ client: makeLlmOpenAiChatClientFake<LlmOpenAiChatCompletionBody>({ reply: 'ok' }).client, credentialProbeSource: async () => verdict }).credentialProbe?.()).resolves.toEqual(verdict);
      await expect(acme({ apiKey: 'k', credentialProbeSource: async () => verdict }).credentialProbe?.()).resolves.toEqual(verdict);
    });

    it('row 3: an injected client without probeFetch is ready with no socket', async () => {
      const { client, bodies } = makeLlmOpenAiChatClientFake<LlmOpenAiChatCompletionBody>({ reply: 'ok' });
      const health = await acme({ client }).credentialProbe?.();

      expect(health).toEqual({ ready: true, issues: [] });
      expect(bodies).toEqual([]);
    });

    it('row 4: an injected client with probeFetch but no key is an error, with no socket', async () => {
      const urls: string[] = [];
      const probeFetch: ConfiguredFetch = async (input) => {
        const url = String(input);
        urls.push(url);
        return new Response('{}', { status: 200 });
      };
      const health = await acme({ client: makeLlmOpenAiChatClientFake<LlmOpenAiChatCompletionBody>({ reply: 'ok' }).client, probeFetch }).credentialProbe?.();

      expect(health).toEqual({ ready: false, issues: [{ severity: 'error', message: 'no apiKey configured for the credential probe' }] });
      expect(urls).toEqual([]);
    });

    it('row 5: the generic probe GETs {baseUrl}{path} and grades a 404 by notFoundSeverity', async () => {
      const urls: string[] = [];
      const probeFetch: ConfiguredFetch = async (input) => {
        const url = String(input);
        urls.push(url);
        return new Response('', { status: 404 });
      };

      const lenient = await acme({ apiKey: 'k', baseUrl: 'https://gw.example/v1/', probeFetch }, { credentialProbe: (params) => probeLlmCredentialEndpoint({ ...params, url: `${params.baseUrl}/key`, notFoundSeverity: 'warning' }) }).credentialProbe?.();
      const strict = await acme({ apiKey: 'k', probeFetch }, { credentialProbe: (params) => probeLlmCredentialEndpoint({ ...params, url: `${params.baseUrl}/key` }) }).credentialProbe?.();

      expect(urls).toEqual(['https://gw.example/v1/key', `${ACME_BASE_URL}/key`]);
      expect(lenient?.ready).toBe(true);
      expect(lenient?.issues[0]?.severity).toBe('warning');
      expect(strict?.ready).toBe(false);
      expect(strict?.issues[0]?.severity).toBe('error');
    });
  });

  describe('healthCheck', () => {
    it('is ready with an injected client and not ready with no key', async () => {
      await expect(acme({ client: makeLlmOpenAiChatClientFake<LlmOpenAiChatCompletionBody>({ reply: 'ok' }).client }).healthCheck?.()).resolves.toEqual({ ready: true, issues: [] });
      await expect(acme().healthCheck?.()).resolves.toEqual({ ready: false, issues: [{ severity: 'error', message: 'no apiKey configured and no client injected' }] });
    });

    it('prefixes the call-time errors with the kind and instance id', async () => {
      await expect(acme({ id: 'acme-b', defaultModel: ACME_MODEL }).complete({ prompt: 'hi', capability: 'X' })).rejects.toThrow(/^llm acme strategy 'acme-b': no apiKey configured and no client injected/);
      await expect(acme({ id: 'acme-b', client: makeLlmOpenAiChatClientFake<LlmOpenAiChatCompletionBody>({ reply: 'ok' }).client }).complete({ prompt: 'hi', capability: 'X' })).rejects.toThrow(/^llm acme strategy 'acme-b': no model configured/);
    });
  });
});

describe('makeLlmDispatcher() over makeLlmOpenAiCompatibleChatStrategy()', () => {
  it('serves a default-tier call with no defaultModel, sending the resolved slug and the dispatcher cap', async () => {
    const { client, bodies } = makeLlmOpenAiChatClientFake<LlmOpenAiChatCompletionBody>({ reply: 'ok' });
    const dispatcher = makeLlmDispatcher({
      strategies: makeLlmStrategyRegistry([acme({ client })]),
      defaultStrategyId: 'acme',
      defaultMaxOutputTokens: 1024,
      modelTiers: { fast: 'acme/fast', strong: 'acme/strong' },
      descriptorOf: () => undefined,
      templateResolver: makeLlmTieredPromptTemplateResolver({ tiers: [{ source: 'defaults', templates: [{ key: 'instructions', role: 'instructions', text: 'Answer.' }] }] })
    });
    const result = await dispatcher.dispatch({ capability: 'X', renderLiveContext: () => [] });

    expect(result.text).toBe('ok');
    expect(bodies[0]?.model).toBe('acme/fast');
    expect(bodies[0]?.max_tokens).toBe(1024);
  });
});
