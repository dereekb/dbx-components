/**
 * Consumes an {@link ExtractedAppStorageFiles} from the validator's
 * cross-file extractor and reshapes it into an
 * {@link AppStorageFilesReport} — no AST walk happens here.
 *
 * Pairing rules:
 * - A `*_PURPOSE` constant pairs with a `*_UPLOADED_FILE_TYPE_IDENTIFIER`
 *   constant whose name shares the prefix before `_PURPOSE`.
 * - A `<purpose>FileGroupIds` / `<purpose>StorageFileGroupIds` helper
 *   pairs with a purpose by best-effort camelCase prefix match.
 * - A subtask const `*_SUBTASK` is associated with a purpose if its
 *   name starts with the purpose constant name plus `_`.
 */

import { removeSuffix, screamingSnakeToCamelCase } from '@dereekb/util';
import { stripGroupIdsSuffix } from '../storagefile-m-validate-app/group-ids.js';
import type { ExtractedAppStorageFiles } from '../storagefile-m-validate-app/index.js';
import type { AppStorageFilesReport, StorageFilePurposeSummary } from './types.js';

const PURPOSE_SUFFIX = '_PURPOSE';
const FILE_TYPE_IDENTIFIER_SUFFIX = '_UPLOADED_FILE_TYPE_IDENTIFIER';

export interface CollectOptions {
  readonly componentDir: string;
  readonly apiDir: string;
}

/**
 * Reshapes the validator's extraction into the listing report shape — pairing
 * each `_PURPOSE` constant with its file-type identifier and reachable upload
 * initializer so the listing matches the validator's reachability view.
 *
 * @param extracted - The validator extraction to reshape.
 * @param options - Workspace directories used to relativise emitted paths.
 * @returns The listing report.
 */
export function collectAppStorageFiles(extracted: ExtractedAppStorageFiles, options: CollectOptions): AppStorageFilesReport {
  const indices = buildStorageFileIndices(extracted);
  const purposes: StorageFilePurposeSummary[] = [];
  for (const purpose of extracted.purposeConstants) {
    purposes.push(buildStorageFilePurposeSummary(purpose, extracted, indices));
  }

  const factoryName = extracted.uploadServiceCalls[0]?.enclosingFactoryName;
  const wiredFactoryNames = collectWiredFactoryNames(extracted);

  const result: AppStorageFilesReport = {
    componentDir: options.componentDir,
    apiDir: options.apiDir,
    uploadServiceFactoryName: factoryName,
    uploadServiceWiredInApi: factoryName ? wiredFactoryNames.has(factoryName) : false,
    processingHandlerWiredInApi: extracted.processingHandlerCalls.length > 0,
    purposes
  };
  return result;
}

interface StorageFileIndices {
  readonly fileTypeByPrefix: ReadonlyMap<string, ExtractedAppStorageFiles['fileTypeIdentifierConstants'][number]>;
  readonly initializerByType: ReadonlyMap<string, ExtractedAppStorageFiles['uploadInitializerEntries'][number]>;
  readonly processingByPurpose: ReadonlyMap<string, ExtractedAppStorageFiles['processingConfigs'][number]>;
}

function buildStorageFileIndices(extracted: ExtractedAppStorageFiles): StorageFileIndices {
  const result: StorageFileIndices = {
    fileTypeByPrefix: buildFileTypeByPrefix(extracted),
    initializerByType: buildInitializerByType(extracted),
    processingByPurpose: buildProcessingByPurpose(extracted)
  };
  return result;
}

function buildFileTypeByPrefix(extracted: ExtractedAppStorageFiles): Map<string, ExtractedAppStorageFiles['fileTypeIdentifierConstants'][number]> {
  const fileTypeByPrefix = new Map<string, ExtractedAppStorageFiles['fileTypeIdentifierConstants'][number]>();
  for (const c of extracted.fileTypeIdentifierConstants) {
    const prefix = removeSuffix(c.symbolName, FILE_TYPE_IDENTIFIER_SUFFIX);
    if (prefix) fileTypeByPrefix.set(prefix, c);
  }
  return fileTypeByPrefix;
}

function buildInitializerByType(extracted: ExtractedAppStorageFiles): Map<string, ExtractedAppStorageFiles['uploadInitializerEntries'][number]> {
  const reachableBindings = new Set<string>();
  for (const call of extracted.uploadServiceCalls) {
    for (const name of call.resolvedInitializerBindings) reachableBindings.add(name);
  }
  const initializerByType = new Map<string, ExtractedAppStorageFiles['uploadInitializerEntries'][number]>();
  for (const entry of extracted.uploadInitializerEntries) {
    if (entry.bindingName && reachableBindings.has(entry.bindingName)) {
      initializerByType.set(entry.typeIdentifier, entry);
    }
  }
  return initializerByType;
}

function buildProcessingByPurpose(extracted: ExtractedAppStorageFiles): Map<string, ExtractedAppStorageFiles['processingConfigs'][number]> {
  const processingByPurpose = new Map<string, ExtractedAppStorageFiles['processingConfigs'][number]>();
  for (const config of extracted.processingConfigs) {
    processingByPurpose.set(config.targetIdentifier, config);
  }
  return processingByPurpose;
}

function collectWiredFactoryNames(extracted: ExtractedAppStorageFiles): Set<string> {
  const wiredFactoryNames = new Set<string>();
  for (const wiring of extracted.uploadServiceWirings) {
    if (wiring.useFactoryIdentifier) wiredFactoryNames.add(wiring.useFactoryIdentifier);
  }
  return wiredFactoryNames;
}

function buildStorageFilePurposeSummary(purpose: ExtractedAppStorageFiles['purposeConstants'][number], extracted: ExtractedAppStorageFiles, indices: StorageFileIndices): StorageFilePurposeSummary {
  const prefix = removeSuffix(purpose.symbolName, PURPOSE_SUFFIX);
  const fileType = prefix ? indices.fileTypeByPrefix.get(prefix) : undefined;
  const groupIdsFn = findGroupIdsFunction(prefix, extracted);
  const subtasks = collectPurposeSubtasks(purpose.symbolName, extracted);
  const initializerEntry = fileType ? indices.initializerByType.get(fileType.symbolName) : undefined;
  const processingConfig = indices.processingByPurpose.get(purpose.symbolName);
  const result: StorageFilePurposeSummary = {
    purposeCode: purpose.purposeCode,
    purposeSymbolName: purpose.symbolName,
    fileTypeIdentifier: fileType?.typeCode,
    fileTypeIdentifierCode: fileType?.symbolName,
    fileGroupIdsFunctionName: groupIdsFn,
    subtasks,
    hasUploadInitializer: initializerEntry !== undefined,
    uploadInitializerSourceFile: initializerEntry?.sourceFile,
    hasProcessingConfig: processingConfig !== undefined,
    processingConfigSourceFile: processingConfig?.sourceFile,
    sourceFile: purpose.sourceFile
  };
  return result;
}

function collectPurposeSubtasks(purposeSymbolName: string, extracted: ExtractedAppStorageFiles): string[] {
  const subtasks: string[] = [];
  for (const c of extracted.processingSubtaskConstants) {
    if (c.symbolName.startsWith(`${purposeSymbolName}_`)) {
      subtasks.push(c.symbolName);
    }
  }
  return subtasks;
}

function findGroupIdsFunction(purposePrefix: string | undefined, extracted: ExtractedAppStorageFiles): string | undefined {
  if (!purposePrefix) return undefined;
  const camel = screamingSnakeToCamelCase(purposePrefix);
  let bestMatch: string | undefined;
  for (const fn of extracted.groupIdsFunctions) {
    const stripped = stripGroupIdsSuffix(fn.symbolName);
    if (stripped === camel) return fn.symbolName;
    if (stripped.startsWith(camel) || camel.startsWith(stripped)) {
      bestMatch = fn.symbolName;
    }
  }
  return bestMatch;
}
