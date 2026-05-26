/**
 * Orchestrator for the `scan-model-snapshot-fields` generator.
 *
 * Composes a complete {@link ModelSnapshotFieldManifest} from a project
 * root by
 *
 *   1. reading `dbx-mcp.scan.json` against {@link ModelSnapshotFieldsScanConfig}
 *   2. reading `package.json` to derive the entry-level `module` field
 *   3. resolving include/exclude globs against the project root
 *   4. feeding matched files into a ts-morph project
 *   5. extracting entries via {@link extractModelSnapshotFieldEntries}
 *   6. assembling the manifest envelope and validating it against
 *      {@link ModelSnapshotFieldManifest}
 *
 * I/O is fully injectable so tests drive every code path without
 * touching the real filesystem.
 */

import { relative, resolve } from 'node:path';
import { type } from 'arktype';
import { ModelSnapshotFieldManifest, type ModelSnapshotFieldEntry } from '../manifest/model-snapshot-fields-schema.js';
import { extractModelSnapshotFieldEntries, type ExtractedModelSnapshotFieldEntry, type ModelSnapshotFieldExtractWarning } from './model-snapshot-fields-extract.js';
import { DEFAULT_MODEL_SNAPSHOT_FIELDS_SCAN_OUT_PATH, MODEL_SNAPSHOT_FIELDS_SCAN_CONFIG_FILENAME, ModelSnapshotFieldsScanConfig } from './model-snapshot-fields-scan-config-schema.js';
import { buildScanProject, defaultGlobber, defaultReadFile, loadPackageName, loadScanSection, type ScanGlobber, type ScanReadFile } from '../../scan-helpers/scan-io.js';

// MARK: Public types
export type BuildModelSnapshotFieldsReadFile = ScanReadFile;
export type BuildModelSnapshotFieldsGlobber = ScanGlobber;

/**
 * Input to {@link buildModelSnapshotFieldsManifest}.
 */
export interface BuildModelSnapshotFieldsManifestInput {
  readonly projectRoot: string;
  readonly generator: string;
  readonly now?: () => Date;
  readonly readFile?: BuildModelSnapshotFieldsReadFile;
  readonly globber?: BuildModelSnapshotFieldsGlobber;
}

/**
 * Outcome of one generator run. The success payload carries everything
 * the caller needs to write the manifest to disk or run a freshness diff
 * against an existing on-disk version.
 */
export type BuildModelSnapshotFieldsManifestOutcome =
  | { readonly kind: 'success'; readonly manifest: ModelSnapshotFieldManifest; readonly outPath: string; readonly scannedFileCount: number; readonly extractWarnings: readonly ModelSnapshotFieldExtractWarning[] }
  | { readonly kind: 'no-config'; readonly configPath: string }
  | { readonly kind: 'invalid-scan-config'; readonly configPath: string; readonly error: string }
  | { readonly kind: 'no-package'; readonly packagePath: string }
  | { readonly kind: 'invalid-package'; readonly packagePath: string; readonly error: string }
  | { readonly kind: 'invalid-manifest'; readonly error: string };

const DEFAULT_READ_FILE: BuildModelSnapshotFieldsReadFile = defaultReadFile;
const DEFAULT_GLOBBER: BuildModelSnapshotFieldsGlobber = defaultGlobber;

// MARK: Entry point
/**
 * Builds a {@link ModelSnapshotFieldManifest} from the supplied project
 * root. The function is pure with respect to the injected I/O hooks, so
 * unit tests can drive every branch without disk access.
 *
 * @param input - The project root + injection hooks for testing.
 * @returns A discriminated outcome describing the result.
 */
export async function buildModelSnapshotFieldsManifest(input: BuildModelSnapshotFieldsManifestInput): Promise<BuildModelSnapshotFieldsManifestOutcome> {
  const { projectRoot, generator, readFile = DEFAULT_READ_FILE, globber = DEFAULT_GLOBBER, now = () => new Date() } = input;

  const configPath = resolve(projectRoot, MODEL_SNAPSHOT_FIELDS_SCAN_CONFIG_FILENAME);
  const packagePath = resolve(projectRoot, 'package.json');

  const configOutcome = await loadScanSection({
    configPath,
    readFile,
    parseSection: (parsed) => {
      const validated = ModelSnapshotFieldsScanConfig(parsed);
      if (validated instanceof type.errors) {
        return { ok: false, error: validated.summary };
      }
      return { ok: true, section: validated.modelSnapshotFields };
    }
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

  const extractResult = extractModelSnapshotFieldEntries({ project, projectRoot });
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

  const validated = ModelSnapshotFieldManifest(manifest);
  let outcome: BuildModelSnapshotFieldsManifestOutcome;
  if (validated instanceof type.errors) {
    outcome = { kind: 'invalid-manifest', error: validated.summary };
  } else {
    const outPath = resolve(projectRoot, scanSection.out ?? DEFAULT_MODEL_SNAPSHOT_FIELDS_SCAN_OUT_PATH);
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
  readonly entry: ExtractedModelSnapshotFieldEntry;
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

function assembleEntry(input: AssembleEntryInput): ModelSnapshotFieldEntry {
  const { entry, moduleName, projectRoot } = input;
  const subpath = deriveSubpath(entry.filePath, projectRoot);
  const out: ModelSnapshotFieldEntry = {
    slug: entry.slug,
    name: entry.name,
    kind: entry.kind,
    category: entry.category,
    module: moduleName,
    subpath,
    signature: entry.signature,
    description: entry.description,
    optional: entry.optional,
    params: entry.params.map((p) => ({ ...p })),
    returns: entry.returns,
    tags: [...entry.tags],
    ...(entry.example.length > 0 ? { example: entry.example } : {}),
    ...(entry.relatedSlugs && entry.relatedSlugs.length > 0 ? { relatedSlugs: [...entry.relatedSlugs] } : {}),
    ...(entry.skillRefs && entry.skillRefs.length > 0 ? { skillRefs: [...entry.skillRefs] } : {}),
    ...(entry.deprecated === undefined ? {} : { deprecated: entry.deprecated }),
    ...(entry.since === undefined ? {} : { since: entry.since })
  };
  return out;
}

// MARK: Stable serialization
/**
 * JSON-stringifies a manifest with stable key ordering and trailing
 * newline so `--check` mode can byte-compare against a committed file
 * without false-positive diffs from key reordering.
 *
 * @param manifest - The manifest to serialise.
 * @returns The canonical string form.
 */
export function serializeModelSnapshotFieldsManifest(manifest: ModelSnapshotFieldManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
