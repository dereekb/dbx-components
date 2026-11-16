import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, it, expect } from 'vitest';
import { LLM_SWALLOW_CAUSE_MAX_LENGTH, LLM_SWALLOW_SITE_ID_PATTERN, LLM_SWALLOW_SITES, llmSwallowCauseText, makeLlmSwallowSiteRegistry, NOOP_LLM_SWALLOW_SINK, type LlmSwallowSiteDeclaration } from './llm.swallow';

/**
 * The swallow vocabulary: the cause text, the registry builder, the library's published sites, and a CONFORMANCE scan
 * that every `llm/…` site id quoted in this project's source is declared in {@link LLM_SWALLOW_SITES}.
 */

/**
 * This project's `src` folder (this file is `src/lib/record/llm.swallow.spec.ts`).
 */
const SRC_DIR = join(import.meta.dirname, '..', '..');
const SITE_LITERAL_REGEX = /(['"`])(llm\/[a-z0-9-]+\.[a-z0-9-]+)\1/g;

function stripComments(code: string): string {
  return code.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/(^|[^:])\/\/.*$/gm, '$1');
}

function declaration(id: string): LlmSwallowSiteDeclaration {
  return { id, protects: 'a spec site', onError: 'proceed', expectation: 'expected', channel: 'diag' };
}

describe('llmSwallowCauseText', () => {
  it('renders an Error as its message and anything else as its String form', () => {
    expect(llmSwallowCauseText(new Error('boom'))).toBe('boom');
    expect(llmSwallowCauseText('plain')).toBe('plain');
    expect(llmSwallowCauseText(42)).toBe('42');
  });

  it('reports nothing for a nullish, empty or message-less cause', () => {
    expect(llmSwallowCauseText(undefined)).toBeUndefined();
    expect(llmSwallowCauseText(null)).toBeUndefined();
    expect(llmSwallowCauseText('')).toBeUndefined();
    expect(llmSwallowCauseText(new Error(''))).toBeUndefined();
  });

  it('cuts to the cap and is idempotent on its own output', () => {
    const text = llmSwallowCauseText(new Error('x'.repeat(1000)));

    expect(text?.length).toBe(LLM_SWALLOW_CAUSE_MAX_LENGTH);
    expect(llmSwallowCauseText(text)).toBe(text);
  });
});

describe('makeLlmSwallowSiteRegistry', () => {
  it('keys each declaration by its id, in input order', () => {
    const registry = makeLlmSwallowSiteRegistry([declaration('app/b.second'), declaration('app/a.first')]);

    expect(Object.keys(registry)).toEqual(['app/b.second', 'app/a.first']);
    expect(registry['app/a.first'].id).toBe('app/a.first');
  });

  it('throws on a duplicate id rather than letting one declaration shadow another', () => {
    expect(() => makeLlmSwallowSiteRegistry([declaration('app/a.site'), declaration('app/a.site')])).toThrow("llm-swallow-sites: duplicate site id 'app/a.site'");
  });

  it('merges the library sites with a host registry', () => {
    const merged = makeLlmSwallowSiteRegistry([...Object.values(LLM_SWALLOW_SITES), declaration('app/a.site')]);

    expect(Object.keys(merged)).toHaveLength(Object.keys(LLM_SWALLOW_SITES).length + 1);
  });
});

describe('LLM_SWALLOW_SITES', () => {
  const sites = Object.entries(LLM_SWALLOW_SITES);

  it('declares exactly the library sites, in order', () => {
    expect(Object.keys(LLM_SWALLOW_SITES)).toEqual([
      'llm/call-context.swallow-sink',
      'llm/dispatch-taps.sync-throw',
      'llm/dispatch-taps.async-reject',
      'llm/credential-probe.transport',
      'llm/credential-probe.error-body',
      'llm/strategy-readiness.health-check',
      'llm/strategy-readiness.credential-probe',
      'llm/strategy-readiness.provider-status'
    ]);
  });

  it('keys each declaration by its own id, in the llm area and the id shape', () => {
    for (const [key, site] of sites) {
      expect(site.id).toBe(key);
      expect(key).toMatch(LLM_SWALLOW_SITE_ID_PATTERN);
      expect(key.startsWith('llm/')).toBe(true);
    }
  });

  it('gives every channel-none site a why', () => {
    for (const [, site] of sites.filter(([, site]) => site.channel === 'none')) {
      expect(site.why).toBeTruthy();
    }
  });

  it('declares every llm site id quoted in this project source (conformance)', () => {
    const quoted = readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' })
      .map((path) => path.split(sep).join('/'))
      .filter((path) => path.endsWith('.ts') && !path.endsWith('.d.ts') && !path.endsWith('.spec.ts') && path !== 'lib/record/llm.swallow.ts')
      .flatMap((path) => Array.from(stripComments(readFileSync(join(SRC_DIR, path), 'utf8')).matchAll(SITE_LITERAL_REGEX), (match) => ({ path, id: match[2] })));

    expect(quoted.filter(({ id }) => !(id in LLM_SWALLOW_SITES))).toEqual([]);
  });
});

describe('NOOP_LLM_SWALLOW_SINK', () => {
  it('accepts a site and a cause and does nothing', () => {
    expect(NOOP_LLM_SWALLOW_SINK('llm/example.site', new Error('x'))).toBeUndefined();
  });
});
