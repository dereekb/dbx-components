/**
 * Orchestrator for the `scan-pipes` generator.
 *
 * Composes a complete {@link PipeManifest} from a project root by
 *
 *   1. reading `dbx-mcp.scan.json` against {@link PipesScanConfig}
 *   2. reading `package.json` to derive the entry-level `module` field
 *   3. resolving include/exclude globs against the project root
 *   4. feeding matched files into a ts-morph project
 *   5. extracting entries via {@link extractPipeEntries}
 *   6. assembling the manifest envelope and validating it against
 *      {@link PipeManifest}
 *
 * I/O is fully injectable so tests drive every code path without touching
 * the real filesystem.
 */

import { glob as fsGlob, readFile as nodeReadFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { type } from 'arktype';
import { Project } from 'ts-morph';
import { PipeManifest, type PipeEntry } from '../manifest/pipes-schema.js';
import { extractPipeEntries, type ExtractedPipeEntry, type PipeExtractWarning } from './pipes-extract.js';
import { DEFAULT_PIPES_SCAN_OUT_PATH, PIPES_SCAN_CONFIG_FILENAME, PipesScanConfig, type PipesScanSection } from './pipes-scan-config-schema.js';

// MARK: Public types
/**
 * Function shape used to read text files. Defaults to
 * `node:fs/promises.readFile(path, 'utf-8')`.
 */
export type BuildPipesReadFile = (absolutePath: string) => Promise<string>;

/**
 * Function shape used to resolve include/exclude globs against the project
 * root. Defaults to `node:fs/promises.glob` filtered through a regex-derived
 * exclude check.
 */
export type BuildPipesGlobber = (input: { readonly projectRoot: string; readonly include: readonly string[]; readonly exclude: readonly string[] }) => Promise<readonly string[]>;

/**
 * Input to {@link buildPipesManifest}.
 */
export interface BuildPipesManifestInput {
  readonly projectRoot: string;
  readonly generator: string;
  readonly now?: () => Date;
  readonly readFile?: BuildPipesReadFile;
  readonly globber?: BuildPipesGlobber;
}

/**
 * Outcome of one generator run. The success payload carries everything the
 * caller needs to write the manifest to disk or run a freshness diff against
 * an existing on-disk version.
 */
export type BuildPipesManifestOutcome =
  | { readonly kind: 'success'; readonly manifest: PipeManifest; readonly outPath: string; readonly scannedFileCount: number; readonly extractWarnings: readonly PipeExtractWarning[] }
  | { readonly kind: 'no-config'; readonly configPath: string }
  | { readonly kind: 'invalid-scan-config'; readonly configPath: string; readonly error: string }
  | { readonly kind: 'no-package'; readonly packagePath: string }
  | { readonly kind: 'invalid-package'; readonly packagePath: string; readonly error: string }
  | { readonly kind: 'invalid-manifest'; readonly error: string };

const DEFAULT_READ_FILE: BuildPipesReadFile = (path) => nodeReadFile(path, 'utf-8');

const DEFAULT_GLOBBER: BuildPipesGlobber = async (input) => {
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

// MARK: Entry point
/**
 * Builds a {@link PipeManifest} from the supplied project root. The function
 * is pure with respect to the injected I/O hooks, so unit tests can drive
 * every branch without disk access.
 *
 * @param input - the project root + injection hooks for testing
 * @returns a discriminated outcome describing the result
 */
export async function buildPipesManifest(input: BuildPipesManifestInput): Promise<BuildPipesManifestOutcome> {
  const { projectRoot, generator, readFile = DEFAULT_READ_FILE, globber = DEFAULT_GLOBBER, now = () => new Date() } = input;

  const configPath = resolve(projectRoot, PIPES_SCAN_CONFIG_FILENAME);
  const packagePath = resolve(projectRoot, 'package.json');

  const configOutcome = await loadScanConfig(configPath, readFile);
  if (configOutcome.kind !== 'ok') {
    return configOutcome.outcome;
  }
  const scanSection = configOutcome.section;

  const packageOutcome = await loadPackageName(packagePath, readFile);
  if (packageOutcome.kind !== 'ok') {
    return packageOutcome.outcome;
  }
  const packageName = packageOutcome.packageName;

  const filePaths = await globber({
    projectRoot,
    include: scanSection.include,
    exclude: scanSection.exclude ?? []
  });

  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  for (const relPath of filePaths) {
    const absolute = resolve(projectRoot, relPath);
    const text = await readFile(absolute);
    project.createSourceFile(absolute, text, { overwrite: true });
  }

  const extractResult = extractPipeEntries({ project });
  const moduleName = scanSection.module ?? packageName;
  const sourceLabel = scanSection.source ?? packageName;
  const entries = extractResult.entries.map((entry) => assembleEntry({ entry, projectRoot, moduleName }));

  const manifest = {
    version: 1 as const,
    source: sourceLabel,
    module: moduleName,
    generatedAt: now().toISOString(),
    generator,
    entries
  };

  const validated = PipeManifest(manifest);
  let outcome: BuildPipesManifestOutcome;
  if (validated instanceof type.errors) {
    outcome = { kind: 'invalid-manifest', error: validated.summary };
  } else {
    const outPath = resolve(projectRoot, scanSection.out ?? DEFAULT_PIPES_SCAN_OUT_PATH);
    outcome = {
      kind: 'success',
      manifest: validated,
      outPath,
      scannedFileCount: filePaths.length,
      extractWarnings: extractResult.warnings
    };
  }
  return outcome;
}

// MARK: Helpers
type LoadScanConfigResult = { readonly kind: 'ok'; readonly section: PipesScanSection } | { readonly kind: 'fail'; readonly outcome: Extract<BuildPipesManifestOutcome, { kind: 'no-config' | 'invalid-scan-config' }> };

async function loadScanConfig(configPath: string, readFile: BuildPipesReadFile): Promise<LoadScanConfigResult> {
  let raw: string | null = null;
  try {
    raw = await readFile(configPath);
  } catch {
    raw = null;
  }
  let result: LoadScanConfigResult;
  if (raw === null) {
    result = { kind: 'fail', outcome: { kind: 'no-config', configPath } };
  } else {
    let parsed: unknown;
    let parseError: string | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
    }
    if (parseError === null) {
      const validated = PipesScanConfig(parsed);
      if (validated instanceof type.errors) {
        result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: validated.summary } };
      } else {
        result = { kind: 'ok', section: validated.pipes };
      }
    } else {
      result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: parseError } };
    }
  }
  return result;
}

type LoadPackageNameResult = { readonly kind: 'ok'; readonly packageName: string } | { readonly kind: 'fail'; readonly outcome: Extract<BuildPipesManifestOutcome, { kind: 'no-package' | 'invalid-package' }> };

async function loadPackageName(packagePath: string, readFile: BuildPipesReadFile): Promise<LoadPackageNameResult> {
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

interface AssembleEntryInput {
  readonly entry: ExtractedPipeEntry;
  readonly projectRoot: string;
  readonly moduleName: string;
}

function assembleEntry(input: AssembleEntryInput): PipeEntry {
  const { entry, projectRoot, moduleName } = input;
  const projectRelative = relative(projectRoot, entry.filePath).replaceAll('\\', '/');
  const sourcePath = projectRelative.replace(/^src\//, '');

  const out: PipeEntry = {
    slug: entry.slug,
    category: entry.category,
    pipeName: entry.pipeName,
    className: entry.className,
    module: moduleName,
    inputType: entry.inputType,
    outputType: entry.outputType,
    purity: entry.purity,
    description: entry.description,
    args: entry.args.map((a) => ({ ...a })),
    example: entry.example,
    sourcePath,
    ...(entry.relatedSlugs && entry.relatedSlugs.length > 0 ? { relatedSlugs: [...entry.relatedSlugs] } : {}),
    ...(entry.skillRefs && entry.skillRefs.length > 0 ? { skillRefs: [...entry.skillRefs] } : {}),
    sourceLocation: { file: projectRelative, line: entry.line },
    ...(entry.deprecated !== undefined ? { deprecated: entry.deprecated } : {}),
    ...(entry.since !== undefined ? { since: entry.since } : {})
  };
  return out;
}

/**
 * Translates a glob pattern into a RegExp suitable for testing
 * `relative(projectRoot, file)` paths.
 *
 * @param pattern - a glob pattern (no character classes)
 * @returns a RegExp that matches paths satisfying the glob
 */
function globToRegex(pattern: string): RegExp {
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

// MARK: Stable serialization
/**
 * JSON-stringifies a manifest with stable key ordering and trailing newline so
 * `--check` mode can byte-compare against a committed file without
 * false-positive diffs from key reordering.
 *
 * @param manifest - the manifest to serialise
 * @returns the canonical string form
 */
export function serializePipeManifest(manifest: PipeManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
