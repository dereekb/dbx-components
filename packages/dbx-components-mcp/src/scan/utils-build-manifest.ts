/**
 * Orchestrator for the `scan-utils` generator.
 *
 * Composes a complete {@link UtilManifest} from a project root by
 *
 *   1. reading `dbx-mcp.scan.json` against {@link UtilsScanConfig}
 *   2. reading `package.json` to derive the entry-level `module` field
 *   3. resolving include/exclude globs against the project root
 *   4. feeding matched files into a ts-morph project
 *   5. extracting entries via {@link extractUtilEntries}
 *   6. assembling the manifest envelope and validating it against
 *      {@link UtilManifest}
 *
 * I/O is fully injectable so tests drive every code path without
 * touching the real filesystem.
 */

import { relative, resolve } from 'node:path';
import { type } from 'arktype';
import { Project } from 'ts-morph';
import { UtilManifest, type UtilEntry } from '../manifest/utils-schema.js';
import { extractUtilEntries, type ExtractedUtilEntry, type UtilExtractWarning } from './utils-extract.js';
import { DEFAULT_UTILS_SCAN_OUT_PATH, UTILS_SCAN_CONFIG_FILENAME, UtilsScanConfig, type UtilsScanSection } from './utils-scan-config-schema.js';
import { defaultGlobber, defaultReadFile, loadPackageName, type ScanGlobber, type ScanReadFile } from './scan-io.js';

// MARK: Public types
export type BuildUtilsReadFile = ScanReadFile;
export type BuildUtilsGlobber = ScanGlobber;

/**
 * Input to {@link buildUtilsManifest}.
 */
export interface BuildUtilsManifestInput {
  readonly projectRoot: string;
  readonly generator: string;
  readonly now?: () => Date;
  readonly readFile?: BuildUtilsReadFile;
  readonly globber?: BuildUtilsGlobber;
}

/**
 * Outcome of one generator run. The success payload carries everything
 * the caller needs to write the manifest to disk or run a freshness diff
 * against an existing on-disk version.
 */
export type BuildUtilsManifestOutcome =
  | { readonly kind: 'success'; readonly manifest: UtilManifest; readonly outPath: string; readonly scannedFileCount: number; readonly extractWarnings: readonly UtilExtractWarning[] }
  | { readonly kind: 'no-config'; readonly configPath: string }
  | { readonly kind: 'invalid-scan-config'; readonly configPath: string; readonly error: string }
  | { readonly kind: 'no-package'; readonly packagePath: string }
  | { readonly kind: 'invalid-package'; readonly packagePath: string; readonly error: string }
  | { readonly kind: 'invalid-manifest'; readonly error: string };

const DEFAULT_READ_FILE: BuildUtilsReadFile = defaultReadFile;
const DEFAULT_GLOBBER: BuildUtilsGlobber = defaultGlobber;

// MARK: Entry point
/**
 * Builds a {@link UtilManifest} from the supplied project root. The
 * function is pure with respect to the injected I/O hooks, so unit tests
 * can drive every branch without disk access.
 *
 * @param input - the project root + injection hooks for testing
 * @returns a discriminated outcome describing the result
 */
export async function buildUtilsManifest(input: BuildUtilsManifestInput): Promise<BuildUtilsManifestOutcome> {
  const { projectRoot, generator, readFile = DEFAULT_READ_FILE, globber = DEFAULT_GLOBBER, now = () => new Date() } = input;

  const configPath = resolve(projectRoot, UTILS_SCAN_CONFIG_FILENAME);
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

  const extractResult = extractUtilEntries({ project, projectRoot });
  const moduleName = scanSection.module ?? packageName;
  const sourceLabel = scanSection.source ?? packageName;
  const entries = extractResult.entries.map((entry) => assembleEntry({ entry, moduleName, projectRoot }));

  const manifest = {
    version: 1 as const,
    source: sourceLabel,
    module: moduleName,
    generatedAt: now().toISOString(),
    generator,
    entries
  };

  const validated = UtilManifest(manifest);
  let outcome: BuildUtilsManifestOutcome;
  if (validated instanceof type.errors) {
    outcome = { kind: 'invalid-manifest', error: validated.summary };
  } else {
    const outPath = resolve(projectRoot, scanSection.out ?? DEFAULT_UTILS_SCAN_OUT_PATH);
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
type LoadScanConfigResult = { readonly kind: 'ok'; readonly section: UtilsScanSection } | { readonly kind: 'fail'; readonly outcome: Extract<BuildUtilsManifestOutcome, { kind: 'no-config' | 'invalid-scan-config' }> };

async function loadScanConfig(configPath: string, readFile: BuildUtilsReadFile): Promise<LoadScanConfigResult> {
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
      const validated = UtilsScanConfig(parsed);
      if (validated instanceof type.errors) {
        result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: validated.summary } };
      } else {
        result = { kind: 'ok', section: validated.utils };
      }
    } else {
      result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: parseError } };
    }
  }
  return result;
}

interface AssembleEntryInput {
  readonly entry: ExtractedUtilEntry;
  readonly moduleName: string;
  readonly projectRoot: string;
}

const SRC_PREFIXES = ['/src/lib/', '/src/'];

function deriveSubpath(filePath: string, projectRoot: string): string {
  const normalised = filePath.replaceAll('\\', '/');
  const projectNormalised = projectRoot.replaceAll('\\', '/');
  let relativePath: string;
  if (normalised.startsWith(projectNormalised)) {
    relativePath = normalised.slice(projectNormalised.length).replace(/^\/+/, '');
  } else {
    relativePath = relative(projectRoot, filePath).replaceAll('\\', '/');
  }
  for (const prefix of SRC_PREFIXES) {
    const stripped = `/${relativePath}`;
    const idx = stripped.indexOf(prefix);
    if (idx >= 0) {
      const remainder = stripped.slice(idx + prefix.length);
      return remainder.replace(/\.ts$/, '');
    }
  }
  return relativePath.replace(/\.ts$/, '');
}

function assembleEntry(input: AssembleEntryInput): UtilEntry {
  const { entry, moduleName, projectRoot } = input;
  const subpath = deriveSubpath(entry.filePath, projectRoot);
  const out: UtilEntry = {
    slug: entry.slug,
    name: entry.name,
    kind: entry.kind,
    category: entry.category,
    module: moduleName,
    subpath,
    signature: entry.signature,
    description: entry.description,
    params: entry.params.map((p) => ({ ...p })),
    returns: entry.returns,
    tags: [...entry.tags],
    ...(entry.example.length > 0 ? { example: entry.example } : {}),
    ...(entry.relatedSlugs && entry.relatedSlugs.length > 0 ? { relatedSlugs: [...entry.relatedSlugs] } : {}),
    ...(entry.skillRefs && entry.skillRefs.length > 0 ? { skillRefs: [...entry.skillRefs] } : {}),
    ...(entry.deprecated !== undefined ? { deprecated: entry.deprecated } : {}),
    ...(entry.since !== undefined ? { since: entry.since } : {})
  };
  return out;
}

// MARK: Stable serialization
/**
 * JSON-stringifies a manifest with stable key ordering and trailing
 * newline so `--check` mode can byte-compare against a committed file
 * without false-positive diffs from key reordering.
 *
 * @param manifest - the manifest to serialise
 * @returns the canonical string form
 */
export function serializeUtilManifest(manifest: UtilManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
