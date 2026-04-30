/**
 * Generic engine for the two-side (component + API) folder validators.
 *
 * Each domain — `dbx_notification_m_validate_folder` and
 * `dbx_storagefile_m_validate_folder` — supplies a
 * {@link TwoSideFolderValidatorConfig}: the file-name prefix, the
 * component / API subpaths, and the seven domain-specific
 * `ViolationCode` literal strings the rules engine emits. The engine
 * carries `TCode` through {@link TwoSideFolderViolation} so per-domain
 * specs continue to assert on the exact `'NOTIF_FOLDER_*'` /
 * `'STORAGEFILE_FOLDER_*'` strings.
 *
 * Filesystem access is encapsulated in
 * {@link TwoSideFolderValidator.inspect}; pure rules then run against
 * the resulting {@link TwoSideFolderInspection} via
 * {@link TwoSideFolderValidator.validate}, mirroring the original
 * per-domain `inspect.ts` + `rules.ts` split (now collapsed here).
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { attachRemediation } from './rule-catalog/index.js';
import type { RemediationHint } from './rule-catalog/types.js';
import type { ViolationSeverity } from './validate-format.js';

export type { ViolationSeverity } from './validate-format.js';

/**
 * Side of a two-directory validator. `component` = the `-firebase`
 * package; `api` = the API app that wires the services.
 */
export type TwoSideValidationSide = 'component' | 'api';

/**
 * Per-side filesystem status surfaced by {@link inspectSide}.
 */
export type SideStatus = 'ok' | 'dir-not-found' | 'folder-missing';

/**
 * Inspection of one side (component or API) of a two-side folder. The
 * {@link TwoSideFolderValidator.inspect} function populates
 * {@link files}, {@link entries}, and {@link indexSource} via
 * `node:fs/promises`; specs build inspections directly without
 * touching the disk.
 */
export interface SideInspection {
  /**
   * Side name. Used in violation messages.
   */
  readonly side: TwoSideValidationSide;
  /**
   * Path supplied by the caller (e.g. `components/demo-firebase`).
   */
  readonly rootDir: string;
  /**
   * Relative path of the model folder under {@link rootDir} (e.g. `src/lib/model/notification`).
   */
  readonly subPath: string;
  readonly status: SideStatus;
  /**
   * `.ts` file basenames at the model folder root.
   */
  readonly files: readonly string[];
  /**
   * Direct subdirectory names at the model folder root (used to flag `handlers/`).
   */
  readonly entries: readonly string[];
  /**
   * Contents of `index.ts` when present at the folder root; `undefined` otherwise.
   */
  readonly indexSource: string | undefined;
}

/**
 * Snapshot of both sides of a two-side folder ready for the rules
 * engine. Specs build this directly; the
 * {@link TwoSideFolderValidator.inspect} function builds it off disk.
 */
export interface TwoSideFolderInspection {
  readonly componentDir: string;
  readonly apiDir: string;
  readonly component: SideInspection;
  readonly api: SideInspection;
}

/**
 * A single violation emitted by the rules engine. `TCode` carries the
 * per-domain literal `ViolationCode` union through to the result.
 */
export interface TwoSideFolderViolation<TCode extends string> {
  readonly code: TCode;
  readonly severity: ViolationSeverity;
  readonly message: string;
  readonly side: TwoSideValidationSide;
  readonly file: string | undefined;
  /**
   * Auto-attached remediation hint pulled from the rule catalog at
   * emission time. `undefined` when no catalog entry exists for the
   * code (the formatter renders no nested block in that case).
   */
  readonly remediation?: RemediationHint;
}

/**
 * Aggregated outcome returned by {@link TwoSideFolderValidator.validate}.
 */
export interface TwoSideFolderValidationResult<TCode extends string> {
  readonly violations: readonly TwoSideFolderViolation<TCode>[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly componentDir: string;
  readonly apiDir: string;
}

/**
 * One required file at the API root for a given domain. The engine
 * emits {@link RequiredApiFile.code} naming the file when it is absent.
 */
export interface RequiredApiFile<TCode extends string> {
  readonly filename: string;
  readonly code: TCode;
  readonly role: string;
}

/**
 * Input for {@link TwoSideFolderValidator.inspect}. Both absolute roots
 * are stat-checked; the relative paths flow into violation messages.
 */
export interface InspectTwoSideFolderInput {
  readonly componentRootDir: string;
  readonly componentRelDir: string;
  readonly apiRootDir: string;
  readonly apiRelDir: string;
}

/**
 * The seven shared rule kinds, mapped to the concrete `TCode` literal
 * strings each domain owns.
 */
export interface TwoSideFolderRuleCodes<TCode extends string> {
  readonly componentDirNotFound: TCode;
  readonly apiDirNotFound: TCode;
  readonly componentFolderMissing: TCode;
  readonly apiFolderMissing: TCode;
  readonly barrelReexportMissing: TCode;
  readonly unexpectedFileName: TCode;
  readonly handlersSubfolderMixed: TCode;
}

/**
 * Per-domain configuration for {@link createTwoSideFolderValidator}.
 */
export interface TwoSideFolderValidatorConfig<TCode extends string> {
  /**
   * Capitalised label used in the folder-missing message and the
   * unexpected-file-name warning (e.g. `'Notification'`, `'Storagefile'`).
   */
  readonly fileLabel: string;
  /**
   * Lower-case label used in the handlers-subfolder-mix warning
   * (e.g. `'notification'`, `'storagefile'`).
   */
  readonly lowerLabel: string;
  /**
   * Prefix every domain `.ts` file should start with (e.g. `'notification.'`).
   */
  readonly filePrefix: string;
  /**
   * Component-side relative path from the package root (e.g. `'src/lib/model/notification'`).
   */
  readonly componentSubPath: string;
  /**
   * API-side relative path from the app root (e.g. `'src/app/common/model/notification'`).
   */
  readonly apiSubPath: string;
  /**
   * Subfolder name flagged when alongside non-canonical root files
   * (typically `'handlers'`).
   */
  readonly handlersSubfolderName: string;
  /**
   * Barrel filename (typically `'index.ts'`).
   */
  readonly indexFile: string;
  readonly requiredApiFiles: readonly RequiredApiFile<TCode>[];
  readonly canonicalApiRootFiles: readonly string[];
  readonly codes: TwoSideFolderRuleCodes<TCode>;
}

/**
 * Pair of pure entry points for one domain's two-side folder validator.
 */
export interface TwoSideFolderValidator<TCode extends string> {
  readonly inspect: (input: InspectTwoSideFolderInput) => Promise<TwoSideFolderInspection>;
  readonly validate: (inspection: TwoSideFolderInspection) => TwoSideFolderValidationResult<TCode>;
}

const REEXPORT_PATTERN = /^\s*export\s+\*\s+from\s+['"]\.\/([^'"\n]+)['"]\s*;?\s*$/gm;

/**
 * Builds the inspect + validate pair for one domain. The returned
 * functions match the original per-domain `inspectXFolder` /
 * `validateXFolder` signatures so callers (tool wrappers, specs) need
 * no edits beyond the import path.
 *
 * @param config - the domain-specific labels, paths, and codes
 * @returns the bound {@link TwoSideFolderValidator}
 */
export function createTwoSideFolderValidator<TCode extends string>(config: TwoSideFolderValidatorConfig<TCode>): TwoSideFolderValidator<TCode> {
  async function inspect(input: InspectTwoSideFolderInput): Promise<TwoSideFolderInspection> {
    const component = await inspectSide({ side: 'component', rootDir: input.componentRootDir, relDir: input.componentRelDir, subPath: config.componentSubPath, indexFile: config.indexFile });
    const api = await inspectSide({ side: 'api', rootDir: input.apiRootDir, relDir: input.apiRelDir, subPath: config.apiSubPath, indexFile: config.indexFile });
    const result: TwoSideFolderInspection = {
      componentDir: input.componentRelDir,
      apiDir: input.apiRelDir,
      component,
      api
    };
    return result;
  }

  function validate(inspection: TwoSideFolderInspection): TwoSideFolderValidationResult<TCode> {
    const violations = runRules(config, inspection);
    let errorCount = 0;
    let warningCount = 0;
    for (const v of violations) {
      if (v.severity === 'error') {
        errorCount += 1;
      } else {
        warningCount += 1;
      }
    }
    const result: TwoSideFolderValidationResult<TCode> = {
      violations,
      errorCount,
      warningCount,
      componentDir: inspection.componentDir,
      apiDir: inspection.apiDir
    };
    return result;
  }

  return { inspect, validate };
}

// MARK: Inspection
interface InspectSideInput {
  readonly side: TwoSideValidationSide;
  readonly rootDir: string;
  readonly relDir: string;
  readonly subPath: string;
  readonly indexFile: string;
}

async function inspectSide(input: InspectSideInput): Promise<SideInspection> {
  const { side, rootDir, relDir, subPath, indexFile } = input;
  let status: SideStatus = 'ok';
  let files: readonly string[] = [];
  let entries: readonly string[] = [];
  let indexSource: string | undefined;

  const rootStatOk = await isExistingDirectory(rootDir);
  if (rootStatOk) {
    const absFolder = join(rootDir, subPath);
    const folderStatOk = await isExistingDirectory(absFolder);
    if (folderStatOk) {
      const folder = await readFolder(absFolder, indexFile);
      files = folder.files;
      entries = folder.entries;
      indexSource = folder.indexSource;
    } else {
      status = 'folder-missing';
    }
  } else {
    status = 'dir-not-found';
  }

  const result: SideInspection = {
    side,
    rootDir: relDir,
    subPath,
    status,
    files,
    entries,
    indexSource
  };
  return result;
}

async function isExistingDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      throw err;
    }
    return false;
  }
}

interface ReadFolderResult {
  readonly files: readonly string[];
  readonly entries: readonly string[];
  readonly indexSource: string | undefined;
}

async function readFolder(absFolder: string, indexFile: string): Promise<ReadFolderResult> {
  const direntList = await readdir(absFolder, { withFileTypes: true });
  const collectedFiles: string[] = [];
  const collectedEntries: string[] = [];
  for (const entry of direntList) {
    if (entry.isDirectory()) {
      collectedEntries.push(entry.name);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts')) continue;
    collectedFiles.push(entry.name);
  }
  let indexSource: string | undefined;
  if (collectedFiles.includes(indexFile)) {
    try {
      indexSource = await readFile(join(absFolder, indexFile), 'utf8');
    } catch {
      indexSource = undefined;
    }
  }
  return { files: collectedFiles, entries: collectedEntries, indexSource };
}

// MARK: Rules
function runRules<TCode extends string>(config: TwoSideFolderValidatorConfig<TCode>, inspection: TwoSideFolderInspection): readonly TwoSideFolderViolation<TCode>[] {
  const violations: TwoSideFolderViolation<TCode>[] = [];
  const { codes } = config;
  checkSidePresence({ side: inspection.component, violations, dirCode: codes.componentDirNotFound, folderCode: codes.componentFolderMissing, subPath: config.componentSubPath, fileLabel: config.fileLabel });
  checkSidePresence({ side: inspection.api, violations, dirCode: codes.apiDirNotFound, folderCode: codes.apiFolderMissing, subPath: config.apiSubPath, fileLabel: config.fileLabel });

  if (inspection.component.status === 'ok') {
    checkComponent(config, inspection.component, violations);
  }
  if (inspection.api.status === 'ok') {
    checkApi(config, inspection.api, violations);
  }
  return violations;
}

interface CheckSidePresenceOptions<TCode extends string> {
  readonly side: SideInspection;
  readonly violations: TwoSideFolderViolation<TCode>[];
  readonly dirCode: TCode;
  readonly folderCode: TCode;
  readonly subPath: string;
  readonly fileLabel: string;
}

function checkSidePresence<TCode extends string>(options: CheckSidePresenceOptions<TCode>): void {
  const { side, violations, dirCode, folderCode, subPath, fileLabel } = options;
  if (side.status === 'dir-not-found') {
    pushViolation(violations, {
      code: dirCode,
      message: `${side.side === 'component' ? 'Component' : 'API'} directory \`${side.rootDir}\` does not exist or is not a directory.`,
      side: side.side,
      file: undefined
    });
  } else if (side.status === 'folder-missing') {
    pushViolation(violations, {
      code: folderCode,
      message: `${fileLabel} folder \`${subPath}\` is missing under \`${side.rootDir}\`.`,
      side: side.side,
      file: undefined
    });
  }
}

function checkComponent<TCode extends string>(config: TwoSideFolderValidatorConfig<TCode>, side: SideInspection, violations: TwoSideFolderViolation<TCode>[]): void {
  checkUnexpectedFileNames(config, side, violations);
  checkBarrelReexports(config, side, violations);
}

function checkApi<TCode extends string>(config: TwoSideFolderValidatorConfig<TCode>, side: SideInspection, violations: TwoSideFolderViolation<TCode>[]): void {
  checkRequiredApiFiles(config, side, violations);
  checkUnexpectedFileNames(config, side, violations);
  checkHandlersSubfolderMix(config, side, violations);
  checkBarrelReexports(config, side, violations);
}

function checkRequiredApiFiles<TCode extends string>(config: TwoSideFolderValidatorConfig<TCode>, side: SideInspection, violations: TwoSideFolderViolation<TCode>[]): void {
  const present = new Set(side.files);
  for (const required of config.requiredApiFiles) {
    if (present.has(required.filename)) continue;
    pushViolation(violations, {
      code: required.code,
      message: `Missing \`${required.filename}\` (${required.role}) under \`${side.rootDir}/${side.subPath}\`.`,
      side: side.side,
      file: required.filename
    });
  }
}

function checkUnexpectedFileNames<TCode extends string>(config: TwoSideFolderValidatorConfig<TCode>, side: SideInspection, violations: TwoSideFolderViolation<TCode>[]): void {
  for (const file of side.files) {
    if (file === config.indexFile) continue;
    if (file.startsWith(config.filePrefix)) continue;
    pushViolation(violations, {
      code: config.codes.unexpectedFileName,
      severity: 'warning',
      message: `File \`${file}\` does not start with \`${config.filePrefix}\`. ${config.fileLabel}-folder files should be named \`${config.filePrefix}<sub>.ts\` to stay grouped.`,
      side: side.side,
      file
    });
  }
}

function checkHandlersSubfolderMix<TCode extends string>(config: TwoSideFolderValidatorConfig<TCode>, side: SideInspection, violations: TwoSideFolderViolation<TCode>[]): void {
  const hasHandlers = side.entries.includes(config.handlersSubfolderName);
  if (!hasHandlers) return;
  const canonical = new Set(config.canonicalApiRootFiles);
  for (const file of side.files) {
    if (file === config.indexFile) continue;
    if (canonical.has(file)) continue;
    pushViolation(violations, {
      code: config.codes.handlersSubfolderMixed,
      severity: 'warning',
      message: `File \`${file}\` lives at the ${config.lowerLabel} folder root alongside a \`${config.handlersSubfolderName}/\` subfolder. Move handler files into \`${config.handlersSubfolderName}/\` to keep the convention consistent.`,
      side: side.side,
      file
    });
  }
}

function checkBarrelReexports<TCode extends string>(config: TwoSideFolderValidatorConfig<TCode>, side: SideInspection, violations: TwoSideFolderViolation<TCode>[]): void {
  const source = side.indexSource;
  if (source === undefined) return;
  const fileSet = new Set(side.files);
  const entrySet = new Set(side.entries);
  const seen = new Set<string>();
  REEXPORT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = REEXPORT_PATTERN.exec(source);
  while (match !== null) {
    const target = match[1].replace(/\.js$/, '');
    const normalized = target.replace(/\/+$/, '');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      const fileMatch = `${normalized}.ts`;
      if (!fileSet.has(fileMatch) && !entrySet.has(normalized)) {
        pushViolation(violations, {
          code: config.codes.barrelReexportMissing,
          message: `\`${config.indexFile}\` re-exports \`./${target}\` but no matching \`./${normalized}.ts\` file or \`./${normalized}/\` subfolder exists at \`${side.rootDir}/${side.subPath}\`.`,
          side: side.side,
          file: config.indexFile
        });
      }
    }
    match = REEXPORT_PATTERN.exec(source);
  }
}

function pushViolation<TCode extends string>(buffer: TwoSideFolderViolation<TCode>[], violation: Omit<TwoSideFolderViolation<TCode>, 'severity' | 'remediation'> & { readonly severity?: ViolationSeverity }): void {
  const severity: ViolationSeverity = violation.severity ?? 'error';
  const filled: TwoSideFolderViolation<TCode> = {
    code: violation.code,
    severity,
    message: violation.message,
    side: violation.side,
    file: violation.file,
    remediation: attachRemediation(violation.code)
  };
  buffer.push(filled);
}
