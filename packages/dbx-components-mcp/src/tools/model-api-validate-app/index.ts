/**
 * Pure entry point for `dbx_model_api_validate_app`.
 */

import { extractDeclaredEntries } from './extract-declarations.js';
import { extractHandlerEntries } from './extract-handlers.js';
import { reconcile } from './reconcile.js';
import type { ValidateReport } from './types.js';

export interface ValidateAppOptions {
  readonly componentAbs: string;
  readonly componentDir: string;
  readonly apiAbs: string;
  readonly apiDir: string;
  readonly modelFilter?: string;
}

/**
 * Reconciles declarations from the firebase-component package against the
 * handlers wired in the app's `crud.functions.ts`.
 *
 * @param options - resolved paths and optional model filter
 * @returns the populated validation report
 */
export async function validateAppModelApi(options: ValidateAppOptions): Promise<ValidateReport> {
  const declared = await extractDeclaredEntries(options.componentAbs);
  const handlerExtraction = await extractHandlerEntries(options.apiAbs, options.apiDir);
  const reconciled = reconcile({ declared, handlers: handlerExtraction.entries, modelFilter: options.modelFilter });

  const report: ValidateReport = {
    componentDir: options.componentDir,
    apiDir: options.apiDir,
    modelFilter: options.modelFilter,
    handlerMapPath: handlerExtraction.path,
    handlerMapStatus: handlerExtraction.status,
    entries: reconciled.entries,
    issues: reconciled.issues,
    summaries: reconciled.summaries,
    errorCount: reconciled.errorCount,
    warningCount: reconciled.warningCount
  };
  return report;
}

export { formatValidationAsJson, formatValidationAsMarkdown } from './format.js';
export type { DeclaredEntry, HandlerEntry, ModelSummary, ReconciledEntry, ValidateIssue, ValidateIssueCode, ValidateReport, HandlerMapStatus } from './types.js';
