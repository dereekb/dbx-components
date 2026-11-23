import { LLM_SWALLOW_SITE_ID_PATTERN, LLM_SWALLOW_SITES, makeLlmSwallowSiteRegistry } from '@dereekb/llm';
import { describe, expect, it } from 'vitest';
import { LLM_NODE_SWALLOW_SITES } from './llm.node.swallow';

describe('LLM_NODE_SWALLOW_SITES', () => {
  it('declares the one /node site', () => {
    expect(Object.keys(LLM_NODE_SWALLOW_SITES)).toEqual(['llm/craft-notes.folder-read']);
  });

  it('keys each declaration by its own well-formed llm/craft-notes. id', () => {
    for (const [key, declaration] of Object.entries(LLM_NODE_SWALLOW_SITES)) {
      expect(declaration.id).toBe(key);
      expect(key).toMatch(LLM_SWALLOW_SITE_ID_PATTERN);
      expect(key.startsWith('llm/craft-notes.')).toBe(true);
    }
  });

  it('merges with the root sites without a duplicate', () => {
    expect(() => makeLlmSwallowSiteRegistry([...Object.values(LLM_SWALLOW_SITES), ...Object.values(LLM_NODE_SWALLOW_SITES)])).not.toThrow();
  });
});
