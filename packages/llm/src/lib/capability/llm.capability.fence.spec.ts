import { describe, expect, it } from 'vitest';
import { LLM_CAPABILITY_CONTEXT_FENCE, LLM_CAPABILITY_REPLY_FENCE, llmFencedBlockLines } from './llm.capability.fence';

describe('llmFencedBlockLines()', () => {
  it('should open with <<<FENCE, carry the text whole, and close with the bare fence', () => {
    expect(llmFencedBlockLines(LLM_CAPABILITY_REPLY_FENCE, '{"a":1\nREPLY-ish')).toEqual(['<<<REPLY', '{"a":1\nREPLY-ish', 'REPLY']);
    expect(llmFencedBlockLines(LLM_CAPABILITY_CONTEXT_FENCE, '')).toEqual(['<<<CONTEXT', '', 'CONTEXT']);
  });
});
