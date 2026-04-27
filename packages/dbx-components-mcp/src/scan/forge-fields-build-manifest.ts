/**
 * Orchestrator for the `scan-forge-fields` generator.
 *
 * Composes a complete {@link ForgeFieldManifest} from a project root by
 *
 *   1. reading `dbx-mcp.scan.json` against {@link ForgeFieldsScanConfig}
 *   2. reading `package.json` to derive the entry-level `module` field
 *   3. resolving include/exclude globs against the project root
 *   4. feeding matched files into a ts-morph project
 *   5. extracting entries via {@link extractForgeFieldEntries}
 *   6. assembling the manifest envelope and validating it against
 *      {@link ForgeFieldManifest}
 *
 * I/O is fully injectable so tests drive every code path without
 * touching the real filesystem.
 */

import { glob as fsGlob, readFile as nodeReadFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { type } from 'arktype';
import { Project } from 'ts-morph';
import { ForgeFieldManifest, type ForgeFieldEntry } from '../manifest/forge-fields-schema.js';
import { extractForgeFieldEntries, type ExtractedForgeFieldEntry, type ForgeExtractWarning } from './forge-fields-extract.js';
import { DEFAULT_FORGE_FIELDS_SCAN_OUT_PATH, FORGE_FIELDS_SCAN_CONFIG_FILENAME, ForgeFieldsScanConfig, type ForgeFieldsScanSection } from './forge-fields-scan-config-schema.js';

// MARK: Public types
/**
 * Function shape used to read text files. Defaults to
 * `node:fs/promises.readFile(path, 'utf-8')`.
 */
export type BuildForgeFieldsReadFile = (absolutePath: string) => Promise<string>;

/**
 * Function shape used to resolve include/exclude globs against the project
 * root. Defaults to `node:fs/promises.glob` filtered through a regex-derived
 * exclude check.
 */
export type BuildForgeFieldsGlobber = (input: { readonly projectRoot: string; readonly include: readonly string[]; readonly exclude: readonly string[] }) => Promise<readonly string[]>;

/**
 * Input to {@link buildForgeFieldsManifest}.
 */
export interface BuildForgeFieldsManifestInput {
  readonly projectRoot: string;
  readonly generator: string;
  readonly now?: () => Date;
  readonly readFile?: BuildForgeFieldsReadFile;
  readonly globber?: BuildForgeFieldsGlobber;
}

/**
 * Outcome of one generator run. The success payload carries everything the
 * caller needs to write the manifest to disk or run a freshness diff against
 * an existing on-disk version.
 */
export type BuildForgeFieldsManifestOutcome =
  | { readonly kind: 'success'; readonly manifest: ForgeFieldManifest; readonly outPath: string; readonly scannedFileCount: number; readonly extractWarnings: readonly ForgeExtractWarning[] }
  | { readonly kind: 'no-config'; readonly configPath: string }
  | { readonly kind: 'invalid-scan-config'; readonly configPath: string; readonly error: string }
  | { readonly kind: 'no-package'; readonly packagePath: string }
  | { readonly kind: 'invalid-package'; readonly packagePath: string; readonly error: string }
  | { readonly kind: 'invalid-manifest'; readonly error: string };

const DEFAULT_READ_FILE: BuildForgeFieldsReadFile = (path) => nodeReadFile(path, 'utf-8');

const DEFAULT_GLOBBER: BuildForgeFieldsGlobber = async (input) => {
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
 * Builds a {@link ForgeFieldManifest} from the supplied project root. The
 * function is pure with respect to the injected I/O hooks, so unit tests can
 * drive every branch without disk access.
 *
 * @param input - the project root + injection hooks for testing
 * @returns a discriminated outcome describing the result
 */
export async function buildForgeFieldsManifest(input: BuildForgeFieldsManifestInput): Promise<BuildForgeFieldsManifestOutcome> {
  const { projectRoot, generator, readFile = DEFAULT_READ_FILE, globber = DEFAULT_GLOBBER, now = () => new Date() } = input;

  const configPath = resolve(projectRoot, FORGE_FIELDS_SCAN_CONFIG_FILENAME);
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

  const extractResult = extractForgeFieldEntries({ project });
  const moduleName = scanSection.module ?? packageName;
  const sourceLabel = scanSection.source ?? packageName;
  const entries = extractResult.entries.map((entry) => assembleEntry({ entry, projectRoot }));

  const manifest = {
    version: 1 as const,
    source: sourceLabel,
    module: moduleName,
    generatedAt: now().toISOString(),
    generator,
    entries
  };

  const validated = ForgeFieldManifest(manifest);
  let outcome: BuildForgeFieldsManifestOutcome;
  if (validated instanceof type.errors) {
    outcome = { kind: 'invalid-manifest', error: validated.summary };
  } else {
    const outPath = resolve(projectRoot, scanSection.out ?? DEFAULT_FORGE_FIELDS_SCAN_OUT_PATH);
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
type LoadScanConfigResult = { readonly kind: 'ok'; readonly section: ForgeFieldsScanSection } | { readonly kind: 'fail'; readonly outcome: Extract<BuildForgeFieldsManifestOutcome, { kind: 'no-config' | 'invalid-scan-config' }> };

async function loadScanConfig(configPath: string, readFile: BuildForgeFieldsReadFile): Promise<LoadScanConfigResult> {
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
      const validated = ForgeFieldsScanConfig(parsed);
      if (validated instanceof type.errors) {
        result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: validated.summary } };
      } else {
        result = { kind: 'ok', section: validated.forgeFields };
      }
    } else {
      result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: parseError } };
    }
  }
  return result;
}

type LoadPackageNameResult = { readonly kind: 'ok'; readonly packageName: string } | { readonly kind: 'fail'; readonly outcome: Extract<BuildForgeFieldsManifestOutcome, { kind: 'no-package' | 'invalid-package' }> };

async function loadPackageName(packagePath: string, readFile: BuildForgeFieldsReadFile): Promise<LoadPackageNameResult> {
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
  readonly entry: ExtractedForgeFieldEntry;
  readonly projectRoot: string;
}

function assembleEntry(input: AssembleEntryInput): ForgeFieldEntry {
  const { entry, projectRoot } = input;
  const projectRelative = relative(projectRoot, entry.filePath).replaceAll('\\', '/');
  const sourcePath = projectRelative.replace(/^src\/lib\/forge\//, '').replace(/^src\//, '');

  const out: ForgeFieldEntry = {
    slug: entry.slug,
    factoryName: entry.factoryName,
    tier: entry.tier,
    produces: entry.produces,
    arrayOutput: entry.arrayOutput,
    description: entry.description,
    sourcePath,
    example: entry.example,
    properties: entry.properties.map((p) => ({ ...p })),
    ...(entry.wrapperPattern === undefined ? {} : { wrapperPattern: entry.wrapperPattern }),
    ...(entry.ngFormType === undefined ? {} : { ngFormType: entry.ngFormType }),
    ...(entry.generic === undefined ? {} : { generic: entry.generic }),
    ...(entry.suffix === undefined ? {} : { suffix: entry.suffix }),
    ...(entry.composesFromSlugs && entry.composesFromSlugs.length > 0 ? { composesFromSlugs: [...entry.composesFromSlugs] } : {}),
    ...(entry.returns === undefined ? {} : { returns: entry.returns }),
    ...(entry.configInterface === undefined ? {} : { configInterface: entry.configInterface }),
    sourceLocation: { file: projectRelative, line: entry.line },
    ...(entry.deprecated === undefined ? {} : { deprecated: entry.deprecated }),
    ...(entry.since === undefined ? {} : { since: entry.since })
  };
  return out;
}

/**
 * Translates a glob pattern into a RegExp suitable for testing
 * `relative(projectRoot, file)` paths. Mirrors the behaviour of the
 * sibling builders so all three pipelines apply exclude rules identically.
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
export function serializeForgeFieldManifest(manifest: ForgeFieldManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
