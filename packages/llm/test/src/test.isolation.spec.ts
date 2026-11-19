import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * Isolation guards for `@dereekb/llm/test`.
 *
 * Copied per entry from `packages/openrouter/src/decision.spec.ts`. Every project of the family guards its OWN `src`:
 * Nx file inputs are per project, so a scan of another project's folder would be replayed from cache after a change there.
 *
 * Whether an SDK was evaluated. The entries load SDKs lazily (if at all), so the probe mocks the SDK ids themselves:
 * importing an entry must never evaluate an optional peer.
 */
const probe = vi.hoisted(() => ({ openai: false, openRouterSdk: false }));

vi.mock('openai', () => {
  probe.openai = true;
  return {};
});

vi.mock('@openrouter/sdk', () => {
  probe.openRouterSdk = true;
  return {};
});

const SRC_DIR = import.meta.dirname;
const SPECIFIER_REGEX = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"])([^'"\n]+)\1/g;

interface ScannedFile {
  /**
   * Path relative to `SRC_DIR`, `/`-separated.
   */
  readonly path: string;
  /**
   * The file's code with comments stripped.
   */
  readonly code: string;
}

function stripComments(code: string): string {
  return code.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/(^|[^:])\/\/.*$/gm, '$1');
}

function scanSrc(includeSpecs: boolean): ScannedFile[] {
  return readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.ts') && !path.endsWith('.d.ts') && (includeSpecs || !path.endsWith('.spec.ts')))
    .sort()
    .map((path) => ({ path: path.split(sep).join('/'), code: stripComments(readFileSync(join(SRC_DIR, path), 'utf8')) }));
}

function importersOf(files: ScannedFile[], isMatch: (specifier: string) => boolean): string[] {
  return files.filter((file) => Array.from(file.code.matchAll(SPECIFIER_REGEX), (match) => match[2]).some(isMatch)).map((file) => file.path);
}

function isPackage(name: string): (specifier: string) => boolean {
  return (specifier) => specifier === name || specifier.startsWith(`${name}/`);
}

describe('@dereekb/llm/test isolation', () => {
  const sources = scanSrc(false);

  it('should scan the entry module', () => {
    expect(sources.map((file) => file.path)).toEqual(expect.arrayContaining(['index.ts']));
  });

  // The first import transforms this entry and the whole @dereekb/llm root entry from source, which can outrun the 5s default under a parallel run.
  it('should load without evaluating an SDK', { timeout: 30_000 }, async () => {
    await import('./index');
    expect(probe).toEqual({ openai: false, openRouterSdk: false });
  });

  it('should import no openai', () => {
    expect(importersOf(sources, isPackage('openai'))).toEqual([]);
  });

  it('should import no @openrouter/sdk', () => {
    expect(importersOf(sources, isPackage('@openrouter/sdk'))).toEqual([]);
  });

  it('should never import @dereekb/openrouter, specs included', () => {
    expect(importersOf(scanSrc(true), isPackage('@dereekb/openrouter'))).toEqual([]);
  });

  it('should import decision symbols from @dereekb/llm, never the /decision subpath', () => {
    expect(importersOf(sources, isPackage('@dereekb/llm/decision'))).toEqual([]);
  });

  it('should import its own modules relatively', () => {
    expect(importersOf(sources, isPackage('@dereekb/llm/test'))).toEqual([]);
  });

  it('should never import a provider entry, specs included, so no spec can build a real transport', () => {
    // /test is adapter-agnostic (hosts inject adapters), and a spec here only ever runs fakes: no billed call by default.
    const isProviderEntry = (specifier: string) => ['@dereekb/llm/openai', '@dereekb/llm/openrouter', '@dereekb/llm/zenmux'].some((name) => isPackage(name)(specifier));
    expect(importersOf(scanSrc(true), isProviderEntry)).toEqual([]);
  });

  it('should import no vitest outside a spec, so the entry needs no vitest peer and runs outside a test runner', () => {
    expect(importersOf(sources, isPackage('vitest'))).toEqual([]);
  });
});
