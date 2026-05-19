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

import { resolve } from 'node:path';
import { type } from 'arktype';
import { FilterManifest, type FilterEntry } from '../manifest/filters-schema.js';
import { extractFilterEntries, type ExtractedFilterEntry, type FilterExtractWarning } from './filters-extract.js';
import { DEFAULT_FILTERS_SCAN_OUT_PATH, FILTERS_SCAN_CONFIG_FILENAME, FiltersScanConfig, type FiltersScanSection } from './filters-scan-config-schema.js';
import { buildScanProject, defaultGlobber, defaultReadFile, loadPackageName, loadScanSection, type ScanGlobber, type ScanReadFile } from '../../../dbx-cli/src/lib/scan-helpers/scan-io.js';

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
 * @param input - The project root + injection hooks for testing.
 * @returns A discriminated outcome describing the result.
 */
export async function buildFiltersManifest(input: BuildFiltersManifestInput): Promise<BuildFiltersManifestOutcome> {
  const { projectRoot, generator, readFile = DEFAULT_READ_FILE, globber = DEFAULT_GLOBBER, now = () => new Date() } = input;

  const configPath = resolve(projectRoot, FILTERS_SCAN_CONFIG_FILENAME);
  const packagePath = resolve(projectRoot, 'package.json');

  const configOutcome = await loadScanSection({
    configPath,
    readFile,
    parseSection: parseFiltersConfig
  });
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

  const project = await buildScanProject({ projectRoot, filePaths, readFile });

  const extractResult = extractFilterEntries({ project });
  const moduleName = scanSection.module ?? packageName;
  const sourceLabel = scanSection.source ?? packageName;
  const entries = extractResult.entries.map((entry) => assembleEntry({ entry, moduleName }));

  const manifest = {
    version: 1 as const,
    source: sourceLabel,
    module: moduleName,
    generatedAt: now().toISOString(),
    generator,
    entries
  };

  return finalizeFiltersOutcome({ manifest, projectRoot, scanSection, filePaths, extractResult });
}

function parseFiltersConfig(parsed: unknown): { readonly ok: true; readonly section: FiltersScanSection } | { readonly ok: false; readonly error: string } {
  const validated = FiltersScanConfig(parsed);
  if (validated instanceof type.errors) {
    return { ok: false, error: validated.summary };
  }
  return { ok: true, section: validated.filters };
}

interface FinalizeFiltersOutcomeInput {
  readonly manifest: unknown;
  readonly projectRoot: string;
  readonly scanSection: FiltersScanSection;
  readonly filePaths: readonly string[];
  readonly extractResult: { readonly warnings: readonly FilterExtractWarning[] };
}

function finalizeFiltersOutcome(input: FinalizeFiltersOutcomeInput): BuildFiltersManifestOutcome {
  const { manifest, projectRoot, scanSection, filePaths, extractResult } = input;
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
interface AssembleEntryInput {
  readonly entry: ExtractedFilterEntry;
  readonly moduleName: string;
}

function assembleEntry(input: AssembleEntryInput): FilterEntry {
  const { entry, moduleName } = input;
  const shared = buildSharedFilterEntryFields(entry);
  if (entry.kind === 'directive') {
    return {
      kind: 'directive',
      slug: entry.slug,
      selector: entry.selector,
      className: entry.className,
      module: moduleName,
      description: entry.description,
      inputs: entry.inputs.map((i) => ({ ...i })),
      outputs: entry.outputs.map((o) => ({ ...o })),
      example: entry.example,
      ...shared
    };
  }
  return {
    kind: 'pattern',
    slug: entry.slug,
    className: entry.className,
    module: moduleName,
    description: entry.description,
    example: entry.example,
    ...shared
  };
}

function buildSharedFilterEntryFields(entry: ExtractedFilterEntry): SharedFilterEntryFields {
  const result: { -readonly [K in keyof SharedFilterEntryFields]?: SharedFilterEntryFields[K] } = {};
  if (entry.relatedSlugs && entry.relatedSlugs.length > 0) {
    result.relatedSlugs = [...entry.relatedSlugs];
  }
  if (entry.skillRefs && entry.skillRefs.length > 0) {
    result.skillRefs = [...entry.skillRefs];
  }
  if (entry.deprecated !== undefined) {
    result.deprecated = entry.deprecated;
  }
  if (entry.since !== undefined) {
    result.since = entry.since;
  }
  return result;
}

interface SharedFilterEntryFields {
  readonly relatedSlugs?: string[];
  readonly skillRefs?: string[];
  readonly deprecated?: boolean | string;
  readonly since?: string;
}

// MARK: Stable serialization
/**
 * JSON-stringifies a manifest with stable key ordering and trailing newline so
 * `--check` mode can byte-compare against a committed file without
 * false-positive diffs from key reordering.
 *
 * @param manifest - The manifest to serialise.
 * @returns The canonical string form.
 */
export function serializeFilterManifest(manifest: FilterManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
