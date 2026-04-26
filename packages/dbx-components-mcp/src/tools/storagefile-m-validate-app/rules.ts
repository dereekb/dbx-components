/**
 * Validation rules applied against an {@link ExtractedAppStorageFiles}.
 * Rules accumulate {@link Violation}s into a mutable buffer; the
 * public entry point is {@link validateAppStorageFiles} in `./index.ts`.
 *
 * Pairing strategy: a `*_PURPOSE` constant `WORKER_PHOTO_PURPOSE` is
 * paired with a `*_UPLOADED_FILE_TYPE_IDENTIFIER` constant whose name
 * shares the prefix before `_PURPOSE` — i.e.
 * `WORKER_PHOTO_UPLOADED_FILE_TYPE_IDENTIFIER`. Same prefix is used
 * to associate `<purpose>FileGroupIds` /
 * `<purpose>StorageFileGroupIds` helper functions and
 * `<Foo>ProcessingSubtask` union aliases.
 */

import type { AppStorageFilesInspection, ExtractedAppStorageFiles, ExtractedPurposeConstant, ExtractedUploadInitializerEntry, ExtractedUploadedFileTypeIdentifierConstant, Violation, ViolationSeverity } from './types.js';

const PURPOSE_SUFFIX = '_PURPOSE';
const FILE_TYPE_IDENTIFIER_SUFFIX = '_UPLOADED_FILE_TYPE_IDENTIFIER';
const GROUP_IDS_FUNCTION_SUFFIXES: readonly string[] = ['StorageFileGroupIds', 'FileGroupIds'];

/**
 * Applies every cross-file storage-file rule and returns the aggregated
 * diagnostics. I/O-level rules (missing folders) short-circuit content checks
 * so the report stays focused on the root cause.
 *
 * @param inspection - the on-disk snapshot used for I/O-level rules
 * @param extracted - the pre-extracted facts the content rules consume
 * @returns the violations the rules emit for the snapshot
 */
export function runRules(inspection: AppStorageFilesInspection, extracted: ExtractedAppStorageFiles): readonly Violation[] {
  const violations: Violation[] = [];

  // I/O rules short-circuit content checks.
  if (inspection.component.status === 'dir-not-found') {
    pushViolation(violations, {
      code: 'STORAGEFILE_COMPONENT_DIR_NOT_FOUND',
      message: `Component directory \`${inspection.component.rootDir}\` does not exist.`,
      side: 'component',
      file: undefined
    });
  } else if (inspection.component.status === 'folder-missing') {
    pushViolation(violations, {
      code: 'STORAGEFILE_COMPONENT_FOLDER_MISSING',
      message: `Component is missing \`src/lib/model/storagefile/\` (looked under \`${inspection.component.rootDir}\`).`,
      side: 'component',
      file: undefined
    });
  }
  if (inspection.api.status === 'dir-not-found') {
    pushViolation(violations, {
      code: 'STORAGEFILE_API_DIR_NOT_FOUND',
      message: `API directory \`${inspection.api.rootDir}\` does not exist.`,
      side: 'api',
      file: undefined
    });
  } else if (inspection.api.status === 'folder-missing') {
    pushViolation(violations, {
      code: 'STORAGEFILE_API_FOLDER_MISSING',
      message: `API is missing \`src/app/common/model/storagefile/\` and \`src/app/common/model/notification/\` (looked under \`${inspection.api.rootDir}\`).`,
      side: 'api',
      file: undefined
    });
  }
  if (inspection.component.status !== 'ok' || inspection.api.status !== 'ok') {
    return violations;
  }

  checkPurposePairing(extracted, violations);
  checkUploadService(extracted, violations);
  checkProcessingHandler(extracted, violations);
  checkDuplicates(extracted, violations);
  checkGroupIdsFunctions(extracted, violations);

  return violations;
}

// MARK: Purpose pairing
function checkPurposePairing(extracted: ExtractedAppStorageFiles, violations: Violation[]): void {
  const fileTypePrefixes = new Set<string>();
  for (const c of extracted.fileTypeIdentifierConstants) {
    fileTypePrefixes.add(prefixBefore(c.symbolName, FILE_TYPE_IDENTIFIER_SUFFIX) ?? c.symbolName);
  }

  for (const purpose of extracted.purposeConstants) {
    const prefix = prefixBefore(purpose.symbolName, PURPOSE_SUFFIX);
    if (!prefix) continue;
    if (!fileTypePrefixes.has(prefix)) {
      pushViolation(violations, {
        code: 'STORAGEFILE_PURPOSE_MISSING_FILE_TYPE_IDENTIFIER',
        message: `Purpose \`${purpose.symbolName}\` has no matching \`UploadedFileTypeIdentifier\` constant. Declare \`${prefix}${FILE_TYPE_IDENTIFIER_SUFFIX}: UploadedFileTypeIdentifier = '...'\` alongside it.`,
        side: 'component',
        file: purpose.sourceFile
      });
    }
  }
}

// MARK: Upload service
function checkUploadService(extracted: ExtractedAppStorageFiles, violations: Violation[]): void {
  if (extracted.fileTypeIdentifierConstants.length === 0) return;

  if (extracted.uploadServiceCalls.length === 0) {
    pushViolation(violations, {
      code: 'STORAGEFILE_UPLOAD_SERVICE_FACTORY_MISSING',
      message: `No \`storageFileInitializeFromUploadService(...)\` call found in the API. Declare a factory whose return value is built from \`storageFileInitializeFromUploadService({ initializer: [...] })\`.`,
      side: 'api',
      file: undefined
    });
    return;
  }
  if (extracted.uploadServiceCalls.length > 1) {
    pushViolation(violations, {
      code: 'STORAGEFILE_UPLOAD_SERVICE_MULTIPLE_FACTORIES',
      severity: 'warning',
      message: `Found ${extracted.uploadServiceCalls.length} \`storageFileInitializeFromUploadService(...)\` calls in the API. Prefer one factory per app — the first call's config is what runtime uses.`,
      side: 'api',
      file: undefined
    });
  }

  flagUnresolvedUploadSpreads(extracted, violations);
  flagUploadInitializerOrphans(extracted, violations);
  flagUploadCoverageGaps(extracted, violations);
  flagUploadServiceWiring(extracted, violations);
}

/**
 * Flags any spread element inside `storageFileInitializeFromUploadService({ initializer })`
 * whose target identifier could not be resolved to an array binding or factory
 * call (and isn't trust-listed).
 *
 * @param extracted - the validator extraction
 * @param violations - the mutable violations buffer to append to
 */
function flagUnresolvedUploadSpreads(extracted: ExtractedAppStorageFiles, violations: Violation[]): void {
  for (const call of extracted.uploadServiceCalls) {
    for (const unresolved of call.unresolvedSpreadIdentifiers) {
      if (extracted.trustedExternalIdentifiers.has(unresolved)) continue;
      pushViolation(violations, {
        code: 'STORAGEFILE_UPLOAD_SERVICE_SPREAD_UNRESOLVED',
        severity: 'warning',
        message: `Spread \`...${unresolved}\` inside \`storageFileInitializeFromUploadService({ initializer })\` does not resolve to a declared array binding or sub-factory call. Declare the array or import it from a trusted \`@dereekb/*\` package.`,
        side: 'api',
        file: call.sourceFile
      });
    }
  }
}

/**
 * Flags every initializer whose `type:` field references an identifier that
 * isn't a declared `UploadedFileTypeIdentifier` constant or trust-listed name.
 *
 * @param extracted - the validator extraction
 * @param violations - the mutable violations buffer to append to
 */
function flagUploadInitializerOrphans(extracted: ExtractedAppStorageFiles, violations: Violation[]): void {
  const fileTypeNames = new Set(extracted.fileTypeIdentifierConstants.map((c) => c.symbolName));
  for (const entry of extracted.uploadInitializerEntries) {
    if (fileTypeNames.has(entry.typeIdentifier)) continue;
    if (extracted.trustedExternalIdentifiers.has(entry.typeIdentifier)) continue;
    pushViolation(violations, {
      code: 'STORAGEFILE_UPLOAD_INITIALIZER_ORPHAN',
      message: `Upload initializer \`${entry.bindingName ?? '<anonymous>'}\` references \`type: ${entry.typeIdentifier}\`, but no such \`UploadedFileTypeIdentifier\` constant is declared in the component.`,
      side: 'api',
      file: entry.sourceFile
    });
  }
}

/**
 * Flags coverage gaps where a declared `UploadedFileTypeIdentifier` constant
 * has no reachable initializer in any `storageFileInitializeFromUploadService`
 * call. When an unreachable initializer literal exists for that type, a more
 * actionable name-mismatch violation is emitted instead.
 *
 * @param extracted - the validator extraction
 * @param violations - the mutable violations buffer to append to
 */
function flagUploadCoverageGaps(extracted: ExtractedAppStorageFiles, violations: Violation[]): void {
  const reachableBindings = new Set<string>();
  for (const call of extracted.uploadServiceCalls) {
    for (const name of call.resolvedInitializerBindings) reachableBindings.add(name);
  }
  const reachableTypeIdentifiers = new Set<string>();
  for (const entry of extracted.uploadInitializerEntries) {
    if (entry.bindingName && reachableBindings.has(entry.bindingName)) {
      reachableTypeIdentifiers.add(entry.typeIdentifier);
    }
  }

  const entriesByType = new Map<string, typeof extracted.uploadInitializerEntries>();
  for (const entry of extracted.uploadInitializerEntries) {
    const list = entriesByType.get(entry.typeIdentifier);
    if (list) {
      (list as ExtractedUploadInitializerEntry[]).push(entry);
    } else {
      entriesByType.set(entry.typeIdentifier, [entry]);
    }
  }

  for (const c of extracted.fileTypeIdentifierConstants) {
    if (reachableTypeIdentifiers.has(c.symbolName)) continue;
    const entries = entriesByType.get(c.symbolName);
    if (entries && entries.length > 0) {
      const entry = entries[0];
      const bindingHint = entry.bindingName ? `\`${entry.bindingName}\`` : '<anonymous>';
      pushViolation(violations, {
        code: 'STORAGEFILE_UPLOAD_INITIALIZER_NAME_MISMATCH',
        message: `Initializer ${bindingHint} in \`${entry.sourceFile}\` declares \`type: ${c.symbolName}\` but is not reachable from \`storageFileInitializeFromUploadService({ initializer })\` because no array element resolves to that binding name. The cross-file tracer matches by identifier name through function returns — when a factory function ships an initializer, its inner variable name must match the call-site binding name (and the array element/spread that references it).`,
        side: 'api',
        file: entry.sourceFile
      });
      continue;
    }
    pushViolation(violations, {
      code: 'STORAGEFILE_PURPOSE_NOT_IN_UPLOAD_SERVICE',
      message: `\`${c.symbolName}\` has no \`StorageFileInitializeFromUploadServiceInitializer\` reachable from any \`storageFileInitializeFromUploadService(...)\` call. Add an initializer with \`type: ${c.symbolName}\` and include it in the \`initializer\` array.`,
      side: 'api',
      file: undefined
    });
  }
}

/**
 * Verifies that at least one NestJS provider wires the upload-service factory
 * via `useFactory: <factoryName>`. Trust-listed factory names also count.
 *
 * @param extracted - the validator extraction
 * @param violations - the mutable violations buffer to append to
 */
function flagUploadServiceWiring(extracted: ExtractedAppStorageFiles, violations: Violation[]): void {
  const factoryNames = new Set<string>();
  for (const call of extracted.uploadServiceCalls) {
    if (call.enclosingFactoryName) factoryNames.add(call.enclosingFactoryName);
  }
  const wiredFactoryNames = new Set<string>();
  for (const wiring of extracted.uploadServiceWirings) {
    if (wiring.useFactoryIdentifier) wiredFactoryNames.add(wiring.useFactoryIdentifier);
  }
  let anyWired = false;
  for (const name of factoryNames) {
    if (wiredFactoryNames.has(name) || extracted.trustedExternalIdentifiers.has(name)) {
      anyWired = true;
      break;
    }
  }
  if (!anyWired) {
    pushViolation(violations, {
      code: 'STORAGEFILE_UPLOAD_SERVICE_NOT_WIRED',
      message: `No NestJS provider with \`provide: StorageFileInitializeFromUploadService, useFactory: ${factoryNames.size > 0 ? [...factoryNames].join(' | ') : '<storage-file-upload-factory>'}\` found. Bind the factory function in a NestJS module.`,
      side: 'api',
      file: undefined
    });
  }
}

// MARK: Processing handler
function checkProcessingHandler(extracted: ExtractedAppStorageFiles, violations: Violation[]): void {
  const purposesWithSubtasks = collectPurposesWithSubtasks(extracted);
  if (purposesWithSubtasks.size === 0) return;

  if (extracted.processingHandlerCalls.length === 0) {
    pushViolation(violations, {
      code: 'STORAGEFILE_PROCESSING_HANDLER_MISSING',
      message: `No \`storageFileProcessingNotificationTaskHandler({ processors })\` call found in the API, but the component declares ${purposesWithSubtasks.size} purpose(s) with processing subtasks. Wire the processing handler so subtask flows are reachable.`,
      side: 'api',
      file: undefined
    });
  }

  const purposeNames = new Set(extracted.purposeConstants.map((c) => c.symbolName));
  const configsByPurpose = new Map<string, (typeof extracted.processingConfigs)[number]>();
  for (const config of extracted.processingConfigs) {
    if (!purposeNames.has(config.targetIdentifier) && !extracted.trustedExternalIdentifiers.has(config.targetIdentifier)) {
      pushViolation(violations, {
        code: 'STORAGEFILE_PROCESSING_CONFIG_ORPHAN',
        message: `Processing config references \`target: ${config.targetIdentifier}\`, but no such \`StorageFilePurpose\` constant is declared in the component.`,
        side: 'api',
        file: config.sourceFile
      });
      continue;
    }
    configsByPurpose.set(config.targetIdentifier, config);
  }

  for (const [purposeName, subtaskNames] of purposesWithSubtasks) {
    const config = configsByPurpose.get(purposeName);
    if (!config) {
      pushViolation(violations, {
        code: 'STORAGEFILE_PROCESSING_CONFIG_MISSING',
        message: `Purpose \`${purposeName}\` declares processing subtasks but has no \`StorageFileProcessingPurposeSubtaskProcessorConfig\` whose \`target:\` references it. Add a config that lists every subtask in its \`flow:\` array.`,
        side: 'api',
        file: undefined
      });
      continue;
    }
    const handledSubtasks = new Set(config.flowSubtaskIdentifiers);
    for (const subtask of subtaskNames) {
      if (!handledSubtasks.has(subtask)) {
        pushViolation(violations, {
          code: 'STORAGEFILE_PROCESSING_SUBTASK_NOT_HANDLED',
          message: `Subtask \`${subtask}\` is declared for purpose \`${purposeName}\` but is not present as a \`subtask:\` entry in the matching processor config's \`flow:\` array. Add a flow step for it.`,
          side: 'api',
          file: config.sourceFile
        });
      }
    }
  }
}

function collectPurposesWithSubtasks(extracted: ExtractedAppStorageFiles): Map<string, readonly string[]> {
  const aliasStems = new Set<string>();
  for (const alias of extracted.processingSubtaskAliases) {
    const stem = alias.symbolName.endsWith('ProcessingSubtask') ? alias.symbolName.slice(0, -'ProcessingSubtask'.length) : alias.symbolName;
    aliasStems.add(toScreamingSnake(stem));
  }

  // A purpose has subtasks if a `*_PROCESSING_SUBTASK`-typed constant's name
  // starts with `<PURPOSE_CONST_NAME>_`, AND an alias whose pascal-stem
  // converted to screaming snake case shares a prefix with the purpose's
  // own prefix exists (best-effort sanity check).
  const result = new Map<string, readonly string[]>();
  for (const purpose of extracted.purposeConstants) {
    const purposePrefix = prefixBefore(purpose.symbolName, PURPOSE_SUFFIX);
    if (!purposePrefix) continue;
    const subtaskNames: string[] = [];
    for (const c of extracted.processingSubtaskConstants) {
      if (c.symbolName.startsWith(`${purpose.symbolName}_`)) {
        subtaskNames.push(c.symbolName);
      }
    }
    if (subtaskNames.length === 0) continue;
    let aliasMatch = false;
    for (const stemScreaming of aliasStems) {
      if (purposePrefix.startsWith(stemScreaming) || stemScreaming.startsWith(purposePrefix)) {
        aliasMatch = true;
        break;
      }
    }
    if (!aliasMatch) continue;
    result.set(purpose.symbolName, subtaskNames);
  }
  return result;
}

// MARK: Duplicates
function checkDuplicates(extracted: ExtractedAppStorageFiles, violations: Violation[]): void {
  flagDuplicates({ entries: extracted.purposeConstants.map(toCodeRef), code: 'STORAGEFILE_PURPOSE_DUPLICATE', label: '`StorageFilePurpose`', violations });
  flagDuplicates({ entries: extracted.fileTypeIdentifierConstants.map(toCodeRef), code: 'STORAGEFILE_FILE_TYPE_IDENTIFIER_DUPLICATE', label: '`UploadedFileTypeIdentifier`', violations });
}

function toCodeRef(entry: ExtractedPurposeConstant | ExtractedUploadedFileTypeIdentifierConstant): { readonly symbolName: string; readonly code: string | undefined; readonly sourceFile: string } {
  const code = 'purposeCode' in entry ? entry.purposeCode : entry.typeCode;
  return { symbolName: entry.symbolName, code, sourceFile: entry.sourceFile };
}

/**
 * Options for flagging duplicate code values across constants.
 */
interface FlagDuplicatesOptions {
  readonly entries: readonly { readonly symbolName: string; readonly code: string | undefined; readonly sourceFile: string }[];
  readonly code: 'STORAGEFILE_PURPOSE_DUPLICATE' | 'STORAGEFILE_FILE_TYPE_IDENTIFIER_DUPLICATE';
  readonly label: string;
  readonly violations: Violation[];
}

function flagDuplicates(options: FlagDuplicatesOptions): void {
  const { entries, code, label, violations } = options;
  const seen = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.code) continue;
    const previous = seen.get(entry.code);
    if (previous) {
      pushViolation(violations, {
        code,
        severity: 'warning',
        message: `${label} value \`'${entry.code}'\` is shared by \`${previous}\` and \`${entry.symbolName}\`. Choose unique string literals.`,
        side: 'component',
        file: entry.sourceFile
      });
    } else {
      seen.set(entry.code, entry.symbolName);
    }
  }
}

// MARK: Group-ids functions
function checkGroupIdsFunctions(extracted: ExtractedAppStorageFiles, violations: Violation[]): void {
  if (extracted.purposeConstants.length === 0) return;
  const fnPrefixes = new Set<string>();
  for (const fn of extracted.groupIdsFunctions) {
    const prefix = stripGroupIdsSuffix(fn.symbolName);
    fnPrefixes.add(prefix);
  }
  for (const purpose of extracted.purposeConstants) {
    const prefix = prefixBefore(purpose.symbolName, PURPOSE_SUFFIX);
    if (!prefix) continue;
    const camel = toCamelCase(prefix);
    let matched = false;
    for (const fnPrefix of fnPrefixes) {
      if (fnPrefix === camel || fnPrefix.startsWith(camel) || camel.startsWith(fnPrefix)) {
        matched = true;
        break;
      }
    }
    if (matched) continue;
    pushViolation(violations, {
      code: 'STORAGEFILE_GROUP_IDS_FUNCTION_MISSING',
      severity: 'warning',
      message: `Purpose \`${purpose.symbolName}\` has no \`<purpose>FileGroupIds(...)\` or \`<purpose>StorageFileGroupIds(...)\` helper function. Convention: every purpose declares its group membership via a helper.`,
      side: 'component',
      file: purpose.sourceFile
    });
  }
}

// MARK: Helpers
function prefixBefore(name: string, suffix: string): string | undefined {
  if (!name.endsWith(suffix)) return undefined;
  return name.slice(0, -suffix.length);
}

function stripGroupIdsSuffix(name: string): string {
  for (const suffix of GROUP_IDS_FUNCTION_SUFFIXES) {
    if (name.endsWith(suffix)) {
      return name.slice(0, -suffix.length);
    }
  }
  return name;
}

function toCamelCase(screaming: string): string {
  const parts = screaming.split('_').filter((p) => p.length > 0);
  let result = '';
  for (const [i, part_] of parts.entries()) {
    const part = part_.toLowerCase();
    if (i === 0) {
      result += part;
    } else {
      result += part.charAt(0).toUpperCase() + part.slice(1);
    }
  }
  return result;
}

function toScreamingSnake(camelOrPascal: string): string {
  let out = '';
  for (let i = 0; i < camelOrPascal.length; i += 1) {
    const ch = camelOrPascal.charAt(i);
    const isUpper = ch >= 'A' && ch <= 'Z';
    if (isUpper && i > 0) {
      out += '_';
    }
    out += ch.toUpperCase();
  }
  return out;
}

function pushViolation(buffer: Violation[], violation: Omit<Violation, 'severity'> & { readonly severity?: ViolationSeverity }): void {
  const severity: ViolationSeverity = violation.severity ?? 'error';
  const filled: Violation = {
    code: violation.code,
    severity,
    message: violation.message,
    side: violation.side,
    file: violation.file
  };
  buffer.push(filled);
}
