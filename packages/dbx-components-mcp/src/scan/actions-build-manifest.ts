/**
 * Orchestrator for the `scan-actions` generator.
 *
 * Composes a complete {@link ActionManifest} from a project root by reading
 * `dbx-mcp.scan.json`, `package.json`, resolving include/exclude globs,
 * feeding files into a ts-morph project, extracting entries via
 * {@link extractActionEntries}, and assembling the manifest envelope.
 */

import { resolve } from 'node:path';
import { type } from 'arktype';
import { Project } from 'ts-morph';
import { ActionManifest, type ActionDirectiveEntry, type ActionEntry, type ActionStateEntry, type ActionStoreEntry } from '../manifest/actions-schema.js';
import { extractActionEntries, type ExtractedActionDirective, type ExtractedActionEntry, type ExtractedActionState, type ExtractedActionStore, type ActionExtractWarning } from './actions-extract.js';
import { ACTIONS_SCAN_CONFIG_FILENAME, ActionsScanConfig, DEFAULT_ACTIONS_SCAN_OUT_PATH, type ActionsScanSection } from './actions-scan-config-schema.js';
import { defaultGlobber, defaultReadFile, loadPackageName, type ScanGlobber, type ScanReadFile } from './scan-io.js';

// MARK: Public types
export type BuildActionsReadFile = ScanReadFile;
export type BuildActionsGlobber = ScanGlobber;

export interface BuildActionsManifestInput {
  readonly projectRoot: string;
  readonly generator: string;
  readonly now?: () => Date;
  readonly readFile?: BuildActionsReadFile;
  readonly globber?: BuildActionsGlobber;
}

export type BuildActionsManifestOutcome =
  | { readonly kind: 'success'; readonly manifest: ActionManifest; readonly outPath: string; readonly scannedFileCount: number; readonly extractWarnings: readonly ActionExtractWarning[] }
  | { readonly kind: 'no-config'; readonly configPath: string }
  | { readonly kind: 'invalid-scan-config'; readonly configPath: string; readonly error: string }
  | { readonly kind: 'no-package'; readonly packagePath: string }
  | { readonly kind: 'invalid-package'; readonly packagePath: string; readonly error: string }
  | { readonly kind: 'invalid-manifest'; readonly error: string };

const DEFAULT_READ_FILE: BuildActionsReadFile = defaultReadFile;
const DEFAULT_GLOBBER: BuildActionsGlobber = defaultGlobber;

// MARK: Entry point
/**
 * Loads the project's actions scan config, scans the configured files, extracts every action directive/store/state, and builds a validated {@link ActionManifest}.
 *
 * @param input - Build options including the project root, generator metadata, and optional file/glob/clock overrides.
 * @returns A discriminated outcome describing success or the specific failure that occurred.
 */
export async function buildActionsManifest(input: BuildActionsManifestInput): Promise<BuildActionsManifestOutcome> {
  const { projectRoot, generator, readFile = DEFAULT_READ_FILE, globber = DEFAULT_GLOBBER, now = () => new Date() } = input;

  const configPath = resolve(projectRoot, ACTIONS_SCAN_CONFIG_FILENAME);
  const packagePath = resolve(projectRoot, 'package.json');

  const configOutcome = await loadScanConfig(configPath, readFile);
  if (configOutcome.kind !== 'ok') return configOutcome.outcome;
  const scanSection = configOutcome.section;

  const packageOutcome = await loadPackageName(packagePath, readFile);
  if (packageOutcome.kind !== 'ok') return packageOutcome.outcome;
  const packageName = packageOutcome.packageName;

  const filePaths = await globber({ projectRoot, include: scanSection.include, exclude: scanSection.exclude ?? [] });

  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  for (const relPath of filePaths) {
    const absolute = resolve(projectRoot, relPath);
    const text = await readFile(absolute);
    project.createSourceFile(absolute, text, { overwrite: true });
  }

  const extractResult = extractActionEntries({ project });
  const moduleName = scanSection.module ?? packageName;
  const sourceLabel = scanSection.source ?? packageName;
  const entries: ActionEntry[] = extractResult.entries.map((entry) => assembleEntry({ entry, moduleName }));

  const manifest = {
    version: 1 as const,
    source: sourceLabel,
    module: moduleName,
    generatedAt: now().toISOString(),
    generator,
    entries
  };

  const validated = ActionManifest(manifest);
  let outcome: BuildActionsManifestOutcome;
  if (validated instanceof type.errors) {
    outcome = { kind: 'invalid-manifest', error: validated.summary };
  } else {
    const outPath = resolve(projectRoot, scanSection.out ?? DEFAULT_ACTIONS_SCAN_OUT_PATH);
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
type LoadScanConfigResult = { readonly kind: 'ok'; readonly section: ActionsScanSection } | { readonly kind: 'fail'; readonly outcome: Extract<BuildActionsManifestOutcome, { kind: 'no-config' | 'invalid-scan-config' }> };

async function loadScanConfig(configPath: string, readFile: BuildActionsReadFile): Promise<LoadScanConfigResult> {
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
      const validated = ActionsScanConfig(parsed);
      if (validated instanceof type.errors) {
        result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: validated.summary } };
      } else {
        result = { kind: 'ok', section: validated.actions };
      }
    } else {
      result = { kind: 'fail', outcome: { kind: 'invalid-scan-config', configPath, error: parseError } };
    }
  }
  return result;
}

interface AssembleEntryInput {
  readonly entry: ExtractedActionEntry;
  readonly moduleName: string;
}

function assembleEntry(input: AssembleEntryInput): ActionEntry {
  const { entry, moduleName } = input;
  let result: ActionEntry;
  switch (entry.role) {
    case 'directive':
      result = assembleDirective({ entry, moduleName });
      break;
    case 'store':
      result = assembleStore({ entry, moduleName });
      break;
    case 'state':
      result = assembleState({ entry, moduleName });
      break;
  }
  return result;
}

function assembleDirective(input: { readonly entry: ExtractedActionDirective; readonly moduleName: string }): ActionDirectiveEntry {
  const { entry, moduleName } = input;
  return {
    role: 'directive',
    slug: entry.slug,
    selector: entry.selector,
    className: entry.className,
    module: moduleName,
    description: entry.description,
    skillRefs: [...entry.skillRefs],
    inputs: entry.inputs.map((i) => ({ ...i })),
    outputs: entry.outputs.map((o) => ({ ...o })),
    producesContext: entry.producesContext,
    consumesContext: entry.consumesContext,
    stateInteraction: [...entry.stateInteraction],
    example: entry.example
  };
}

function assembleStore(input: { readonly entry: ExtractedActionStore; readonly moduleName: string }): ActionStoreEntry {
  const { entry, moduleName } = input;
  return {
    role: 'store',
    slug: entry.slug,
    className: entry.className,
    module: moduleName,
    description: entry.description,
    skillRefs: [...entry.skillRefs],
    methods: entry.methods.map((m) => ({ ...m })),
    observables: entry.observables.map((o) => ({ ...o })),
    disabledKeyDefaults: [...entry.disabledKeyDefaults],
    example: entry.example
  };
}

function assembleState(input: { readonly entry: ExtractedActionState; readonly moduleName: string }): ActionStateEntry {
  const { entry, moduleName } = input;
  return {
    role: 'state',
    slug: entry.slug,
    enumName: 'DbxActionState',
    stateValue: entry.stateValue,
    literal: entry.literal,
    module: moduleName,
    description: entry.description,
    skillRefs: [...entry.skillRefs],
    transitionsFrom: [...entry.transitionsFrom],
    transitionsTo: [...entry.transitionsTo],
    example: entry.example
  };
}

/**
 * Serializes a validated action manifest as pretty-printed JSON terminated with a newline.
 *
 * @param manifest - The validated action manifest to serialize.
 * @returns A JSON string suitable for writing to disk.
 */
export function serializeActionManifest(manifest: ActionManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
