import { describe, expect, it } from 'vitest';
import { isLlmReplyObject } from './llm.reply.object';

describe('isLlmReplyObject()', () => {
  it('accepts objects and arrays and rejects everything else', () => {
    expect(isLlmReplyObject({})).toBe(true);
    expect(isLlmReplyObject([])).toBe(true);
    expect(isLlmReplyObject(null)).toBe(false);
    expect(isLlmReplyObject('x')).toBe(false);
    expect(isLlmReplyObject(1)).toBe(false);
  });
});
