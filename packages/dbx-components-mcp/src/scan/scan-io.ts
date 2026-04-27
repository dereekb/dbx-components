/**
 * Shared I/O primitives for the build-manifest pipelines.
 *
 * Every scanner needs the same file-reading, glob-matching, exclude-filtering,
 * and package-name-loading logic, so it lives here once. Individual
 * `*-build-manifest.ts` modules import these and supply their own schema
 * validation / entry assembly.
 */

import { glob as fsGlob, readFile as nodeReadFile } from 'node:fs/promises';

// MARK: Types
/**
 * Function shape used to read text files. Defaults to
 * `node:fs/promises.readFile(path, 'utf-8')`.
 */
export type ScanReadFile = (absolutePath: string) => Promise<string>;

/**
 * Function shape used to resolve include/exclude globs against the project
 * root. Defaults to `node:fs/promises.glob` filtered through a regex-derived
 * exclude check.
 */
export type ScanGlobber = (input: { readonly projectRoot: string; readonly include: readonly string[]; readonly exclude: readonly string[] }) => Promise<readonly string[]>;

// MARK: Defaults
export const defaultReadFile: ScanReadFile = (path) => nodeReadFile(path, 'utf-8');

export const defaultGlobber: ScanGlobber = async (input) => {
  const { projectRoot, include, exclude } = input;
  const excludeMatchers = exclude.map(globToRegex);
  const seen = new Set<string>();
  const matches: string[] = [];
  for (const pattern of include) {
    for await (const match of fsGlob(pattern, { cwd: projectRoot })) {
      if (excludeMatchers.some((rx) => rx.test(match))) {
        continue;
      }
      if (!seen.has(match)) {
        seen.add(match);
        matches.push(match);
      }
    }
  }
  return matches;
};

// MARK: Package name loading
/**
 * Shared outcome kinds for the `no-package` / `invalid-package` error
 * paths. Every build-manifest outcome type includes these same two
 * variants, so the shared loader can return a compatible discriminated
 * union.
 */
export type LoadPackageNameResult = { readonly kind: 'ok'; readonly packageName: string } | { readonly kind: 'fail'; readonly outcome: { readonly kind: 'no-package'; readonly packagePath: string } | { readonly kind: 'invalid-package'; readonly packagePath: string; readonly error: string } };

export async function loadPackageName(packagePath: string, readFile: ScanReadFile): Promise<LoadPackageNameResult> {
  let raw: string | null = null;
  try {
    raw = await readFile(packagePath);
  } catch {
    raw = null;
  }
  let result: LoadPackageNameResult;
  if (raw === null) {
    result = { kind: 'fail', outcome: { kind: 'no-package', packagePath } };
  } else {
    let parsed: unknown;
    let parseError: string | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
    }
    if (parseError === null) {
      const name = (parsed as { readonly name?: unknown } | null | undefined)?.name;
      if (typeof name !== 'string' || name.length === 0) {
        result = { kind: 'fail', outcome: { kind: 'invalid-package', packagePath, error: 'package.json is missing a non-empty `name` field' } };
      } else {
        result = { kind: 'ok', packageName: name };
      }
    } else {
      result = { kind: 'fail', outcome: { kind: 'invalid-package', packagePath, error: parseError } };
    }
  }
  return result;
}

// MARK: Glob helpers
/**
 * Translates a glob pattern into a RegExp suitable for testing
 * `relative(projectRoot, file)` paths. Supports `**`, `*`, and `?`
 * wildcards. Used by the default globber to filter exclude patterns
 * — the matching logic intentionally mirrors `node:fs/promises.glob`.
 *
 * @param pattern - a glob pattern (no character classes)
 * @returns a RegExp that matches paths satisfying the glob
 */
export function globToRegex(pattern: string): RegExp {
  let body = '';
  let index = 0;
  while (index < pattern.length) {
    const char = pattern[index];
    if (char === '*' && pattern[index + 1] === '*') {
      body += '.*';
      index += 2;
      if (pattern[index] === '/') {
        index += 1;
      }
    } else if (char === '*') {
      body += '[^/]*';
      index += 1;
    } else if (char === '?') {
      body += '[^/]';
      index += 1;
    } else if ('.+^${}()|[]\\'.includes(char)) {
      body += `\\${char}`;
      index += 1;
    } else {
      body += char;
      index += 1;
    }
  }
  return new RegExp(`^${body}$`);
}
