import { describe, it, expect } from 'vitest';
import { type Request } from 'express';
import { openRouterAttributeMap, openRouterBroadcastSpansFromPayload, openRouterGenerationInfoFromAttributes, readOpenRouterAnyValue, type OpenRouterBroadcastPayload, type OpenRouterBroadcastSpan } from './webhook.openrouter';
import { OpenRouterWebhookService } from './webhook.openrouter.service';
import { type OpenRouterWebhookServiceConfig } from './webhook.openrouter.config';

const SECRET = 'broadcast-secret-token';

function buildPayload(attributes: { key: string; value: Record<string, unknown> }[], spanName = 'chat'): OpenRouterBroadcastPayload {
  return {
    resourceSpans: [
      {
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'openrouter' } }] },
        scopeSpans: [
          {
            scope: { name: 'openrouter', version: '1.0.0' },
            spans: [
              {
                traceId: 'trace-1',
                spanId: 'span-1',
                name: spanName,
                startTimeUnixNano: '1',
                endTimeUnixNano: '2',
                attributes
              }
            ]
          }
        ]
      }
    ]
  };
}

const GENERATION_ATTRIBUTES = [
  { key: 'gen_ai.request.model', value: { stringValue: 'openai/gpt-4o' } },
  { key: 'gen_ai.provider.name', value: { stringValue: 'openai' } },
  { key: 'gen_ai.usage.prompt_tokens', value: { intValue: '123' } },
  { key: 'gen_ai.usage.completion_tokens', value: { intValue: '45' } },
  { key: 'gen_ai.usage.total_tokens', value: { intValue: '168' } },
  { key: 'gen_ai.usage.cost', value: { doubleValue: 0.00042 } },
  { key: 'gen_ai.response.id', value: { stringValue: 'gen-xyz' } }
];

function buildService(): OpenRouterWebhookService {
  const config: OpenRouterWebhookServiceConfig = { openrouterWebhook: { webhookSecret: SECRET } };
  return new OpenRouterWebhookService(config);
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

describe('readOpenRouterAnyValue()', () => {
  it('reads a string value', () => {
    expect(readOpenRouterAnyValue({ stringValue: 'hello' })).toBe('hello');
  });

  it('parses an integer value encoded as a string', () => {
    expect(readOpenRouterAnyValue({ intValue: '168' })).toBe(168);
  });

  it('reads an integer value already encoded as a number', () => {
    expect(readOpenRouterAnyValue({ intValue: 7 })).toBe(7);
  });

  it('reads a double value', () => {
    expect(readOpenRouterAnyValue({ doubleValue: 0.5 })).toBe(0.5);
  });

  it('reads a boolean value', () => {
    expect(readOpenRouterAnyValue({ boolValue: false })).toBe(false);
  });

  it('returns undefined for an empty / unmodeled value', () => {
    expect(readOpenRouterAnyValue({})).toBeUndefined();
    expect(readOpenRouterAnyValue(undefined)).toBeUndefined();
  });
});

describe('openRouterAttributeMap()', () => {
  it('flattens key/value attributes into a map of primitives', () => {
    const map = openRouterAttributeMap(GENERATION_ATTRIBUTES);
    expect(map.get('gen_ai.request.model')).toBe('openai/gpt-4o');
    expect(map.get('gen_ai.usage.prompt_tokens')).toBe(123);
    expect(map.get('gen_ai.usage.cost')).toBe(0.00042);
  });
});

describe('openRouterGenerationInfoFromAttributes()', () => {
  it('extracts model, provider, token usage, cost and generation id', () => {
    const info = openRouterGenerationInfoFromAttributes(openRouterAttributeMap(GENERATION_ATTRIBUTES));
    expect(info.model).toBe('openai/gpt-4o');
    expect(info.provider).toBe('openai');
    expect(info.promptTokens).toBe(123);
    expect(info.completionTokens).toBe(45);
    expect(info.totalTokens).toBe(168);
    expect(info.cost).toBe(0.00042);
    expect(info.generationId).toBe('gen-xyz');
  });

  it('supports the input_tokens / output_tokens attribute aliases', () => {
    const info = openRouterGenerationInfoFromAttributes(
      openRouterAttributeMap([
        { key: 'gen_ai.usage.input_tokens', value: { intValue: '10' } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: '20' } }
      ])
    );
    expect(info.promptTokens).toBe(10);
    expect(info.completionTokens).toBe(20);
  });
});

describe('openRouterBroadcastSpansFromPayload()', () => {
  it('flattens resourceSpans -> scopeSpans -> spans and extracts generation info', () => {
    const spans = openRouterBroadcastSpansFromPayload(buildPayload(GENERATION_ATTRIBUTES));
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe('chat');
    expect(spans[0].generation.model).toBe('openai/gpt-4o');
    expect(spans[0].resourceAttributes.get('service.name')).toBe('openrouter');
  });

  it('returns an empty array for an empty / test-connection payload', () => {
    expect(openRouterBroadcastSpansFromPayload({})).toEqual([]);
    expect(openRouterBroadcastSpansFromPayload({ resourceSpans: [] })).toEqual([]);
    expect(openRouterBroadcastSpansFromPayload(undefined)).toEqual([]);
  });
});

describe('OpenRouterWebhookService', () => {
  it('dispatches each span to a catch-all handler', async () => {
    const service = buildService();
    const handled: OpenRouterBroadcastSpan[] = [];

    service.configure(null, (configurer) => {
      configurer.handleAnySpan(async (span) => {
        handled.push(span);
        return true;
      });
    });

    const result = await service.updateForBroadcast(buildPayload(GENERATION_ATTRIBUTES));

    expect(result.valid).toBe(true);
    expect(result.totalSpans).toBe(1);
    expect(result.handledSpans).toBe(1);
    expect(handled).toHaveLength(1);
    expect(handled[0].generation.cost).toBe(0.00042);
  });

  it('dispatches by span name', async () => {
    const service = buildService();
    let chatCount = 0;

    service.configure(null, (configurer) => {
      configurer.handleSpanName('chat')(async () => {
        chatCount += 1;
        return true;
      });
    });

    const matched = await service.updateForBroadcast(buildPayload(GENERATION_ATTRIBUTES, 'chat'));
    expect(matched.handledSpans).toBe(1);
    expect(chatCount).toBe(1);

    const unmatched = await service.updateForBroadcast(buildPayload(GENERATION_ATTRIBUTES, 'embeddings'));
    expect(unmatched.totalSpans).toBe(1);
    expect(unmatched.handledSpans).toBe(0);
    expect(chatCount).toBe(1);
  });

  it('processes a payload when the request carries a valid secret token', async () => {
    const service = buildService();
    let handledSpans = 0;

    service.configure(null, (configurer) => {
      configurer.handleAnySpan(async () => {
        handledSpans += 1;
        return true;
      });
    });

    const result = await service.updateForWebhook(makeRequest({ authorization: `Bearer ${SECRET}` }), buildPayload(GENERATION_ATTRIBUTES));

    expect(result.valid).toBe(true);
    expect(result.handledSpans).toBe(1);
    expect(handledSpans).toBe(1);
  });

  it('rejects a payload when the request secret token is invalid and does not dispatch', async () => {
    const service = buildService();
    let handledSpans = 0;

    service.configure(null, (configurer) => {
      configurer.handleAnySpan(async () => {
        handledSpans += 1;
        return true;
      });
    });

    const result = await service.updateForWebhook(makeRequest({ authorization: 'Bearer wrong' }), buildPayload(GENERATION_ATTRIBUTES));

    expect(result.valid).toBe(false);
    expect(result.totalSpans).toBe(0);
    expect(handledSpans).toBe(0);
  });
});
