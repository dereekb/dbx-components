/**
 * Orchestrator for the `scan-dbx-docs-ui-examples` generator.
 *
 * Composes a complete {@link DbxDocsUiExampleManifest} from a project root
 * by reading `dbx-mcp.scan.json` against
 * {@link DbxDocsUiExamplesScanConfig}, resolving include/exclude globs,
 * loading matched example files into a ts-morph project, extracting
 * entries via {@link extractDbxDocsUiExampleEntries}, and assembling the
 * manifest envelope. I/O is fully injectable for tests.
 */

import { resolve } from 'node:path';
import { type } from 'arktype';
import { Project } from 'ts-morph';
import { DbxDocsUiExampleManifest, type DbxDocsUiExampleEntry } from '../manifest/dbx-docs-ui-examples-schema.js';
import { extractDbxDocsUiExampleEntries, type ExtractedDbxDocsUiExampleEntry, type DbxDocsUiExamplesExtractWarning } from './dbx-docs-ui-examples-extract.js';
import { DBX_DOCS_UI_EXAMPLES_SCAN_CONFIG_FILENAME, DEFAULT_DBX_DOCS_UI_EXAMPLES_SCAN_OUT_PATH, DbxDocsUiExamplesScanConfig, type DbxDocsUiExamplesScanSection } from './dbx-docs-ui-examples-scan-config-schema.js';
import { defaultGlobber, defaultReadFile, loadPackageName, type ScanGlobber, type ScanReadFile } from './scan-io.js';

// MARK: Public types
export type BuildDbxDocsUiExamplesManifestReadFile = ScanReadFile;
export type BuildDbxDocsUiExamplesManifestGlobber = ScanGlobber;

/**
 * Input to {@link buildDbxDocsUiExamplesManifest}.
 */
export interface BuildDbxDocsUiExamplesManifestInput {
  readonly projectRoot: string;
  readonly generator: string;
  readonly now?: () => Date;
  readonly readFile?: BuildDbxDocsUiExamplesManifestReadFile;
  readonly globber?: BuildDbxDocsUiExamplesManifestGlobber;
}

/**
 * Outcome of one generator run.
 */
export type BuildDbxDocsUiExamplesManifestOutcome =
  | { readonly kind: 'success'; readonly manifest: DbxDocsUiExampleManifest; readonly outPath: string; readonly scannedFileCount: number; readonly extractWarnings: readonly DbxDocsUiExamplesExtractWarning[] }
  | { readonly kind: 'no-config'; readonly configPath: string }
  | { readonly kind: 'invalid-scan-config'; readonly configPath: string; readonly error: string }
  | { readonly kind: 'no-package'; readonly packagePath: string }
  | { readonly kind: 'invalid-package'; readonly packagePath: string; readonly error: string }
  | { readonly kind: 'invalid-manifest'; readonly error: string };

const DEFAULT_READ_FILE: BuildDbxDocsUiExamplesManifestReadFile = defaultReadFile;
const DEFAULT_GLOBBER: BuildDbxDocsUiExamplesManifestGlobber = defaultGlobber;

// MARK: Entry point
/**
 * Builds a {@link DbxDocsUiExampleManifest} from the supplied project root.
 *
 * @param input - the project root + injection hooks for testing
 * @returns a discriminated outcome describing the result
 */
export async function buildDbxDocsUiExamplesManifest(input: BuildDbxDocsUiExamplesManifestInput): Promise<BuildDbxDocsUiExamplesManifestOutcome> {
  const { projectRoot, generator, readFile = DEFAULT_READ_FILE, globber = DEFAULT_GLOBBER, now = () => new Date() } = input;

  const configPath = resolve(projectRoot, DBX_DOCS_UI_EXAMPLES_SCAN_CONFIG_FILENAME);
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

  const extractResult = await extractDbxDocsUiExampleEntries({ project, readFile });
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

  const validated = DbxDocsUiExampleManifest(manifest);
  if (validated instanceof type.errors) {
    return { kind: 'invalid-manifest', error: validated.summary };
  }
  const outPath = resolve(projectRoot, scanSection.out ?? DEFAULT_DBX_DOCS_UI_EXAMPLES_SCAN_OUT_PATH);
  return {
    kind: 'success',
    manifest: validated,
    outPath,
    scannedFileCount: filePaths.length,
    extractWarnings: extractResult.warnings
  };
}

// MARK: Helpers
type LoadScanConfigResult = { readonly kind: 'ok'; readonly section: DbxDocsUiExamplesScanSection } | { readonly kind: 'fail'; readonly outcome: Extract<BuildDbxDocsUiExamplesManifestOutcome, { kind: 'no-config' | 'invalid-scan-config' }> };

async function loadScanConfig(configPath: string, readFile: BuildDbxDocsUiExamplesManifestReadFile): Promise<LoadScanConfigResult> {
  let raw: string | null = null;
  try {
    raw = await readFile(configPath);
  } catch {
    raw = null;
  }
  if (raw === null) {
    return { kind: 'fail', outcome: { kind: 'no-config', configPath } };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error } };
  }
  const validated = DbxDocsUiExamplesScanConfig(parsed);
  if (validated instanceof type.errors) {
    return { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: validated.summary } };
  }
  return { kind: 'ok', section: validated.dbxDocsUiExamples };
}

interface AssembleEntryInput {
  readonly entry: ExtractedDbxDocsUiExampleEntry;
  readonly moduleName: string;
  readonly projectRoot: string;
}

function assembleEntry(input: AssembleEntryInput): DbxDocsUiExampleEntry {
  const { entry, moduleName } = input;
  const appRef = entry.appRef ?? moduleName;

  const uses = entry.uses.map((use) => ({
    kind: use.kind,
    className: use.className,
    ...(use.role === undefined ? {} : { role: use.role }),
    ...(use.selector === undefined ? {} : { selector: use.selector }),
    ...(use.pipeName === undefined ? {} : { pipeName: use.pipeName }),
    classSource: use.classSource
  }));

  return {
    slug: entry.slug,
    category: entry.category,
    summary: entry.summary,
    header: entry.header,
    className: entry.className,
    selector: entry.selector,
    module: moduleName,
    appRef,
    ...(entry.hint === undefined ? {} : { hint: entry.hint }),
    ...(entry.relatedSlugs && entry.relatedSlugs.length > 0 ? { relatedSlugs: [...entry.relatedSlugs] } : {}),
    ...(entry.skillRefs && entry.skillRefs.length > 0 ? { skillRefs: [...entry.skillRefs] } : {}),
    info: entry.info,
    snippet: entry.snippet,
    ...(entry.imports === undefined ? {} : { imports: entry.imports }),
    ...(entry.notes === undefined ? {} : { notes: entry.notes }),
    uses
  };
}

// MARK: Stable serialization
/**
 * JSON-stringifies a manifest with stable key ordering and trailing newline
 * so `--check` mode can byte-compare against a committed file without
 * false-positive diffs from key reordering.
 *
 * @param manifest - The validated manifest to serialize.
 * @returns A pretty-printed JSON string terminated with a newline.
 */
export function serializeDbxDocsUiExamplesManifest(manifest: DbxDocsUiExampleManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
