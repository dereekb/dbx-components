/**
 * Pure entry point for the notification-folder validator. Callers
 * pass a {@link NotificationFolderInspection} (prepared by the tool
 * wrapper via `node:fs/promises`) and receive a {@link ValidationResult}.
 */

import { runRules } from './rules.js';
import type { NotificationFolderInspection, ValidationResult, Violation } from './types.js';

/**
 * Pure validation entry point. Runs the rules layer over a prepared folder
 * inspection and aggregates the violations and counts.
 *
 * @param inspection - the prepared component + api folder snapshot
 * @returns the aggregated validation outcome with counts and violations
 */
export function validateNotificationFolder(inspection: NotificationFolderInspection): ValidationResult {
  const violations: Violation[] = [];
  let errorCount = 0;
  let warningCount = 0;
  for (const v of runRules(inspection)) {
    violations.push(v);
    if (v.severity === 'error') {
      errorCount += 1;
    } else {
      warningCount += 1;
    }
  }
  const result: ValidationResult = {
    violations,
    errorCount,
    warningCount,
    componentDir: inspection.componentDir,
    apiDir: inspection.apiDir
  };
  return result;
}

export { formatResult } from './format.js';
export { inspectNotificationFolder } from './inspect.js';
export type { NotificationFolderInspection, SideInspection, ValidationResult, Violation, ViolationCode, ViolationSeverity } from './types.js';
