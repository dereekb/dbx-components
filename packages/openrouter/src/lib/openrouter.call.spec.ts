import { describe, expect, it } from 'vitest';
import { OPENROUTER_NON_REQUEST_CONFIG_KEYS, openRouterCallModelInput, openRouterCallResultFromResponse, parseOpenRouterJsonOutput, splitOpenRouterModelConfig } from './openrouter.call';
import { type OpenResponsesResult } from './openrouter.sdk';

describe('splitOpenRouterModelConfig()', () => {
  it('should keep execution controls off the request body', () => {
    // Forwarding an unknown key risks a 400 on the whole call, not a silent ignore.
    const split = splitOpenRouterModelConfig({ model: 'm', maxSteps: 4, requestTimeoutMs: 1000 });
    expect(split.requestConfig).toEqual({ model: 'm' });
    expect(split.maxSteps).toBe(4);
    expect(split.requestTimeoutMs).toBe(1000);
    expect(OPENROUTER_NON_REQUEST_CONFIG_KEYS).toContain('maxSteps');
  });

  it('should drop undefined values', () => {
    expect(splitOpenRouterModelConfig({ model: 'm', temperature: undefined }).requestConfig).toEqual({ model: 'm' });
  });

  it('should keep an explicit null, which is how a caller clears a value', () => {
    expect(splitOpenRouterModelConfig({ model: 'm', stop: null }).requestConfig).toEqual({ model: 'm', stop: null });
  });

  it('should handle a null config', () => {
    expect(splitOpenRouterModelConfig(null).requestConfig).toEqual({});
  });
});

describe('openRouterCallModelInput()', () => {
  it('should spread the request config and set the input', () => {
    const input = openRouterCallModelInput({ request: { config: { model: 'm', temperature: 0.5 }, input: [{ role: 'user', content: 'hi' }], instructions: 'sys' } }) as Record<string, unknown>;
    expect(input.model).toBe('m');
    expect(input.temperature).toBe(0.5);
    expect(input.instructions).toBe('sys');
    expect(Array.isArray(input.input)).toBe(true);
  });

  it('should translate maxSteps into a stop condition rather than a request param', () => {
    const input = openRouterCallModelInput({ request: { config: { model: 'm', maxSteps: 2 }, input: [] } }) as Record<string, unknown>;
    expect(input.maxSteps).toBeUndefined();
    expect(typeof input.stopWhen).toBe('function');
  });

  it('should carry the trace as additionalProperties so it lands as span attributes', () => {
    const input = openRouterCallModelInput({ request: { config: { model: 'm' }, input: [], trace: { runTaskKey: 'rt_1' } } }) as { trace: { additionalProperties: Record<string, unknown> } };
    expect(input.trace.additionalProperties.runTaskKey).toBe('rt_1');
  });

  it('should omit tools and state when none are given', () => {
    const input = openRouterCallModelInput({ request: { config: { model: 'm' }, input: [] } }) as Record<string, unknown>;
    expect('tools' in input).toBe(false);
    expect('state' in input).toBe(false);
  });
});

describe('parseOpenRouterJsonOutput()', () => {
  it('should parse a JSON object', () => {
    expect(parseOpenRouterJsonOutput('{"a":1}')).toEqual({ a: 1 });
  });

  it('should return undefined for prose', () => {
    // A model asked for text returns prose; that is not an error.
    expect(parseOpenRouterJsonOutput('Hello there.')).toBeUndefined();
  });

  it('should return undefined for a JSON array', () => {
    expect(parseOpenRouterJsonOutput('[1,2]')).toBeUndefined();
  });

  it('should return undefined for empty or missing output', () => {
    expect(parseOpenRouterJsonOutput('')).toBeUndefined();
    expect(parseOpenRouterJsonOutput(null)).toBeUndefined();
  });
});

describe('openRouterCallResultFromResponse()', () => {
  function responseWith(overrides: Partial<OpenResponsesResult>): OpenResponsesResult {
    return { id: 'gen_1', model: 'openai/gpt-5.1', outputText: 'text', error: null, ...overrides } as OpenResponsesResult;
  }

  it('should normalize output, generation id, and model', () => {
    const result = openRouterCallResultFromResponse(responseWith({}));
    expect(result.outputText).toBe('text');
    expect(result.generationIds).toEqual(['gen_1']);
    expect(result.model).toBe('openai/gpt-5.1');
    expect(result.error).toBeUndefined();
  });

  it('should flatten usage including nested token details', () => {
    const result = openRouterCallResultFromResponse(
      responseWith({
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
          cost: 0.02,
          isByok: true,
          inputTokensDetails: { cachedTokens: 4 },
          outputTokensDetails: { reasoningTokens: 3 }
        }
      } as unknown as Partial<OpenResponsesResult>)
    );

    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15, reasoningTokens: 3, cachedTokens: 4, cost: 0.02, isByok: true });
  });

  it('should surface a response-level error', () => {
    const result = openRouterCallResultFromResponse(responseWith({ error: { code: 500, message: 'upstream failed' } } as unknown as Partial<OpenResponsesResult>));
    expect(result.error).toEqual({ code: '500', message: 'upstream failed' });
  });

  it('should parse json output when the response is JSON', () => {
    expect(openRouterCallResultFromResponse(responseWith({ outputText: '{"fields":[]}' })).outputJson).toEqual({ fields: [] });
  });
});
