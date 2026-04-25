/**
 * Pure entry point for the model-folder validator. Callers pass one or
 * more {@link FolderInspection} records (prepared by the tool wrapper
 * via `node:fs/promises`) and receive a {@link ValidationResult}.
 */

import { runRules } from './rules.js';
import type { FolderInspection, ValidationResult, Violation } from './types.js';

export function validateModelFolders(inspections: readonly FolderInspection[]): ValidationResult {
  const violations: Violation[] = [];
  let errorCount = 0;
  let warningCount = 0;
  for (const inspection of inspections) {
    const folderViolations = runRules(inspection);
    for (const v of folderViolations) {
      violations.push(v);
      if (v.severity === 'error') {
        errorCount += 1;
      } else {
        warningCount += 1;
      }
    }
  }
  const result: ValidationResult = {
    violations,
    errorCount,
    warningCount,
    foldersChecked: inspections.length
  };
  return result;
}

export { formatResult } from './format.js';
export { inspectFolder } from './inspect.js';
export type { FolderInspection, ValidationResult, Violation, ViolationCode, ViolationSeverity } from './types.js';
