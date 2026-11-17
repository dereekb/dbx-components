import { describe, expect, it } from 'vitest';
import { DEFAULT_LLM_REPLY_PROTOCOL, LLM_REPLY_PROTOCOLS, resolveLlmReplyProtocol } from './llm.reply.protocol';

describe('resolveLlmReplyProtocol()', () => {
  it('should prefer the request, then the descriptor, then the host default, then json', () => {
    expect(resolveLlmReplyProtocol({ request: { replyProtocol: 'line' }, descriptor: { replyProtocol: 'json-envelope' }, defaultReplyProtocol: 'json' })).toBe('line');
    expect(resolveLlmReplyProtocol({ request: {}, descriptor: { replyProtocol: 'json-envelope' }, defaultReplyProtocol: 'line' })).toBe('json-envelope');
    expect(resolveLlmReplyProtocol({ request: {}, descriptor: {}, defaultReplyProtocol: 'line' })).toBe('line');
    expect(resolveLlmReplyProtocol({})).toBe('json');
  });

  it('should skip a nullish value at each rung', () => {
    expect(resolveLlmReplyProtocol({ request: { replyProtocol: null }, descriptor: { replyProtocol: 'line' } })).toBe('line');
    expect(resolveLlmReplyProtocol({ request: null, descriptor: { replyProtocol: undefined }, defaultReplyProtocol: 'json-envelope' })).toBe('json-envelope');
    expect(resolveLlmReplyProtocol({ request: undefined, descriptor: null, defaultReplyProtocol: null })).toBe(DEFAULT_LLM_REPLY_PROTOCOL);
  });

  it('should declare the three protocols with json as the default', () => {
    expect(LLM_REPLY_PROTOCOLS).toEqual(['json', 'json-envelope', 'line']);
    expect(DEFAULT_LLM_REPLY_PROTOCOL).toBe('json');
  });
});
