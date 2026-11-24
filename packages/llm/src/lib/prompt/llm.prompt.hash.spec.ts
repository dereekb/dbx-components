import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@dereekb/util';
import { LLM_PROMPT_CACHE_HASH_LENGTH, llmPromptCacheHash } from './llm.prompt.hash';

describe('llmPromptCacheHash()', () => {
  it('should hash the empty string to the SHA-256 prefix', () => {
    expect(llmPromptCacheHash('')).toBe('e3b0c44298fc1c14');
  });

  it('should hash abc to the SHA-256 prefix', () => {
    expect(llmPromptCacheHash('abc')).toBe('ba7816bf8f01cfea');
  });

  it('should equal the first 16 characters of sha256Hex and always be 16 characters long', () => {
    for (const text of ['', 'a', 'prompt bytes', 'ab🙂', 'x'.repeat(1000)]) {
      const hash = llmPromptCacheHash(text);
      expect(hash).toBe(sha256Hex(text).slice(0, 16));
      expect(hash).toHaveLength(LLM_PROMPT_CACHE_HASH_LENGTH);
    }
  });
});
