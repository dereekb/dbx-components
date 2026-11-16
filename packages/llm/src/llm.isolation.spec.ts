import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, sep } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * Isolation guards for `@dereekb/llm` and `@dereekb/llm/decision` (both compile from this `src`).
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

describe('@dereekb/llm isolation', () => {
  const sources = scanSrc(false);

  it('should scan the entry modules', () => {
    expect(sources.map((file) => file.path)).toEqual(expect.arrayContaining(['decision.ts', 'index.ts']));
  });

  it('should load the root and /decision entries without evaluating an SDK', async () => {
    await import('./index');
    await import('./decision');
    expect(probe).toEqual({ openai: false, openRouterSdk: false });
  });

  it('should import no node: module or Node builtin', () => {
    expect(importersOf(sources, isNodeModule)).toEqual([]);
  });

  it('should not read process', () => {
    expect(sources.filter((file) => PROCESS_READ_REGEX.test(file.code)).map((file) => file.path)).toEqual([]);
  });

  it('should import no LLM SDK', () => {
    expect(importersOf(sources, (specifier) => isPackage('openai')(specifier) || isPackage('@openrouter/sdk')(specifier))).toEqual([]);
  });

  it('should never import @dereekb/openrouter, specs included', () => {
    expect(importersOf(scanSrc(true), isPackage('@dereekb/openrouter'))).toEqual([]);
  });

  it('should import its own modules relatively', () => {
    expect(importersOf(sources, isPackage('@dereekb/llm'))).toEqual([]);
  });

  it('should serve the decision lane from the root and /decision entries as one copy', async () => {
    const root = await import('./index');
    const decision = await import('./decision');

    expect(decision.LlmDecisionAnswerFaultError).toBe(root.LlmDecisionAnswerFaultError);
    expect(decision.LlmDecisionDeclarationError).toBe(root.LlmDecisionDeclarationError);
    expect(decision.llmChoiceQuestion).toBe(root.llmChoiceQuestion);
    expect(Object.keys(decision).length).toBeGreaterThan(0);
    expect(Object.keys(root)).toEqual(expect.arrayContaining(Object.keys(decision)));
  });
});
