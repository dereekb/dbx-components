/**
 * Orchestrator for the `scan-filters` generator.
 *
 * Composes a complete {@link FilterManifest} from a project root by
 *
 *   1. reading `dbx-mcp.scan.json` against {@link FiltersScanConfig}
 *   2. reading `package.json` to derive the entry-level `module` field
 *   3. resolving include/exclude globs against the project root
 *   4. feeding matched files into a ts-morph project
 *   5. extracting entries via {@link extractFilterEntries}
 *   6. assembling the manifest envelope and validating it against
 *      {@link FilterManifest}
 *
 * I/O is fully injectable so tests drive every code path without touching
 * the real filesystem.
 */

import { relative, resolve } from 'node:path';
import { type } from 'arktype';
import { Project } from 'ts-morph';
import { FilterManifest, type FilterEntry } from '../manifest/filters-schema.js';
import { extractFilterEntries, type ExtractedFilterEntry, type FilterExtractWarning } from './filters-extract.js';
import { DEFAULT_FILTERS_SCAN_OUT_PATH, FILTERS_SCAN_CONFIG_FILENAME, FiltersScanConfig, type FiltersScanSection } from './filters-scan-config-schema.js';
import { defaultGlobber, defaultReadFile, loadPackageName, type ScanGlobber, type ScanReadFile } from './scan-io.js';

// MARK: Public types
export type BuildFiltersReadFile = ScanReadFile;
export type BuildFiltersGlobber = ScanGlobber;

/**
 * Input to {@link buildFiltersManifest}.
 */
export interface BuildFiltersManifestInput {
  readonly projectRoot: string;
  readonly generator: string;
  readonly now?: () => Date;
  readonly readFile?: BuildFiltersReadFile;
  readonly globber?: BuildFiltersGlobber;
}

/**
 * Outcome of one generator run. The success payload carries everything the
 * caller needs to write the manifest to disk or run a freshness diff against
 * an existing on-disk version.
 */
export type BuildFiltersManifestOutcome =
  | { readonly kind: 'success'; readonly manifest: FilterManifest; readonly outPath: string; readonly scannedFileCount: number; readonly extractWarnings: readonly FilterExtractWarning[] }
  | { readonly kind: 'no-config'; readonly configPath: string }
  | { readonly kind: 'invalid-scan-config'; readonly configPath: string; readonly error: string }
  | { readonly kind: 'no-package'; readonly packagePath: string }
  | { readonly kind: 'invalid-package'; readonly packagePath: string; readonly error: string }
  | { readonly kind: 'invalid-manifest'; readonly error: string };

const DEFAULT_READ_FILE: BuildFiltersReadFile = defaultReadFile;
const DEFAULT_GLOBBER: BuildFiltersGlobber = defaultGlobber;

// MARK: Entry point
/**
 * Builds a {@link FilterManifest} from the supplied project root. The function
 * is pure with respect to the injected I/O hooks, so unit tests can drive
 * every branch without disk access.
 *
 * @param input - the project root + injection hooks for testing
 * @returns a discriminated outcome describing the result
 */
export async function buildFiltersManifest(input: BuildFiltersManifestInput): Promise<BuildFiltersManifestOutcome> {
  const { projectRoot, generator, readFile = DEFAULT_READ_FILE, globber = DEFAULT_GLOBBER, now = () => new Date() } = input;

  const configPath = resolve(projectRoot, FILTERS_SCAN_CONFIG_FILENAME);
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

  const extractResult = extractFilterEntries({ project });
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

  const validated = FilterManifest(manifest);
  let outcome: BuildFiltersManifestOutcome;
  if (validated instanceof type.errors) {
    outcome = { kind: 'invalid-manifest', error: validated.summary };
  } else {
    const outPath = resolve(projectRoot, scanSection.out ?? DEFAULT_FILTERS_SCAN_OUT_PATH);
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
type LoadScanConfigResult = { readonly kind: 'ok'; readonly section: FiltersScanSection } | { readonly kind: 'fail'; readonly outcome: Extract<BuildFiltersManifestOutcome, { kind: 'no-config' | 'invalid-scan-config' }> };

async function loadScanConfig(configPath: string, readFile: BuildFiltersReadFile): Promise<LoadScanConfigResult> {
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
      const validated = FiltersScanConfig(parsed);
      if (validated instanceof type.errors) {
        result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: validated.summary } };
      } else {
        result = { kind: 'ok', section: validated.filters };
      }
    } else {
      result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: parseError } };
    }
  }
  return result;
}

interface AssembleEntryInput {
  readonly entry: ExtractedFilterEntry;
  readonly projectRoot: string;
  readonly moduleName: string;
}

function assembleEntry(input: AssembleEntryInput): FilterEntry {
  const { entry, projectRoot, moduleName } = input;
  const projectRelative = relative(projectRoot, entry.filePath).replaceAll('\\', '/');
  const sourcePath = projectRelative.replace(/^src\//, '');

  let out: FilterEntry;
  if (entry.kind === 'directive') {
    out = {
      kind: 'directive',
      slug: entry.slug,
      selector: entry.selector,
      className: entry.className,
      module: moduleName,
      description: entry.description,
      inputs: entry.inputs.map((i) => ({ ...i })),
      outputs: entry.outputs.map((o) => ({ ...o })),
      example: entry.example,
      sourcePath,
      ...(entry.relatedSlugs && entry.relatedSlugs.length > 0 ? { relatedSlugs: [...entry.relatedSlugs] } : {}),
      ...(entry.skillRefs && entry.skillRefs.length > 0 ? { skillRefs: [...entry.skillRefs] } : {}),
      sourceLocation: { file: projectRelative, line: entry.line },
      ...(entry.deprecated !== undefined ? { deprecated: entry.deprecated } : {}),
      ...(entry.since !== undefined ? { since: entry.since } : {})
    };
  } else {
    out = {
      kind: 'pattern',
      slug: entry.slug,
      className: entry.className,
      module: moduleName,
      description: entry.description,
      example: entry.example,
      sourcePath,
      ...(entry.relatedSlugs && entry.relatedSlugs.length > 0 ? { relatedSlugs: [...entry.relatedSlugs] } : {}),
      ...(entry.skillRefs && entry.skillRefs.length > 0 ? { skillRefs: [...entry.skillRefs] } : {}),
      sourceLocation: { file: projectRelative, line: entry.line },
      ...(entry.deprecated !== undefined ? { deprecated: entry.deprecated } : {}),
      ...(entry.since !== undefined ? { since: entry.since } : {})
    };
  }
  return out;
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
export function serializeFilterManifest(manifest: FilterManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
