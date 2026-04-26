/**
 * Pure entry point for the app-notifications validator. Callers pass a
 * prepared {@link AppNotificationsInspection} and receive a
 * {@link ValidationResult}. The sibling list tool imports
 * {@link extractAppNotifications} directly so it can reshape the same
 * extraction result into its report without re-running the AST walk.
 */

import { extractAppNotifications } from './extract.js';
import { runRules } from './rules.js';
import type { AppNotificationsInspection, ValidationResult, Violation } from './types.js';

export interface ValidateAppNotificationsOptions {
  readonly componentDir: string;
  readonly apiDir: string;
}

/**
 * Pure validation entry point. Reuses the shared extractor and runs the cross-
 * file rules over a single snapshot so the listing and validation reports stay
 * in sync.
 *
 * @param inspection - the prepared component + api file snapshot
 * @param options - workspace directories used to relativise emitted paths
 * @returns the aggregated validation outcome with counts and violations
 */
export function validateAppNotifications(inspection: AppNotificationsInspection, options: ValidateAppNotificationsOptions): ValidationResult {
  const extracted = extractAppNotifications(inspection);
  const violations: Violation[] = [];
  let errorCount = 0;
  let warningCount = 0;
  for (const v of runRules(inspection, extracted)) {
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
    componentDir: options.componentDir,
    apiDir: options.apiDir
  };
  return result;
}

export { extractAppNotifications } from './extract.js';
export { formatResult } from './format.js';
export { inspectAppNotifications } from './inspect.js';
export type {
  AppNotificationsInspection,
  ExtractedAppNotifications,
  ExtractedTaskCheckpointAlias,
  ExtractedTaskDataInterface,
  ExtractedTaskHandlerEntry,
  ExtractedTaskTypeConstant,
  ExtractedTemplateConfigsArrayFactory,
  ExtractedTemplateConfigsArrayWiring,
  ExtractedTemplateHandlerEntry,
  ExtractedTemplateInfoRecord,
  ExtractedTemplateInfoRecordWiring,
  ExtractedTemplateTypeConstant,
  ExtractedTemplateTypeInfo,
  InspectedFile,
  SideInspection,
  ValidationResult,
  Violation,
  ViolationCode,
  ViolationSeverity
} from './types.js';
