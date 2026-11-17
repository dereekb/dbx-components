import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, sep } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * Isolation guards for `@dereekb/llm/openai`.
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
const NODE_BUILTINS = new Set(builtinModules);
const SPECIFIER_REGEX = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"])([^'"\n]+)\1/g;
const PROCESS_READ_REGEX = /(?<![\w$.])process(?:\?\.|\.|\[)|\btypeof\s+process\b|\bglobalThis(?:\?\.|\.)process\b/;

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

function isNodeModule(specifier: string): boolean {
  return specifier.startsWith('node:') || NODE_BUILTINS.has(specifier.split('/')[0]);
}

function isPackage(name: string): (specifier: string) => boolean {
  return (specifier) => specifier === name || specifier.startsWith(`${name}/`);
}

function escapeRegex(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\/]/g, String.raw`\$&`);
}

/**
 * The value (non-`type`) static imports and the re-exports of `sdk` (or a subpath) in the boundary file — each one
 * would evaluate the SDK when the entry loads. `import type` (erased) and `import('…')` (deferred) are the only legal
 * forms.
 */
function staticImportsOf(files: ScannedFile[], boundary: string, sdk: string): string[] {
  const code = files.find((file) => file.path === boundary)?.code ?? '';
  const specifier = `['"]${escapeRegex(sdk)}(?:/[^'"]*)?['"]`;
  const staticImport = new RegExp(String.raw`\bimport\s+(?!type\b)[^'"(]*\bfrom\s*${specifier}`, 'g');
  const reExport = new RegExp(String.raw`\bexport\s[^'"]*\bfrom\s*${specifier}`, 'g');
  return [...Array.from(code.matchAll(staticImport), (match) => match[0]), ...Array.from(code.matchAll(reExport), (match) => match[0])];
}

describe('@dereekb/llm/openai isolation', () => {
  const sources = scanSrc(false);

  it('should scan the entry module', () => {
    expect(sources.map((file) => file.path)).toEqual(expect.arrayContaining(['index.ts']));
  });

  it('should load without evaluating an SDK', async () => {
    await import('./index');
    expect(probe).toEqual({ openai: false, openRouterSdk: false });
  });

  it('should import no node: module or Node builtin', () => {
    expect(importersOf(sources, isNodeModule)).toEqual([]);
  });

  it('should not read process', () => {
    expect(sources.filter((file) => PROCESS_READ_REGEX.test(file.code)).map((file) => file.path)).toEqual([]);
  });

  it('should import openai only from lib/openai.sdk.ts', () => {
    expect(importersOf(sources, isPackage('openai'))).toEqual(['lib/openai.sdk.ts']);
  });

  it('should reach openai from its boundary only through import() or import type', () => {
    expect(staticImportsOf(sources, 'lib/openai.sdk.ts', 'openai')).toEqual([]);
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
    expect(importersOf(sources, isPackage('@dereekb/llm/openai'))).toEqual([]);
  });
});
