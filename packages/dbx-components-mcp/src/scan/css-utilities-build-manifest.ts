/**
 * Orchestrator for the `scan-css-utilities` generator.
 *
 * Composes a complete {@link CssUtilityManifest} from a project root by
 *
 *   1. reading `dbx-mcp.scan.json` against {@link CssUtilitiesScanConfig}
 *   2. reading `package.json` to derive the entry-level `module` field
 *   3. resolving include/exclude globs against the project root
 *   4. extracting every annotated utility class via
 *      {@link extractCssUtilityEntries}
 *   5. assembling the manifest envelope and validating it against
 *      {@link CssUtilityManifest}
 *
 * I/O is fully injectable so tests drive every code path without
 * touching the real filesystem.
 */

import { resolve } from 'node:path';
import { type } from 'arktype';
import { CssUtilityManifest, type CssUtilityEntry } from '../manifest/css-utilities-schema.js';
import { extractCssUtilityEntries, type ExtractedCssUtilityEntry, type ExtractWarning } from './css-utilities-extract.js';
import { DEFAULT_CSS_UTILITIES_SCAN_OUT_PATH, CSS_UTILITIES_SCAN_CONFIG_FILENAME, CssUtilitiesScanConfig, type CssUtilitiesScanSection } from './css-utilities-scan-config-schema.js';
import { defaultGlobber, defaultReadFile, loadPackageName, type ScanGlobber, type ScanReadFile } from './scan-io.js';

// MARK: Public types
export type BuildCssUtilitiesReadFile = ScanReadFile;
export type BuildCssUtilitiesGlobber = ScanGlobber;

/**
 * Input to {@link buildCssUtilitiesManifest}.
 */
export interface BuildCssUtilitiesManifestInput {
  readonly projectRoot: string;
  readonly generator: string;
  readonly now?: () => Date;
  readonly readFile?: BuildCssUtilitiesReadFile;
  readonly globber?: BuildCssUtilitiesGlobber;
}

/**
 * Outcome of one generator run.
 */
export type BuildCssUtilitiesManifestOutcome =
  | { readonly kind: 'success'; readonly manifest: CssUtilityManifest; readonly outPath: string; readonly scannedFileCount: number; readonly extractWarnings: readonly ExtractWarning[] }
  | { readonly kind: 'no-config'; readonly configPath: string }
  | { readonly kind: 'invalid-scan-config'; readonly configPath: string; readonly error: string }
  | { readonly kind: 'no-package'; readonly packagePath: string }
  | { readonly kind: 'invalid-package'; readonly packagePath: string; readonly error: string }
  | { readonly kind: 'invalid-manifest'; readonly error: string };

const DEFAULT_READ_FILE: BuildCssUtilitiesReadFile = defaultReadFile;
const DEFAULT_GLOBBER: BuildCssUtilitiesGlobber = defaultGlobber;

// MARK: Entry point
/**
 * Builds a {@link CssUtilityManifest} from the supplied project root. The
 * function is pure with respect to the injected I/O hooks, so unit tests
 * can drive every branch without disk access.
 *
 * @param input - the project root + injection hooks for testing
 * @returns a discriminated outcome describing the result
 */
export async function buildCssUtilitiesManifest(input: BuildCssUtilitiesManifestInput): Promise<BuildCssUtilitiesManifestOutcome> {
  const { projectRoot, generator, readFile = DEFAULT_READ_FILE, globber = DEFAULT_GLOBBER, now = () => new Date() } = input;

  const configPath = resolve(projectRoot, CSS_UTILITIES_SCAN_CONFIG_FILENAME);
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
  const sortedFiles = [...filePaths].sort((a, b) => a.localeCompare(b));

  const moduleName = scanSection.module ?? packageName;
  const sourceLabel = scanSection.source ?? packageName;

  const extractedEntries: { readonly entry: ExtractedCssUtilityEntry }[] = [];
  const allWarnings: ExtractWarning[] = [];
  for (const relPath of sortedFiles) {
    const absolute = resolve(projectRoot, relPath);
    const text = await readFile(absolute);
    const result = extractCssUtilityEntries({ file: relPath, source: text });
    for (const entry of result.entries) {
      extractedEntries.push({ entry });
    }
    for (const warning of result.warnings) {
      allWarnings.push(warning);
    }
  }

  extractedEntries.sort((a, b) => a.entry.slug.localeCompare(b.entry.slug));
  const entries = extractedEntries.map(({ entry }) => assembleEntry({ entry, sourceLabel, moduleName }));

  const manifest = {
    version: 1 as const,
    source: sourceLabel,
    module: moduleName,
    generatedAt: now().toISOString(),
    generator,
    entries
  };

  const validated = CssUtilityManifest(manifest);
  let outcome: BuildCssUtilitiesManifestOutcome;
  if (validated instanceof type.errors) {
    outcome = { kind: 'invalid-manifest', error: validated.summary };
  } else {
    const outPath = resolve(projectRoot, scanSection.out ?? DEFAULT_CSS_UTILITIES_SCAN_OUT_PATH);
    outcome = {
      kind: 'success',
      manifest: validated,
      outPath,
      scannedFileCount: sortedFiles.length,
      extractWarnings: allWarnings
    };
  }
  return outcome;
}

// MARK: Helpers
type LoadScanConfigResult = { readonly kind: 'ok'; readonly section: CssUtilitiesScanSection } | { readonly kind: 'fail'; readonly outcome: Extract<BuildCssUtilitiesManifestOutcome, { kind: 'no-config' | 'invalid-scan-config' }> };

async function loadScanConfig(configPath: string, readFile: BuildCssUtilitiesReadFile): Promise<LoadScanConfigResult> {
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
      const validated = CssUtilitiesScanConfig(parsed);
      if (validated instanceof type.errors) {
        result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: validated.summary } };
      } else {
        result = { kind: 'ok', section: validated.cssUtilities };
      }
    } else {
      result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: parseError } };
    }
  }
  return result;
}

interface AssembleEntryInput {
  readonly entry: ExtractedCssUtilityEntry;
  readonly sourceLabel: string;
  readonly moduleName: string;
}

function assembleEntry(input: AssembleEntryInput): CssUtilityEntry {
  const { entry, sourceLabel, moduleName } = input;
  const out: CssUtilityEntry = {
    slug: entry.slug,
    selector: entry.selector,
    source: sourceLabel,
    module: moduleName,
    file: entry.file,
    line: entry.line,
    declarations: entry.declarations.map((d) => ({ ...d })),
    ...(entry.role === undefined ? {} : { role: entry.role }),
    ...(entry.intent === undefined ? {} : { intent: entry.intent }),
    ...(entry.seeAlso && entry.seeAlso.length > 0 ? { seeAlso: [...entry.seeAlso] } : {}),
    ...(entry.antiUse === undefined ? {} : { antiUse: entry.antiUse }),
    ...(entry.since === undefined ? {} : { since: entry.since }),
    ...(entry.parent === undefined ? {} : { parent: entry.parent }),
    ...(entry.selectorContext === undefined ? {} : { selectorContext: entry.selectorContext }),
    ...(entry.component === undefined ? {} : { component: entry.component }),
    ...(entry.scope === undefined ? {} : { scope: entry.scope }),
    ...(entry.tokensRead && entry.tokensRead.length > 0 ? { tokensRead: [...entry.tokensRead] } : {}),
    ...(entry.tokensSet && entry.tokensSet.length > 0 ? { tokensSet: [...entry.tokensSet] } : {})
  };
  return out;
}

// MARK: Stable serialization
/**
 * JSON-stringifies a manifest with stable key ordering and trailing newline
 * so `--check` mode can byte-compare against a committed file without
 * false-positive diffs from key reordering.
 *
 * @param manifest - the manifest to serialise
 * @returns the canonical string form
 */
export function serializeCssUtilityManifest(manifest: CssUtilityManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
