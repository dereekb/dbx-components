import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LLM_SWALLOW_SITE_ID_PATTERN, LLM_SWALLOW_SITES, makeLlmSwallowSiteRegistry } from '@dereekb/llm';
import { LLM_OPENROUTER_SWALLOW_SITES } from './openrouter.swallow';

const SRC_DIR = join(import.meta.dirname, '..');
const SITE_LITERAL_REGEX = /(['"`])(llm\/[a-z0-9-]+\.[a-z0-9-]+)\1/g;

function stripComments(code: string): string {
  return code.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('LLM_OPENROUTER_SWALLOW_SITES', () => {
  it('declares exactly the entry sites', () => {
    expect(Object.keys(LLM_OPENROUTER_SWALLOW_SITES)).toEqual(['llm/openrouter-strategy.client', 'llm/openrouter-decision.client']);
  });

  it('keys every site by an llm/ id of the root pattern', () => {
    for (const [key, site] of Object.entries(LLM_OPENROUTER_SWALLOW_SITES)) {
      expect(key).toBe(site.id);
      expect(site.id).toMatch(LLM_SWALLOW_SITE_ID_PATTERN);
      expect(site.id.startsWith('llm/')).toBe(true);

      if (site.channel === 'none') {
        expect(site.why).toBeTruthy();
      }
    }
  });

  it('merges with the root sites without a collision', () => {
    expect(() => makeLlmSwallowSiteRegistry([...Object.values(LLM_SWALLOW_SITES), ...Object.values(LLM_OPENROUTER_SWALLOW_SITES)])).not.toThrow();
  });

  it('declares every site id the entry code names', () => {
    const merged = makeLlmSwallowSiteRegistry([...Object.values(LLM_SWALLOW_SITES), ...Object.values(LLM_OPENROUTER_SWALLOW_SITES)]);
    const named = readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' })
      .filter((path) => path.endsWith('.ts') && !path.endsWith('.spec.ts') && !path.endsWith('.d.ts') && !path.endsWith('.swallow.ts'))
      .flatMap((path) => Array.from(stripComments(readFileSync(join(SRC_DIR, path), 'utf8')).matchAll(SITE_LITERAL_REGEX), (match) => `${path.split(sep).join('/')}: ${match[2]}`));

    expect(named.filter((entry) => !Object.hasOwn(merged, entry.slice(entry.indexOf(': ') + 2)))).toEqual([]);
  });
});
