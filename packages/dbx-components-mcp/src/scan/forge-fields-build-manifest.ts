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

import { resolve } from 'node:path';
import { type } from 'arktype';
import { ForgeFieldManifest, type ForgeFieldEntry } from '../manifest/forge-fields-schema.js';
import { extractForgeFieldEntries, type ExtractedForgeFieldEntry, type ForgeExtractWarning } from './forge-fields-extract.js';
import { DEFAULT_FORGE_FIELDS_SCAN_OUT_PATH, FORGE_FIELDS_SCAN_CONFIG_FILENAME, ForgeFieldsScanConfig } from './forge-fields-scan-config-schema.js';
import { buildScanProject, defaultGlobber, defaultReadFile, loadPackageName, loadScanSection, type ScanGlobber, type ScanReadFile } from '../../../dbx-cli/src/lib/scan-helpers/scan-io.js';

// MARK: Public types
export type BuildForgeFieldsReadFile = ScanReadFile;
export type BuildForgeFieldsGlobber = ScanGlobber;

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

const DEFAULT_READ_FILE: BuildForgeFieldsReadFile = defaultReadFile;
const DEFAULT_GLOBBER: BuildForgeFieldsGlobber = defaultGlobber;

// MARK: Entry point
/**
 * Builds a {@link ForgeFieldManifest} from the supplied project root. The
 * function is pure with respect to the injected I/O hooks, so unit tests can
 * drive every branch without disk access.
 *
 * @param input - The project root + injection hooks for testing.
 * @returns A discriminated outcome describing the result.
 */
export async function buildForgeFieldsManifest(input: BuildForgeFieldsManifestInput): Promise<BuildForgeFieldsManifestOutcome> {
  const { projectRoot, generator, readFile = DEFAULT_READ_FILE, globber = DEFAULT_GLOBBER, now = () => new Date() } = input;

  const configPath = resolve(projectRoot, FORGE_FIELDS_SCAN_CONFIG_FILENAME);
  const packagePath = resolve(projectRoot, 'package.json');

  const configOutcome = await loadScanSection({
    configPath,
    readFile,
    parseSection: (parsed) => {
      const validated = ForgeFieldsScanConfig(parsed);
      if (validated instanceof type.errors) {
        return { ok: false, error: validated.summary };
      }
      return { ok: true, section: validated.forgeFields };
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

  const extractResult = extractForgeFieldEntries({ project });
  const moduleName = scanSection.module ?? packageName;
  const sourceLabel = scanSection.source ?? packageName;
  const entries = extractResult.entries.map((entry) => assembleEntry({ entry }));

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
interface AssembleEntryInput {
  readonly entry: ExtractedForgeFieldEntry;
}

function assembleEntry(input: AssembleEntryInput): ForgeFieldEntry {
  const { entry } = input;

  const out: ForgeFieldEntry = {
    slug: entry.slug,
    factoryName: entry.factoryName,
    tier: entry.tier,
    produces: entry.produces,
    arrayOutput: entry.arrayOutput,
    description: entry.description,
    example: entry.example,
    properties: entry.properties.map((p) => ({ ...p })),
    ...(entry.wrapperPattern === undefined ? {} : { wrapperPattern: entry.wrapperPattern }),
    ...(entry.ngFormType === undefined ? {} : { ngFormType: entry.ngFormType }),
    ...(entry.generic === undefined ? {} : { generic: entry.generic }),
    ...(entry.suffix === undefined ? {} : { suffix: entry.suffix }),
    ...(entry.composesFromSlugs && entry.composesFromSlugs.length > 0 ? { composesFromSlugs: [...entry.composesFromSlugs] } : {}),
    ...(entry.returns === undefined ? {} : { returns: entry.returns }),
    ...(entry.configInterface === undefined ? {} : { configInterface: entry.configInterface }),
    ...(entry.deprecated === undefined ? {} : { deprecated: entry.deprecated }),
    ...(entry.since === undefined ? {} : { since: entry.since })
  };
  return out;
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
export function serializeForgeFieldManifest(manifest: ForgeFieldManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
