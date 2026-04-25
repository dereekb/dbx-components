/**
 * Pure entry point for the system-folder validator. Callers pass one or
 * more {@link SystemFolderInspection} records (prepared by the tool
 * wrapper via `node:fs/promises`) and receive a {@link ValidationResult}.
 */

import { runRules } from './rules.js';
import type { SystemFolderInspection, ValidationResult, Violation } from './types.js';

export function validateSystemFolders(inspections: readonly SystemFolderInspection[]): ValidationResult {
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
export type { SystemFolderInspection, ValidationResult, Violation, ViolationCode, ViolationSeverity } from './types.js';
