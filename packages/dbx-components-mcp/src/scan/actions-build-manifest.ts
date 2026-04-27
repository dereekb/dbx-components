/**
 * Orchestrator for the `scan-actions` generator.
 *
 * Composes a complete {@link ActionManifest} from a project root by reading
 * `dbx-mcp.scan.json`, `package.json`, resolving include/exclude globs,
 * feeding files into a ts-morph project, extracting entries via
 * {@link extractActionEntries}, and assembling the manifest envelope.
 */

import { glob as fsGlob, readFile as nodeReadFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { type } from 'arktype';
import { Project } from 'ts-morph';
import { ActionManifest, type ActionDirectiveEntry, type ActionEntry, type ActionStateEntry, type ActionStoreEntry } from '../manifest/actions-schema.js';
import { extractActionEntries, type ExtractedActionDirective, type ExtractedActionEntry, type ExtractedActionState, type ExtractedActionStore, type ActionExtractWarning } from './actions-extract.js';
import { ACTIONS_SCAN_CONFIG_FILENAME, ActionsScanConfig, DEFAULT_ACTIONS_SCAN_OUT_PATH, type ActionsScanSection } from './actions-scan-config-schema.js';

// MARK: Public types
export type BuildActionsReadFile = (absolutePath: string) => Promise<string>;
export type BuildActionsGlobber = (input: { readonly projectRoot: string; readonly include: readonly string[]; readonly exclude: readonly string[] }) => Promise<readonly string[]>;

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

const DEFAULT_READ_FILE: BuildActionsReadFile = (path) => nodeReadFile(path, 'utf-8');

const DEFAULT_GLOBBER: BuildActionsGlobber = async (input) => {
  const { projectRoot, include, exclude } = input;
  const excludeMatchers = exclude.map(globToRegex);
  const seen = new Set<string>();
  const matches: string[] = [];
  for (const pattern of include) {
    for await (const match of fsGlob(pattern, { cwd: projectRoot })) {
      if (excludeMatchers.some((rx) => rx.test(match))) continue;
      if (!seen.has(match)) {
        seen.add(match);
        matches.push(match);
      }
    }
  }
  return matches;
};

// MARK: Entry point
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
  const entries: ActionEntry[] = extractResult.entries.map((entry) => assembleEntry({ entry, projectRoot, moduleName }));

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

type LoadPackageNameResult = { readonly kind: 'ok'; readonly packageName: string } | { readonly kind: 'fail'; readonly outcome: Extract<BuildActionsManifestOutcome, { kind: 'no-package' | 'invalid-package' }> };

async function loadPackageName(packagePath: string, readFile: BuildActionsReadFile): Promise<LoadPackageNameResult> {
  let raw: string | null = null;
  try {
    raw = await readFile(packagePath);
  } catch {
    raw = null;
  }
  let result: LoadPackageNameResult;
  if (raw === null) {
    result = { kind: 'fail', outcome: { kind: 'no-package', packagePath } };
  } else {
    let parsed: unknown;
    let parseError: string | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
    }
    if (parseError === null) {
      const name = (parsed as { readonly name?: unknown } | null | undefined)?.name;
      if (typeof name !== 'string' || name.length === 0) {
        result = { kind: 'fail', outcome: { kind: 'invalid-package', packagePath, error: 'package.json is missing a non-empty `name` field' } };
      } else {
        result = { kind: 'ok', packageName: name };
      }
    } else {
      result = { kind: 'fail', outcome: { kind: 'invalid-package', packagePath, error: parseError } };
    }
  }
  return result;
}

interface AssembleEntryInput {
  readonly entry: ExtractedActionEntry;
  readonly projectRoot: string;
  readonly moduleName: string;
}

function assembleEntry(input: AssembleEntryInput): ActionEntry {
  const { entry, projectRoot, moduleName } = input;
  const projectRelative = relative(projectRoot, entry.filePath).replaceAll('\\', '/');
  const sourcePath = projectRelative.replace(/^src\//, '');
  let result: ActionEntry;
  switch (entry.role) {
    case 'directive':
      result = assembleDirective({ entry, moduleName, sourcePath, projectRelative });
      break;
    case 'store':
      result = assembleStore({ entry, moduleName, sourcePath, projectRelative });
      break;
    case 'state':
      result = assembleState({ entry, moduleName, sourcePath, projectRelative });
      break;
  }
  return result;
}

function assembleDirective(input: { readonly entry: ExtractedActionDirective; readonly moduleName: string; readonly sourcePath: string; readonly projectRelative: string }): ActionDirectiveEntry {
  const { entry, moduleName, sourcePath, projectRelative } = input;
  return {
    role: 'directive',
    slug: entry.slug,
    selector: entry.selector,
    className: entry.className,
    module: moduleName,
    description: entry.description,
    skillRefs: [...entry.skillRefs],
    sourcePath,
    inputs: entry.inputs.map((i) => ({ ...i })),
    outputs: entry.outputs.map((o) => ({ ...o })),
    producesContext: entry.producesContext,
    consumesContext: entry.consumesContext,
    stateInteraction: [...entry.stateInteraction],
    example: entry.example,
    sourceLocation: { file: projectRelative, line: entry.line }
  };
}

function assembleStore(input: { readonly entry: ExtractedActionStore; readonly moduleName: string; readonly sourcePath: string; readonly projectRelative: string }): ActionStoreEntry {
  const { entry, moduleName, sourcePath, projectRelative } = input;
  return {
    role: 'store',
    slug: entry.slug,
    className: entry.className,
    module: moduleName,
    description: entry.description,
    skillRefs: [...entry.skillRefs],
    sourcePath,
    methods: entry.methods.map((m) => ({ ...m })),
    observables: entry.observables.map((o) => ({ ...o })),
    disabledKeyDefaults: [...entry.disabledKeyDefaults],
    example: entry.example,
    sourceLocation: { file: projectRelative, line: entry.line }
  };
}

function assembleState(input: { readonly entry: ExtractedActionState; readonly moduleName: string; readonly sourcePath: string; readonly projectRelative: string }): ActionStateEntry {
  const { entry, moduleName, sourcePath, projectRelative } = input;
  return {
    role: 'state',
    slug: entry.slug,
    enumName: 'DbxActionState',
    stateValue: entry.stateValue,
    literal: entry.literal,
    module: moduleName,
    description: entry.description,
    skillRefs: [...entry.skillRefs],
    sourcePath,
    transitionsFrom: [...entry.transitionsFrom],
    transitionsTo: [...entry.transitionsTo],
    example: entry.example,
    sourceLocation: { file: projectRelative, line: entry.line }
  };
}

function globToRegex(pattern: string): RegExp {
  let body = '';
  let index = 0;
  while (index < pattern.length) {
    const char = pattern[index];
    if (char === '*' && pattern[index + 1] === '*') {
      body += '.*';
      index += 2;
      if (pattern[index] === '/') index += 1;
    } else if (char === '*') {
      body += '[^/]*';
      index += 1;
    } else if (char === '?') {
      body += '[^/]';
      index += 1;
    } else if ('.+^${}()|[]\\'.includes(char)) {
      body += `\\${char}`;
      index += 1;
    } else {
      body += char;
      index += 1;
    }
  }
  return new RegExp(`^${body}$`);
}

export function serializeActionManifest(manifest: ActionManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
