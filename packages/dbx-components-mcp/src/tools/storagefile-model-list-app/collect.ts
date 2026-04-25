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

import type { ExtractedAppStorageFiles } from '../storagefile-model-validate-app/index.js';
import type { AppStorageFilesReport, StorageFilePurposeSummary } from './types.js';

const PURPOSE_SUFFIX = '_PURPOSE';
const FILE_TYPE_IDENTIFIER_SUFFIX = '_UPLOADED_FILE_TYPE_IDENTIFIER';
const GROUP_IDS_FUNCTION_SUFFIXES: readonly string[] = ['StorageFileGroupIds', 'FileGroupIds'];

export interface CollectOptions {
  readonly componentDir: string;
  readonly apiDir: string;
}

export function collectAppStorageFiles(extracted: ExtractedAppStorageFiles, options: CollectOptions): AppStorageFilesReport {
  const fileTypeByPrefix = new Map<string, (typeof extracted.fileTypeIdentifierConstants)[number]>();
  for (const c of extracted.fileTypeIdentifierConstants) {
    const prefix = prefixBefore(c.symbolName, FILE_TYPE_IDENTIFIER_SUFFIX);
    if (prefix) fileTypeByPrefix.set(prefix, c);
  }

  const reachableTypeIdentifiers = new Set<string>();
  const reachableBindings = new Set<string>();
  for (const call of extracted.uploadServiceCalls) {
    for (const name of call.resolvedInitializerBindings) reachableBindings.add(name);
  }
  const initializerByType = new Map<string, (typeof extracted.uploadInitializerEntries)[number]>();
  for (const entry of extracted.uploadInitializerEntries) {
    if (entry.bindingName && reachableBindings.has(entry.bindingName)) {
      reachableTypeIdentifiers.add(entry.typeIdentifier);
      initializerByType.set(entry.typeIdentifier, entry);
    }
  }

  const processingByPurpose = new Map<string, (typeof extracted.processingConfigs)[number]>();
  for (const config of extracted.processingConfigs) {
    processingByPurpose.set(config.targetIdentifier, config);
  }

  const purposes: StorageFilePurposeSummary[] = [];
  for (const purpose of extracted.purposeConstants) {
    const prefix = prefixBefore(purpose.symbolName, PURPOSE_SUFFIX);
    const fileType = prefix ? fileTypeByPrefix.get(prefix) : undefined;
    const groupIdsFn = findGroupIdsFunction(prefix, extracted);
    const subtasks: string[] = [];
    for (const c of extracted.processingSubtaskConstants) {
      if (c.symbolName.startsWith(`${purpose.symbolName}_`)) {
        subtasks.push(c.symbolName);
      }
    }
    const initializerEntry = fileType ? initializerByType.get(fileType.symbolName) : undefined;
    const processingConfig = processingByPurpose.get(purpose.symbolName);
    purposes.push({
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
    });
  }

  const factoryName = extracted.uploadServiceCalls[0]?.enclosingFactoryName;
  const wiredFactoryNames = new Set<string>();
  for (const wiring of extracted.uploadServiceWirings) {
    if (wiring.useFactoryIdentifier) wiredFactoryNames.add(wiring.useFactoryIdentifier);
  }

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

function prefixBefore(name: string, suffix: string): string | undefined {
  if (!name.endsWith(suffix)) return undefined;
  return name.slice(0, -suffix.length);
}

function findGroupIdsFunction(purposePrefix: string | undefined, extracted: ExtractedAppStorageFiles): string | undefined {
  if (!purposePrefix) return undefined;
  const camel = toCamelCase(purposePrefix);
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
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i].toLowerCase();
    if (i === 0) {
      result += part;
    } else {
      result += part.charAt(0).toUpperCase() + part.slice(1);
    }
  }
  return result;
}
