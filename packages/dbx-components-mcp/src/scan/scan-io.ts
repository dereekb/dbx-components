/**
 * Shared I/O primitives for the build-manifest pipelines.
 *
 * Every scanner needs the same file-reading, glob-matching, exclude-filtering,
 * and package-name-loading logic, so it lives here once. Individual
 * `*-build-manifest.ts` modules import these and supply their own schema
 * validation / entry assembly.
 */

import { glob as fsGlob, readFile as nodeReadFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import { Project } from 'ts-morph';

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

/**
 * Reads `package.json` at the supplied path and returns its `name` field, normalising file/parse errors into a discriminated outcome compatible with `*-build-manifest.ts` callers.
 *
 * @param packagePath - Absolute path to `package.json`.
 * @param readFile - File-reader injected by the scan runtime.
 * @returns Either the parsed package name or a discriminated failure outcome.
 */
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

// MARK: Scan-config loading
/**
 * Failure variants surfaced by {@link loadScanSection}. Every per-cluster
 * `Build*ManifestOutcome` includes these same two variants so the shared
 * loader can return a value the caller forwards directly.
 */
export type ScanConfigFailureOutcome = { readonly kind: 'no-config'; readonly configPath: string } | { readonly kind: 'invalid-scan-config'; readonly configPath: string; readonly error: string };

/**
 * Discriminated outcome from {@link loadScanSection}. On success carries the
 * cluster's already-validated section; on failure carries an outcome the
 * caller forwards as its own `Build*ManifestOutcome`.
 */
export type LoadScanSectionResult<TSection> = { readonly kind: 'ok'; readonly section: TSection } | { readonly kind: 'fail'; readonly outcome: ScanConfigFailureOutcome };

/**
 * Reads `dbx-mcp.scan.json` at {@link configPath}, parses it as JSON, and
 * hands the parsed object to {@link parseSection} for cluster-specific
 * arktype validation. Centralises the missing-file / bad-JSON / invalid-
 * schema branches that every `*-build-manifest.ts` repeats verbatim.
 *
 * @param input - config path, file reader, and the cluster-specific parse
 *   callback (typically wraps an arktype validator + extracts a sub-field)
 * @returns either the validated section or a forwardable failure outcome
 */
export async function loadScanSection<TSection>(input: { readonly configPath: string; readonly readFile: ScanReadFile; readonly parseSection: (parsed: unknown) => { readonly ok: true; readonly section: TSection } | { readonly ok: false; readonly error: string } }): Promise<LoadScanSectionResult<TSection>> {
  const { configPath, readFile, parseSection } = input;
  const readResult = await readScanConfigRaw(configPath, readFile);
  let result: LoadScanSectionResult<TSection>;
  if (readResult.kind === 'error') {
    result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: `failed to read config: ${readResult.error}` } };
  } else if (readResult.kind === 'enoent') {
    result = { kind: 'fail', outcome: { kind: 'no-config', configPath } };
  } else {
    result = parseScanSectionFromRaw(readResult.raw, configPath, parseSection);
  }
  return result;
}

type ReadScanConfigRawResult = { readonly kind: 'ok'; readonly raw: string } | { readonly kind: 'enoent' } | { readonly kind: 'error'; readonly error: string };

async function readScanConfigRaw(configPath: string, readFile: ScanReadFile): Promise<ReadScanConfigRawResult> {
  let result: ReadScanConfigRawResult;
  try {
    const raw = await readFile(configPath);
    result = { kind: 'ok', raw };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | null)?.code;
    if (code === 'ENOENT') {
      result = { kind: 'enoent' };
    } else {
      result = { kind: 'error', error: err instanceof Error ? err.message : String(err) };
    }
  }
  return result;
}

function parseScanSectionFromRaw<TSection>(raw: string, configPath: string, parseSection: (parsed: unknown) => { readonly ok: true; readonly section: TSection } | { readonly ok: false; readonly error: string }): LoadScanSectionResult<TSection> {
  const jsonResult = parseJsonString(raw);
  let result: LoadScanSectionResult<TSection>;
  if (jsonResult.ok) {
    const sectionResult = parseSection(jsonResult.value);
    if (sectionResult.ok) {
      result = { kind: 'ok', section: sectionResult.section };
    } else {
      result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: sectionResult.error } };
    }
  } else {
    result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: jsonResult.error } };
  }
  return result;
}

type ParseJsonStringResult = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string };

function parseJsonString(raw: string): ParseJsonStringResult {
  let result: ParseJsonStringResult;
  try {
    result = { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  return result;
}

// MARK: ts-morph project bootstrap
/**
 * Builds an in-memory ts-morph {@link Project} populated with the supplied
 * relative file paths. Resolves every path against {@link projectRoot},
 * reads it via {@link readFile}, and adds it to the project as a source
 * file. Used by every `*-build-manifest.ts` orchestrator before handing
 * the project to its cluster-specific extractor.
 *
 * @param input - project root, relative file paths to load, and the file
 *   reader used to fetch each file's contents
 * @returns the populated ts-morph project ready for entry extraction
 */
export async function buildScanProject(input: { readonly projectRoot: string; readonly filePaths: readonly string[]; readonly readFile: ScanReadFile }): Promise<Project> {
  const { projectRoot, filePaths, readFile } = input;
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  for (const relPath of filePaths) {
    const absolute = resolvePath(projectRoot, relPath);
    const text = await readFile(absolute);
    project.createSourceFile(absolute, text, { overwrite: true });
  }
  return project;
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
