import { LLM_SWALLOW_SITE_ID_PATTERN, LLM_SWALLOW_SITES, makeLlmSwallowSiteRegistry } from '@dereekb/llm';
import { describe, expect, it } from 'vitest';
import { LLM_ZENMUX_SWALLOW_SITES } from './zenmux.swallow';

describe('LLM_ZENMUX_SWALLOW_SITES', () => {
  it('declares the five ZenMux sites in order', () => {
    expect(Object.keys(LLM_ZENMUX_SWALLOW_SITES)).toEqual(['llm/zenmux-account.base-url', 'llm/zenmux-provider-status.transport', 'llm/zenmux-provider-status.envelope', 'llm/zenmux-generation-bill.transport', 'llm/zenmux-generation-bill.envelope']);
  });

  it('keys each declaration by its own well-formed llm/zenmux- id', () => {
    for (const [key, declaration] of Object.entries(LLM_ZENMUX_SWALLOW_SITES)) {
      expect(declaration.id).toBe(key);
      expect(key).toMatch(LLM_SWALLOW_SITE_ID_PATTERN);
      expect(key.startsWith('llm/zenmux-')).toBe(true);
    }
  });

  it('merges with the root sites without a duplicate', () => {
    expect(() => makeLlmSwallowSiteRegistry([...Object.values(LLM_SWALLOW_SITES), ...Object.values(LLM_ZENMUX_SWALLOW_SITES)])).not.toThrow();
  });
});
