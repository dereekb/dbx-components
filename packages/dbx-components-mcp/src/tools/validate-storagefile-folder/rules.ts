/**
 * Validation rules run against a {@link StorageFileFolderInspection}.
 * Rules accumulate {@link Violation}s into a mutable buffer; the
 * public entry point is {@link validateStorageFileFolder} in
 * `./index.ts`.
 */

import { API_STORAGEFILE_SUBPATH, CANONICAL_API_ROOT_FILES, COMPONENT_STORAGEFILE_SUBPATH, HANDLERS_SUBFOLDER_NAME, INDEX_FILE, REQUIRED_API_FILES, STORAGEFILE_FILE_PREFIX, type SideInspection, type StorageFileFolderInspection, type Violation, type ViolationSeverity } from './types.js';

export function runRules(inspection: StorageFileFolderInspection): readonly Violation[] {
  const violations: Violation[] = [];
  checkSidePresence(inspection.component, violations, 'STORAGEFILE_FOLDER_COMPONENT_DIR_NOT_FOUND', 'STORAGEFILE_FOLDER_COMPONENT_FOLDER_MISSING', COMPONENT_STORAGEFILE_SUBPATH);
  checkSidePresence(inspection.api, violations, 'STORAGEFILE_FOLDER_API_DIR_NOT_FOUND', 'STORAGEFILE_FOLDER_API_FOLDER_MISSING', API_STORAGEFILE_SUBPATH);

  if (inspection.component.status === 'ok') {
    checkComponent(inspection.component, violations);
  }
  if (inspection.api.status === 'ok') {
    checkApi(inspection.api, violations);
  }
  return violations;
}

// MARK: Presence
function checkSidePresence(side: SideInspection, violations: Violation[], dirCode: 'STORAGEFILE_FOLDER_COMPONENT_DIR_NOT_FOUND' | 'STORAGEFILE_FOLDER_API_DIR_NOT_FOUND', folderCode: 'STORAGEFILE_FOLDER_COMPONENT_FOLDER_MISSING' | 'STORAGEFILE_FOLDER_API_FOLDER_MISSING', subPath: string): void {
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
      message: `Storagefile folder \`${subPath}\` is missing under \`${side.rootDir}\`.`,
      side: side.side,
      file: undefined
    });
  }
}

// MARK: Component side
function checkComponent(side: SideInspection, violations: Violation[]): void {
  checkUnexpectedFileNames(side, violations);
  checkBarrelReexports(side, violations);
}

// MARK: API side
function checkApi(side: SideInspection, violations: Violation[]): void {
  checkRequiredApiFiles(side, violations);
  checkUnexpectedFileNames(side, violations);
  checkHandlersSubfolderMix(side, violations);
  checkBarrelReexports(side, violations);
}

function checkRequiredApiFiles(side: SideInspection, violations: Violation[]): void {
  const present = new Set(side.files);
  for (const required of REQUIRED_API_FILES) {
    if (present.has(required.filename)) continue;
    pushViolation(violations, {
      code: required.code,
      message: `Missing \`${required.filename}\` (${required.role}) under \`${side.rootDir}/${side.subPath}\`.`,
      side: side.side,
      file: required.filename
    });
  }
}

function checkUnexpectedFileNames(side: SideInspection, violations: Violation[]): void {
  for (const file of side.files) {
    if (file === INDEX_FILE) continue;
    if (file.startsWith(STORAGEFILE_FILE_PREFIX)) continue;
    pushViolation(violations, {
      code: 'STORAGEFILE_FOLDER_UNEXPECTED_FILE_NAME',
      severity: 'warning',
      message: `File \`${file}\` does not start with \`${STORAGEFILE_FILE_PREFIX}\`. Storagefile-folder files should be named \`${STORAGEFILE_FILE_PREFIX}<sub>.ts\` to stay grouped.`,
      side: side.side,
      file
    });
  }
}

function checkHandlersSubfolderMix(side: SideInspection, violations: Violation[]): void {
  const hasHandlers = side.entries.includes(HANDLERS_SUBFOLDER_NAME);
  if (!hasHandlers) return;
  const canonical = new Set(CANONICAL_API_ROOT_FILES);
  for (const file of side.files) {
    if (file === INDEX_FILE) continue;
    if (canonical.has(file)) continue;
    pushViolation(violations, {
      code: 'STORAGEFILE_FOLDER_HANDLERS_SUBFOLDER_MIXED',
      severity: 'warning',
      message: `File \`${file}\` lives at the storagefile folder root alongside a \`${HANDLERS_SUBFOLDER_NAME}/\` subfolder. Move handler files into \`${HANDLERS_SUBFOLDER_NAME}/\` to keep the convention consistent.`,
      side: side.side,
      file
    });
  }
}

// MARK: Barrel re-exports
const REEXPORT_PATTERN = /^\s*export\s+\*\s+from\s+['"]\.\/([^'"\n]+)['"]\s*;?\s*$/gm;

function checkBarrelReexports(side: SideInspection, violations: Violation[]): void {
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
          code: 'STORAGEFILE_FOLDER_BARREL_REEXPORT_MISSING',
          message: `\`${INDEX_FILE}\` re-exports \`./${target}\` but no matching \`./${normalized}.ts\` file or \`./${normalized}/\` subfolder exists at \`${side.rootDir}/${side.subPath}\`.`,
          side: side.side,
          file: INDEX_FILE
        });
      }
    }
    match = REEXPORT_PATTERN.exec(source);
  }
}

// MARK: Helpers
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
