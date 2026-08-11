import { describe, expect, it } from 'vitest';
import { OPENROUTER_NON_REQUEST_CONFIG_KEYS, openRouterCallModelInput, openRouterCallResultFromResponse, openRouterHostedTools, openRouterResponsesRequestBody, parseOpenRouterJsonOutput, splitOpenRouterModelConfig } from './openrouter.call';
import { openRouterFileSearchTool } from './openrouter.config';
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

  it('should strip hosted tools, which callModel would convert as client function tools', () => {
    // Hosted entries are re-attached after conversion by openRouterModelResultForRequest. Leaving one
    // here is what throws `Cannot read properties of undefined` from inside the SDK at dispatch.
    const input = openRouterCallModelInput({ request: { config: { model: 'm', tools: [openRouterFileSearchTool(['vs_1'])] }, input: [] } }) as Record<string, unknown>;
    expect('tools' in input).toBe(false);
  });

  it('should omit tools and state when none are given', () => {
    const input = openRouterCallModelInput({ request: { config: { model: 'm' }, input: [] } }) as Record<string, unknown>;
    expect('tools' in input).toBe(false);
    expect('state' in input).toBe(false);
  });
});

describe('openRouterHostedTools()', () => {
  it('should return the hosted tool entries a config carries', () => {
    expect(openRouterHostedTools({ model: 'm', tools: [openRouterFileSearchTool(['vs_1'])] })).toEqual([{ type: 'file_search', vectorStoreIds: ['vs_1'] }]);
  });

  it('should return an empty array for a config with no tools', () => {
    expect(openRouterHostedTools({ model: 'm' })).toEqual([]);
    expect(openRouterHostedTools(null)).toEqual([]);
  });
});

describe('openRouterResponsesRequestBody()', () => {
  it('should keep hosted tools on the body, which is the whole point of the direct path', () => {
    // `vectorStoreIds` / `maxNumResults` are the SDK's names; it remaps them to `vector_store_ids` /
    // `max_num_results` during outbound serialization.
    const body = openRouterResponsesRequestBody({ config: { model: 'm', tools: [openRouterFileSearchTool(['vs_1'], 5)], include: ['file_search_call.results'] }, input: [] });
    expect(body.tools).toEqual([{ type: 'file_search', vectorStoreIds: ['vs_1'], maxNumResults: 5 }]);
    expect(body.include).toEqual(['file_search_call.results']);
  });

  it('should carry instructions and the trace, and keep execution controls off the body', () => {
    const body = openRouterResponsesRequestBody({ config: { model: 'm', maxSteps: 3, requestTimeoutMs: 10 }, instructions: 'sys', input: [], trace: { runTaskKey: 'rt_1' } });
    expect(body.instructions).toBe('sys');
    expect(body.trace).toEqual({ additionalProperties: { runTaskKey: 'rt_1' } });
    expect('maxSteps' in body).toBe(false);
    expect('requestTimeoutMs' in body).toBe(false);
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

  it('should read the text out of the message item, since OpenRouter sends no output_text', () => {
    // Verified live on both a streaming and a non-streaming request: the body carries `output`
    // (`reasoning`, then `message`) and NO `output_text`. Reading only that field stores an empty result
    // for every real call — on inference that answered fine and was charged for.
    const response = responseWith({
      outputText: undefined,
      output: [
        { type: 'reasoning', summary: [] },
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'OK' }] }
      ]
    } as unknown as Partial<OpenResponsesResult>);

    expect(openRouterCallResultFromResponse(response).outputText).toBe('OK');
  });

  it('should concatenate text across every message item', () => {
    const response = responseWith({
      outputText: undefined,
      output: [
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'one ' }] },
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'two' }] }
      ]
    } as unknown as Partial<OpenResponsesResult>);

    expect(openRouterCallResultFromResponse(response).outputText).toBe('one two');
  });

  it('should return no text for a response carrying only tool calls', () => {
    const response = responseWith({ outputText: undefined, output: [{ type: 'function_call', call_id: 'c1', name: 'x', arguments: '{}' }] } as unknown as Partial<OpenResponsesResult>);
    expect(openRouterCallResultFromResponse(response).outputText).toBeUndefined();
  });
});
