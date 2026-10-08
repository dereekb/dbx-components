/**
 * Pure entry point for the app-notifications validator. Callers pass a
 * prepared {@link AppNotificationsInspection} and receive a
 * {@link ValidationResult}. The sibling list tool imports
 * {@link extractAppNotifications} directly so it can reshape the same
 * extraction result into its report without re-running the AST walk.
 */

import { extractAppNotifications } from './extract.js';
import { runRules } from './rules.js';
import type { AppNotificationsInspection, ExtractedAppNotifications, ValidationResult, Violation } from './types.js';

export interface ValidateAppNotificationsOptions {
  readonly componentDir: string;
  readonly apiDir: string;
}

/**
 * Input to {@link validateExtractedAppNotifications}: the inspection plus an
 * extraction already computed from it.
 */
export interface ValidateExtractedAppNotificationsInput extends ValidateAppNotificationsOptions {
  readonly inspection: AppNotificationsInspection;
  readonly extracted: ExtractedAppNotifications;
}

/**
 * Runs the cross-file rules over an extraction the caller already holds. Lets
 * a caller that also needs the listing report (e.g. the notification manifest
 * builder) walk the AST once and feed the same extraction to both.
 *
 * @param input - The inspection, its extraction, and the workspace directories used to relativise emitted paths.
 * @returns The aggregated validation outcome with counts and violations.
 */
export function validateExtractedAppNotifications(input: ValidateExtractedAppNotificationsInput): ValidationResult {
  const violations: Violation[] = [];
  let errorCount = 0;
  let warningCount = 0;
  for (const v of runRules(input.inspection, input.extracted)) {
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
    componentDir: input.componentDir,
    apiDir: input.apiDir
  };
  return result;
}

/**
 * Pure validation entry point. Reuses the shared extractor and runs the cross-
 * file rules over a single snapshot so the listing and validation reports stay
 * in sync.
 *
 * @param inspection - The prepared component + api file snapshot.
 * @param options - Workspace directories used to relativise emitted paths.
 * @returns The aggregated validation outcome with counts and violations.
 */
export function validateAppNotifications(inspection: AppNotificationsInspection, options: ValidateAppNotificationsOptions): ValidationResult {
  return validateExtractedAppNotifications({ inspection, extracted: extractAppNotifications(inspection), componentDir: options.componentDir, apiDir: options.apiDir });
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
  NotificationDeliveryMethodName,
  SideInspection,
  UserConfigurableDeliveryMethodsSource,
  ValidationResult,
  Violation,
  ViolationCode,
  ViolationSeverity
} from './types.js';
