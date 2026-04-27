/**
 * Validation rules run against a {@link SystemFolderInspection}. Rules
 * accumulate {@link Violation}s into a mutable buffer; the public entry
 * point is {@link validateSystemFolders} in `./validate.ts`.
 */

import { extractSystemFile } from './extract.js';
import { DISALLOWED_SYSTEM_FILES, type ExtractedConverter, type ExtractedConverterMap, type ExtractedSystemFile, type SystemFolderInspection, type Violation, type ViolationSeverity } from './types.js';

const MAIN_FILE = 'system.ts';
const INDEX_FILE = 'index.ts';
const SYSTEM_PREFIX = 'system.';

/**
 * Applies every system-state folder rule and returns the aggregated
 * diagnostics. Short-circuits cleanly on missing/invalid folders so a stat
 * failure does not cascade into spurious downstream warnings.
 *
 * @param inspection - the prepared folder inspection
 * @returns the violations the rules emit for that folder
 */
export function runRules(inspection: SystemFolderInspection): readonly Violation[] {
  const violations: Violation[] = [];
  if (inspection.status === 'not-found') {
    pushViolation(violations, {
      code: 'SYSTEM_FOLDER_NOT_FOUND',
      message: `Folder \`${inspection.path}\` does not exist.`,
      folder: inspection.path,
      file: undefined
    });
    return violations;
  }
  if (inspection.status === 'not-directory') {
    pushViolation(violations, {
      code: 'SYSTEM_FOLDER_NOT_DIRECTORY',
      message: `Path \`${inspection.path}\` is not a directory.`,
      folder: inspection.path,
      file: undefined
    });
    return violations;
  }
  checkLayout(inspection, violations);
  if (inspection.systemSource !== undefined) {
    const extracted = extractSystemFile(MAIN_FILE, inspection.systemSource);
    checkContent(inspection, extracted, violations);
  }
  return violations;
}

// MARK: Layout
function checkLayout(inspection: SystemFolderInspection, violations: Violation[]): void {
  const present = new Set(inspection.files);
  if (!present.has(MAIN_FILE)) {
    pushViolation(violations, {
      code: 'SYSTEM_FOLDER_MISSING_MAIN',
      message: `Missing \`${MAIN_FILE}\` (main system-state module).`,
      folder: inspection.path,
      file: MAIN_FILE
    });
  }
  if (!present.has(INDEX_FILE)) {
    pushViolation(violations, {
      code: 'SYSTEM_FOLDER_MISSING_INDEX',
      message: `Missing \`${INDEX_FILE}\` (barrel export).`,
      folder: inspection.path,
      file: INDEX_FILE
    });
  }
  for (const disallowed of DISALLOWED_SYSTEM_FILES) {
    if (present.has(disallowed.filename)) {
      pushViolation(violations, {
        code: 'SYSTEM_FOLDER_DISALLOWED_FILE',
        message: `File \`${disallowed.filename}\` is not allowed in a system folder. ${disallowed.reason}`,
        folder: inspection.path,
        file: disallowed.filename
      });
    }
  }
  for (const file of inspection.files) {
    if (file === INDEX_FILE) continue;
    if (file.startsWith(SYSTEM_PREFIX)) continue;
    pushViolation(violations, {
      code: 'SYSTEM_FOLDER_STRAY_FILE',
      severity: 'warning',
      message: `File \`${file}\` does not start with \`${SYSTEM_PREFIX}\`. System-folder files should be named \`${SYSTEM_PREFIX}<sub>.ts\` to stay grouped.`,
      folder: inspection.path,
      file
    });
  }
}

// MARK: Content
function checkContent(inspection: SystemFolderInspection, extracted: ExtractedSystemFile, violations: Violation[]): void {
  const converterMap = extracted.converterMap;
  if (!converterMap) {
    pushViolation(violations, {
      code: 'SYSTEM_MISSING_CONVERTER_MAP',
      message: `\`${MAIN_FILE}\` must export a \`SystemStateStoredDataConverterMap\` constant (e.g. \`export const <app>SystemStateStoredDataConverterMap: SystemStateStoredDataConverterMap = { ... }\`) to register every state-type converter.`,
      folder: inspection.path,
      file: MAIN_FILE
    });
  } else if (converterMap.line < extracted.lastTopLevelExportLine) {
    pushViolation(violations, {
      code: 'SYSTEM_CONVERTER_MAP_NOT_LAST',
      severity: 'warning',
      message: `Converter map \`${converterMap.name}\` should be the last top-level export in \`${MAIN_FILE}\`; other exports appear after it.`,
      folder: inspection.path,
      file: MAIN_FILE
    });
  }

  checkTriplePairing(inspection.path, extracted, violations);
  if (converterMap) {
    checkMapKeys({ folderPath: inspection.path, extracted, converterMap, violations });
  }
}

// MARK: Triple pairing
interface CheckInterfacePairingOptions {
  readonly folderPath: string;
  readonly iface: ExtractedSystemFile['dataInterfaces'][number];
  readonly converterByName: Map<string, ExtractedConverter>;
  readonly typeConstantByRoot: Map<string, ExtractedSystemFile['typeConstants'][number]>;
  readonly matchedConverters: Set<string>;
  readonly matchedTypeConstants: Set<string>;
  readonly violations: Violation[];
}

function checkInterfacePairing(options: CheckInterfacePairingOptions): void {
  const { folderPath, iface, converterByName, typeConstantByRoot, matchedConverters, matchedTypeConstants, violations } = options;
  const stem = iface.name.slice(0, -'SystemData'.length);
  const expectedConverterName = camelCase(stem) + 'SystemDataConverter';
  const converter = converterByName.get(expectedConverterName);
  if (converter) {
    matchedConverters.add(converter.name);
  } else {
    pushViolation(violations, {
      code: 'SYSTEM_MISSING_CONVERTER',
      message: `Interface \`${iface.name}\` has no matching converter. Expected an exported constant named \`${expectedConverterName}\` typed \`SystemStateStoredDataFieldConverterConfig<${iface.name}>\`.`,
      folder: folderPath,
      file: MAIN_FILE
    });
  }

  const typeConstant = typeConstantByRoot.get(iface.normalizedRoot);
  if (typeConstant) {
    matchedTypeConstants.add(typeConstant.name);
    return;
  }
  const expectedScreaming = screamingSnakeFromPascal(stem) + '_SYSTEM_STATE_TYPE';
  pushViolation(violations, {
    code: 'SYSTEM_MISSING_TYPE_CONSTANT',
    message: `Interface \`${iface.name}\` has no matching \`_SYSTEM_STATE_TYPE\` constant. Expected an exported constant whose name (with underscores removed, lowercased) matches \`${iface.normalizedRoot}\` — e.g. \`${expectedScreaming}\`.`,
    folder: folderPath,
    file: MAIN_FILE
  });
}

function checkTriplePairing(folderPath: string, extracted: ExtractedSystemFile, violations: Violation[]): void {
  const typeConstantByRoot = indexByRoot(extracted.typeConstants);
  const interfaceByRoot = indexByRoot(extracted.dataInterfaces);
  const converterByName = new Map<string, ExtractedConverter>();
  for (const c of extracted.converters) {
    converterByName.set(c.name, c);
  }

  const matchedTypeConstants = new Set<string>();
  const matchedConverters = new Set<string>();

  for (const iface of extracted.dataInterfaces) {
    checkInterfacePairing({ folderPath, iface, converterByName, typeConstantByRoot, matchedConverters, matchedTypeConstants, violations });
  }

  for (const typeConstant of extracted.typeConstants) {
    if (matchedTypeConstants.has(typeConstant.name)) continue;
    if (interfaceByRoot.has(typeConstant.normalizedRoot)) continue;
    pushViolation(violations, {
      code: 'SYSTEM_ORPHAN_TYPE_CONSTANT',
      message: `Type constant \`${typeConstant.name}\` has no matching \`<Foo>SystemData\` interface. Every \`_SYSTEM_STATE_TYPE\` constant must be paired with an interface extending \`SystemStateStoredData\`.`,
      folder: folderPath,
      file: MAIN_FILE
    });
  }

  for (const converter of extracted.converters) {
    if (matchedConverters.has(converter.name)) continue;
    pushViolation(violations, {
      code: 'SYSTEM_ORPHAN_CONVERTER',
      message: `Converter \`${converter.name}\` has no matching \`<Foo>SystemData\` interface. Expected an exported interface \`${expectedInterfaceFromConverter(converter.name)}\` extending \`SystemStateStoredData\`.`,
      folder: folderPath,
      file: MAIN_FILE
    });
  }
}

/**
 * Options for verifying converter map keys against the extracted file.
 */
interface CheckMapKeysOptions {
  readonly folderPath: string;
  readonly extracted: ExtractedSystemFile;
  readonly converterMap: ExtractedConverterMap;
  readonly violations: Violation[];
}

// MARK: Map keys
function checkMapKeys(options: CheckMapKeysOptions): void {
  const { folderPath, extracted, converterMap, violations } = options;
  const identifierKeys = new Set<string>();
  for (const key of converterMap.keys) {
    if (key.kind === 'identifier') {
      identifierKeys.add(key.raw);
    }
  }

  const knownIdentifiers = new Set<string>();
  for (const c of extracted.typeConstants) {
    knownIdentifiers.add(c.name);
  }
  for (const imported of extracted.importedIdentifiers) {
    knownIdentifiers.add(imported);
  }

  for (const c of extracted.typeConstants) {
    if (!identifierKeys.has(c.name)) {
      pushViolation(violations, {
        code: 'SYSTEM_TYPE_NOT_IN_MAP',
        message: `Type constant \`${c.name}\` is not referenced as a key in \`${converterMap.name}\`. Add an entry \`[${c.name}]: <converter>\` so the aggregator registers this state type.`,
        folder: folderPath,
        file: MAIN_FILE
      });
    }
  }

  for (const key of converterMap.keys) {
    if (key.kind !== 'identifier') {
      pushViolation(violations, {
        code: 'SYSTEM_UNKNOWN_MAP_KEY',
        severity: 'warning',
        message: `Key \`${key.raw}\` in \`${converterMap.name}\` is a bare literal. Prefer \`[<NAME>_SYSTEM_STATE_TYPE]: ...\` so the key stays consistent with the exported constant.`,
        folder: folderPath,
        file: MAIN_FILE
      });
      continue;
    }
    if (!knownIdentifiers.has(key.raw)) {
      pushViolation(violations, {
        code: 'SYSTEM_UNKNOWN_MAP_KEY',
        severity: 'warning',
        message: `Key \`${key.raw}\` in \`${converterMap.name}\` is not a declared \`_SYSTEM_STATE_TYPE\` constant and is not imported. Declare it locally or import the identifier.`,
        folder: folderPath,
        file: MAIN_FILE
      });
    }
  }
}

// MARK: Helpers
function indexByRoot<T extends { readonly normalizedRoot: string }>(entries: readonly T[]): Map<string, T> {
  const out = new Map<string, T>();
  for (const entry of entries) {
    if (!out.has(entry.normalizedRoot)) {
      out.set(entry.normalizedRoot, entry);
    }
  }
  return out;
}

function camelCase(pascal: string): string {
  if (pascal.length === 0) return pascal;
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function expectedInterfaceFromConverter(converterName: string): string {
  const stripped = converterName.endsWith('SystemDataConverter') ? converterName.slice(0, -'SystemDataConverter'.length) : converterName;
  if (stripped.length === 0) return '<Foo>SystemData';
  const pascal = stripped.charAt(0).toUpperCase() + stripped.slice(1);
  return `${pascal}SystemData`;
}

function screamingSnakeFromPascal(pascal: string): string {
  if (pascal.length === 0) return pascal;
  let out = '';
  for (let i = 0; i < pascal.length; i++) {
    const ch = pascal.charAt(i);
    const isUpper = ch >= 'A' && ch <= 'Z';
    if (isUpper && i > 0) {
      const prev = pascal.charAt(i - 1);
      const prevIsLower = prev >= 'a' && prev <= 'z';
      if (prevIsLower) {
        out += '_';
      }
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
    folder: violation.folder,
    file: violation.file
  };
  buffer.push(filled);
}
