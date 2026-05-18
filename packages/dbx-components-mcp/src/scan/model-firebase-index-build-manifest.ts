/**
 * Orchestrator for the `scan-model-firebase-indexes` generator.
 *
 * Composes a complete {@link ModelFirebaseIndexManifest} from a project
 * root by:
 *
 *   1. reading `dbx-mcp.scan.json` against {@link ModelFirebaseIndexScanConfig}
 *   2. reading `package.json` to derive the entry-level `module` field
 *   3. resolving include/exclude globs against the project root
 *   4. feeding matched files into a ts-morph project
 *   5. building a build-time identity resolver from the same project
 *   6. extracting entries via {@link extractModelFirebaseIndexEntries}
 *   7. running them through {@link analyzeModelFirebaseIndexEntries}
 *   8. assembling the manifest envelope and validating it against
 *      {@link ModelFirebaseIndexManifest}
 *
 * I/O is fully injectable so tests drive every code path without touching
 * the real filesystem.
 */

import { relative, resolve } from 'node:path';
import { type } from 'arktype';
import { ModelFirebaseIndexManifest, type ModelFirebaseIndexEntry } from '../manifest/model-firebase-index-schema.js';
import { analyzeModelFirebaseIndexEntries, type AnalyzedEntry, type AnalyzerWarning } from './model-firebase-index-analyze.js';
import { extractModelFirebaseIndexEntries, type ExtractedModelFirebaseIndexEntry, type ModelFirebaseIndexExtractWarning } from './model-firebase-index-extract.js';
import { buildIdentityResolverFromProject } from './firestore-model-identity-resolver.js';
import { DEFAULT_MODEL_FIREBASE_INDEX_SCAN_OUT_PATH, MODEL_FIREBASE_INDEX_SCAN_CONFIG_FILENAME, ModelFirebaseIndexScanConfig } from './model-firebase-index-scan-config-schema.js';
import { buildScanProject, defaultGlobber, defaultReadFile, loadPackageName, loadScanSection, type ScanGlobber, type ScanReadFile } from './scan-io.js';

// MARK: Public types
export type BuildModelFirebaseIndexReadFile = ScanReadFile;
export type BuildModelFirebaseIndexGlobber = ScanGlobber;

/**
 * Combined warnings emitted by one generator run — extractor warnings plus
 * analyzer warnings. Surfaced to the CLI / MCP tool layer so authors can
 * see ambiguity (missing model tag, unresolved field, orderby conflict)
 * without dropping silently.
 */
export type ModelFirebaseIndexBuildWarning = { readonly stage: 'extract'; readonly warning: ModelFirebaseIndexExtractWarning } | { readonly stage: 'analyze'; readonly warning: AnalyzerWarning };

/**
 * Input to {@link buildModelFirebaseIndexManifest}.
 */
export interface BuildModelFirebaseIndexManifestInput {
  readonly projectRoot: string;
  readonly generator: string;
  readonly now?: () => Date;
  readonly readFile?: BuildModelFirebaseIndexReadFile;
  readonly globber?: BuildModelFirebaseIndexGlobber;
}

/**
 * Outcome of one generator run.
 */
export type BuildModelFirebaseIndexManifestOutcome =
  | { readonly kind: 'success'; readonly manifest: ModelFirebaseIndexManifest; readonly outPath: string; readonly scannedFileCount: number; readonly extractWarnings: readonly ModelFirebaseIndexBuildWarning[]; readonly entryFilePathsBySlug: ReadonlyMap<string, string> }
  | { readonly kind: 'no-config'; readonly configPath: string }
  | { readonly kind: 'invalid-scan-config'; readonly configPath: string; readonly error: string }
  | { readonly kind: 'no-package'; readonly packagePath: string }
  | { readonly kind: 'invalid-package'; readonly packagePath: string; readonly error: string }
  | { readonly kind: 'invalid-manifest'; readonly error: string };

const DEFAULT_READ_FILE: BuildModelFirebaseIndexReadFile = defaultReadFile;
const DEFAULT_GLOBBER: BuildModelFirebaseIndexGlobber = defaultGlobber;

// MARK: Entry point
/**
 * Builds a {@link ModelFirebaseIndexManifest} from the supplied project
 * root. The function is pure with respect to the injected I/O hooks, so
 * unit tests can drive every branch without disk access.
 *
 * @param input - The project root + injection hooks for testing.
 * @returns A discriminated outcome describing the result.
 */
export async function buildModelFirebaseIndexManifest(input: BuildModelFirebaseIndexManifestInput): Promise<BuildModelFirebaseIndexManifestOutcome> {
  const { projectRoot, generator, readFile = DEFAULT_READ_FILE, globber = DEFAULT_GLOBBER, now = () => new Date() } = input;

  const configPath = resolve(projectRoot, MODEL_FIREBASE_INDEX_SCAN_CONFIG_FILENAME);
  const packagePath = resolve(projectRoot, 'package.json');

  const configOutcome = await loadScanSection({
    configPath,
    readFile,
    parseSection: (parsed) => {
      const validated = ModelFirebaseIndexScanConfig(parsed);
      if (validated instanceof type.errors) {
        return { ok: false, error: validated.summary };
      }
      return { ok: true, section: validated.modelFirebaseIndex };
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

  const identityResolver = buildIdentityResolverFromProject(project);
  const extractResult = extractModelFirebaseIndexEntries({ project, identityResolver, projectRoot });
  const analyzed = analyzeModelFirebaseIndexEntries(extractResult.entries);

  const buildWarnings: ModelFirebaseIndexBuildWarning[] = [];
  for (const warning of extractResult.warnings) {
    buildWarnings.push({ stage: 'extract', warning });
  }
  for (const entry of analyzed) {
    for (const warning of entry.warnings) {
      buildWarnings.push({ stage: 'analyze', warning });
    }
  }

  const moduleName = scanSection.module ?? packageName;
  const sourceLabel = scanSection.source ?? packageName;
  const entries = analyzed.map((analyzedEntry) => assembleEntry({ analyzedEntry, moduleName, projectRoot }));

  const manifest = {
    version: 1 as const,
    source: sourceLabel,
    module: moduleName,
    generatedAt: now().toISOString(),
    generator,
    entries
  };

  const validated = ModelFirebaseIndexManifest(manifest);
  let outcome: BuildModelFirebaseIndexManifestOutcome;
  if (validated instanceof type.errors) {
    outcome = { kind: 'invalid-manifest', error: validated.summary };
  } else {
    const outPath = resolve(projectRoot, scanSection.out ?? DEFAULT_MODEL_FIREBASE_INDEX_SCAN_OUT_PATH);
    const entryFilePathsBySlug = new Map<string, string>();
    for (const analyzedEntry of analyzed) {
      entryFilePathsBySlug.set(analyzedEntry.extractedEntry.slug, analyzedEntry.extractedEntry.filePath);
    }
    outcome = {
      kind: 'success',
      manifest: validated,
      outPath,
      scannedFileCount: filePaths.length,
      extractWarnings: buildWarnings,
      entryFilePathsBySlug
    };
  }
  return outcome;
}

// MARK: Helpers
interface AssembleEntryInput {
  readonly analyzedEntry: AnalyzedEntry;
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

function assembleEntry(input: AssembleEntryInput): ModelFirebaseIndexEntry {
  const { analyzedEntry, moduleName, projectRoot } = input;
  const entry: ExtractedModelFirebaseIndexEntry = analyzedEntry.extractedEntry;
  const subpath = deriveSubpath(entry.filePath, projectRoot);
  const out: ModelFirebaseIndexEntry = {
    slug: entry.slug,
    name: entry.name,
    module: moduleName,
    subpath,
    signature: entry.signature,
    description: entry.description,
    model: entry.model,
    collection: entry.collection,
    isNested: entry.isNested,
    scope: entry.scope,
    manual: entry.manual,
    skip: entry.skip,
    ...(entry.specOnly ? { specOnly: true } : {}),
    ...(entry.excluded ? { excluded: true } : {}),
    category: entry.category,
    params: entry.params.map((p) => ({ ...p })),
    returns: entry.returns,
    tags: [...entry.tags],
    constraintSequences: entry.constraintSequences.map((s) => ({
      ...(s.pathLabel === undefined ? {} : { pathLabel: s.pathLabel }),
      entries: s.entries.map((e) => ({ ...e }))
    })),
    derivedComposites: analyzedEntry.derivedComposites.map((c) => ({ ...c, fields: c.fields.map((f) => ({ ...f })) })),
    derivedFieldOverrides: analyzedEntry.derivedFieldOverrides.map((f) => ({ ...f, variants: f.variants.map((v) => ({ ...v })) })),
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
export function serializeModelFirebaseIndexManifest(manifest: ModelFirebaseIndexManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

// MARK: Warning formatting
/**
 * Renders a {@link ModelFirebaseIndexBuildWarning} into a single human-readable
 * line. Shared by the `scan-model-firebase-indexes` CLI and the
 * `dbx_model_firebase_index_list_app` MCP tool so both surfaces describe the
 * same warning identically.
 *
 * @param warning - Warning emitted by the extractor or analyzer.
 * @returns A one-line description suitable for CLI logs or markdown bullets.
 *
 * @example
 * ```ts
 * outcome.extractWarnings.map(formatModelFirebaseIndexBuildWarning).forEach(log);
 * ```
 */
export function formatModelFirebaseIndexBuildWarning(warning: ModelFirebaseIndexBuildWarning): string {
  let result: string;
  if (warning.stage === 'extract') {
    const w = warning.warning;
    switch (w.kind) {
      case 'missing-name':
        result = `(anonymous) (${w.filePath}:${w.line}) tagged export has no resolvable name`;
        break;
      case 'missing-model-tag':
        result = `${w.name} (${w.filePath}:${w.line}) missing required @dbxModelFirebaseIndexModel tag`;
        break;
      case 'unresolved-model':
        result = `${w.name} (${w.filePath}:${w.line}) could not resolve model "${w.model}" to a Firestore identity`;
        break;
      case 'unsupported-scope':
        result = `${w.name} (${w.filePath}:${w.line}) unsupported @dbxModelFirebaseIndexScope value "${w.scope}"`;
        break;
      case 'duplicate-slug':
        result = `${w.name} (${w.filePath}:${w.line}) duplicate slug "${w.slug}" — already used by ${w.previousName}`;
        break;
      case 'unknown-helper':
        result = `${w.name} (${w.filePath}:${w.line}) unknown constraint helper "${w.helper}"`;
        break;
      case 'unresolved-field':
        result = `${w.name} (${w.filePath}:${w.line}) could not resolve field-path argument to "${w.callee}"`;
        break;
      case 'missing-paths':
        result = `${w.name} (${w.filePath}:${w.line}) missing path coverage for conditional fields [${w.conditionalFields.join(', ')}]`;
        break;
      case 'unknown-path-field':
        result = `${w.name} (${w.filePath}:${w.line}) @dbxModelFirebaseIndexPath references unknown field "${w.field}"`;
        break;
      case 'unannotated-query-helper':
        result = `${w.name} (${w.filePath}:${w.line}) calls query helper "${w.callee}" (${w.calleeFilePath}:${w.calleeLine}) that is not tagged with @dbxModelFirebaseIndexHelper`;
        break;
      case 'transitive-cycle':
        result = `${w.name} (${w.filePath}:${w.line}) transitive constraint resolution hit a cycle through "${w.callee}"`;
        break;
      case 'unresolvable-transitive-callee':
        result = `${w.name} (${w.filePath}:${w.line}) could not resolve transitive callee "${w.callee}"`;
        break;
      case 'complex-query-body':
        result = `${w.name} (${w.filePath}:${w.line}) tagged query body contains a "${w.branchKind}" construct — split into one factory per target index or mark as @dbxModelFirebaseIndexDispatcher`;
        break;
      case 'non-delegating-dispatcher':
        result = `${w.name} (${w.filePath}:${w.line}) @dbxModelFirebaseIndexDispatcher calls "${w.callee}" directly — dispatchers must only delegate to other tagged query functions`;
        break;
      case 'excluded-factory':
        result = `${w.name} (${w.filePath}:${w.line}) tagged @dbxModelFirebaseIndexExclude — analyzer is suppressing composites + fieldOverrides for this factory`;
        break;
    }
  } else {
    const w = warning.warning;
    switch (w.kind) {
      case 'multiple-range-fields':
        result = `${w.factoryName} multiple range-field constraints on [${w.fields.join(', ')}] — Firestore allows only one range field per query`;
        break;
      case 'orderby-conflict':
        result = `${w.factoryName} field "${w.field}" has conflicting orderBy directions [${w.directions.join(', ')}]`;
        break;
      case 'unsupported-array-contains-any':
        result = `${w.factoryName} field "${w.field}" uses array-contains-any — index support is partial`;
        break;
    }
  }
  return result;
}
