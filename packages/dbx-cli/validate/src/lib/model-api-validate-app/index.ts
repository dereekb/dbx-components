/**
 * Pure entry point for `dbx_model_api_validate_app`.
 */

import { type DeclaredEntriesSourceRoot, extractDeclaredEntries } from './extract-declarations.js';
import { extractHandlerEntries } from './extract-handlers.js';
import { reconcile } from './reconcile.js';
import { resolveApiSourceRoots } from './source-roots.js';
import type { ValidateReport } from './types.js';

export interface ValidateAppOptions {
  readonly componentAbs: string;
  readonly componentDir: string;
  readonly apiAbs: string;
  readonly apiDir: string;
  readonly modelFilter?: string;
}

/**
 * Reconciles declarations from the firebase-component package (and any
 * upstream `@dereekb/*` package it depends on) against the handlers wired
 * in the app's `crud.functions.ts`.
 *
 * @param options - Resolved paths and optional model filter.
 * @returns The populated validation report.
 */
export async function validateAppModelApi(options: ValidateAppOptions): Promise<ValidateReport> {
  const { roots, workspaceRoot } = await resolveApiSourceRoots({ componentAbs: options.componentAbs, workspaceRoot: undefined });
  const relativeBase = workspaceRoot ?? options.componentAbs;
  const declaredRoots: DeclaredEntriesSourceRoot[] = roots.map((r) => ({ absDir: r.absDir, relativeBase }));
  const declared = await extractDeclaredEntries(declaredRoots);
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
