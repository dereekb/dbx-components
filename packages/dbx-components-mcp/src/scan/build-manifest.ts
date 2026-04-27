/**
 * Orchestrator for the `scan-semantic-types` generator.
 *
 * Composes a complete {@link SemanticTypeManifest} from a project root by
 *
 *   1. reading `dbx-mcp.scan.json` against {@link SemanticTypeScanConfig}
 *   2. reading `package.json` to derive the entry-level `package` field
 *   3. resolving include/exclude globs against the project root
 *   4. feeding matched files into a ts-morph project
 *   5. extracting entries via {@link extractEntries}
 *   6. assembling the manifest envelope and validating it against
 *      {@link SemanticTypeManifest}
 *
 * I/O is fully injectable so tests drive every code path without
 * touching the real filesystem.
 */

import { relative, resolve } from 'node:path';
import { type } from 'arktype';
import { Project } from 'ts-morph';
import { SemanticTypeManifest, type SemanticTypeEntry } from '../manifest/semantic-types-schema.js';
import { extractEntries, type ExtractedEntry } from './extract.js';
import { defaultGlobber, defaultReadFile, loadPackageName, type ScanGlobber, type ScanReadFile } from './scan-io.js';
import { DEFAULT_SCAN_OUT_PATH, SCAN_CONFIG_FILENAME, SemanticTypeScanConfig } from './scan-config-schema.js';

// MARK: Public types
export type BuildManifestReadFile = ScanReadFile;
export type BuildManifestGlobber = ScanGlobber;

/**
 * Input to {@link buildManifest}.
 */
export interface BuildManifestInput {
  readonly projectRoot: string;
  readonly generator: string;
  readonly now?: () => Date;
  readonly readFile?: BuildManifestReadFile;
  readonly globber?: BuildManifestGlobber;
}

/**
 * Outcome of one generator run. The success payload carries everything
 * the caller needs to write the manifest to disk or run a freshness
 * diff against an existing on-disk version.
 */
export type BuildManifestOutcome =
  | { readonly kind: 'success'; readonly manifest: SemanticTypeManifest; readonly outPath: string; readonly scannedFileCount: number }
  | { readonly kind: 'no-config'; readonly configPath: string }
  | { readonly kind: 'invalid-scan-config'; readonly configPath: string; readonly error: string }
  | { readonly kind: 'no-package'; readonly packagePath: string }
  | { readonly kind: 'invalid-package'; readonly packagePath: string; readonly error: string }
  | { readonly kind: 'invalid-manifest'; readonly error: string };

const DEFAULT_READ_FILE: BuildManifestReadFile = defaultReadFile;
const DEFAULT_GLOBBER: BuildManifestGlobber = defaultGlobber;

// MARK: Entry point
/**
 * Builds a {@link SemanticTypeManifest} from the supplied project root.
 * The function is pure with respect to the injected I/O hooks, so unit
 * tests can drive every branch without disk access.
 *
 * @param input - the project root + injection hooks for testing
 * @returns a discriminated outcome describing the result
 */
export async function buildManifest(input: BuildManifestInput): Promise<BuildManifestOutcome> {
  const { projectRoot, generator, readFile = DEFAULT_READ_FILE, globber = DEFAULT_GLOBBER, now = () => new Date() } = input;

  const configPath = resolve(projectRoot, SCAN_CONFIG_FILENAME);
  const packagePath = resolve(projectRoot, 'package.json');

  const configOutcome = await loadScanConfig(configPath, readFile);
  if (configOutcome.kind !== 'ok') {
    return configOutcome.outcome;
  }
  const scanConfig = configOutcome.config;

  const packageOutcome = await loadPackageName(packagePath, readFile);
  if (packageOutcome.kind !== 'ok') {
    return packageOutcome.outcome;
  }
  const packageName = packageOutcome.packageName;

  const filePaths = await globber({
    projectRoot,
    include: scanConfig.include,
    exclude: scanConfig.exclude ?? []
  });

  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  for (const relPath of filePaths) {
    const absolute = resolve(projectRoot, relPath);
    const text = await readFile(absolute);
    project.createSourceFile(absolute, text, { overwrite: true });
  }

  const extracted = extractEntries({ project });
  const entries = extracted.map((entry) => assembleEntry({ entry, packageName, projectRoot }));

  const manifest = {
    version: 1 as const,
    source: scanConfig.source,
    topicNamespace: scanConfig.topicNamespace,
    generatedAt: now().toISOString(),
    generator,
    topics: [...(scanConfig.declaredTopics ?? [])],
    entries
  };

  const validated = SemanticTypeManifest(manifest);
  let outcome: BuildManifestOutcome;
  if (validated instanceof type.errors) {
    outcome = { kind: 'invalid-manifest', error: validated.summary };
  } else {
    const outPath = resolve(projectRoot, scanConfig.out ?? DEFAULT_SCAN_OUT_PATH);
    outcome = {
      kind: 'success',
      manifest: validated,
      outPath,
      scannedFileCount: filePaths.length
    };
  }
  return outcome;
}

// MARK: Helpers
type LoadScanConfigResult = { readonly kind: 'ok'; readonly config: SemanticTypeScanConfig } | { readonly kind: 'fail'; readonly outcome: Extract<BuildManifestOutcome, { kind: 'no-config' | 'invalid-scan-config' }> };

async function loadScanConfig(configPath: string, readFile: BuildManifestReadFile): Promise<LoadScanConfigResult> {
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
      const validated = SemanticTypeScanConfig(parsed);
      if (validated instanceof type.errors) {
        result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: validated.summary } };
      } else {
        result = { kind: 'ok', config: validated };
      }
    } else {
      result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: parseError } };
    }
  }
  return result;
}

interface AssembleEntryInput {
  readonly entry: ExtractedEntry;
  readonly packageName: string;
  readonly projectRoot: string;
}

function assembleEntry(input: AssembleEntryInput): SemanticTypeEntry {
  const { entry, packageName, projectRoot } = input;
  const projectRelative = relative(projectRoot, entry.filePath).replaceAll('\\', '/');
  const moduleId = projectRelative.replace(/\.ts$/, '');

  const out: SemanticTypeEntry = {
    name: entry.name,
    package: packageName,
    module: moduleId,
    kind: entry.kind,
    definition: entry.definition,
    baseType: entry.baseType,
    topics: [...entry.topics],
    ...(entry.unionValues ? { unionValues: [...entry.unionValues] } : {}),
    ...(entry.typeParameters ? { typeParameters: [...entry.typeParameters] } : {}),
    ...(entry.guards.length > 0 ? { guards: [...entry.guards] } : {}),
    ...(entry.factories.length > 0 ? { factories: [...entry.factories] } : {}),
    ...(entry.examples.length > 0 ? { examples: entry.examples.map((e) => ({ ...e })) } : {}),
    ...(entry.notes === undefined ? {} : { notes: entry.notes }),
    ...(entry.deprecated === undefined ? {} : { deprecated: entry.deprecated }),
    ...(entry.since === undefined ? {} : { since: entry.since }),
    sourceLocation: { file: projectRelative, line: entry.line }
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
export function serializeManifest(manifest: SemanticTypeManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
