/**
 * Validation rules run against a {@link FolderInspection}. Rules
 * accumulate {@link Violation}s into a mutable buffer; the public entry
 * point is {@link validateModelFolders} in `./index.ts`.
 */

import { buildRequiredFiles, SPECIAL_CASE_MODEL_FOLDER_NAMES, type FolderInspection, type Violation, type ViolationSeverity } from './types.js';

export function runRules(inspection: FolderInspection): readonly Violation[] {
  const violations: Violation[] = [];
  if (inspection.status === 'not-found') {
    pushViolation(violations, {
      code: 'FOLDER_NOT_FOUND',
      message: `Folder \`${inspection.path}\` does not exist.`,
      folder: inspection.path,
      file: undefined
    });
    return violations;
  }
  if (inspection.status === 'not-directory') {
    pushViolation(violations, {
      code: 'FOLDER_NOT_DIRECTORY',
      message: `Path \`${inspection.path}\` is not a directory.`,
      folder: inspection.path,
      file: undefined
    });
    return violations;
  }
  if (SPECIAL_CASE_MODEL_FOLDER_NAMES.includes(inspection.name)) {
    pushViolation(violations, {
      code: 'SPECIAL_CASE_MODEL_FOLDER',
      severity: 'warning',
      message: `Folder \`${inspection.name}\` is a recognized special-case model folder and does not follow the canonical 5-file layout. Skipping structural validation — use the dedicated validator for this model group.`,
      folder: inspection.path,
      file: undefined
    });
    return violations;
  }
  checkRequiredFiles(inspection, violations);
  checkStrayFiles(inspection, violations);
  return violations;
}

// MARK: Required files
function checkRequiredFiles(inspection: FolderInspection, violations: Violation[]): void {
  const presentFiles = new Set(inspection.files);
  for (const required of buildRequiredFiles(inspection.name)) {
    if (presentFiles.has(required.filename)) {
      continue;
    }
    pushViolation(violations, {
      code: required.code,
      message: `Missing \`${required.filename}\` (${required.role}).`,
      folder: inspection.path,
      file: required.filename
    });
  }
}

// MARK: Stray files
function checkStrayFiles(inspection: FolderInspection, violations: Violation[]): void {
  const prefix = `${inspection.name}.`;
  for (const file of inspection.files) {
    if (file === 'index.ts') continue;
    if (file.startsWith(prefix)) continue;
    pushViolation(violations, {
      code: 'FOLDER_STRAY_FILE',
      severity: 'warning',
      message: `File \`${file}\` does not start with \`${prefix}\`. Model-folder files should be named \`${prefix}<sub>.ts\` to stay grouped.`,
      folder: inspection.path,
      file
    });
  }
}

// MARK: Helpers
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
