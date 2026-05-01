/**
 * Types for `dbx_model_api_validate_app`.
 */

import type { CrudVerb } from '../model-api-shared/types.js';

export type ValidateIssueCode = 'MISSING_HANDLER' | 'ORPHAN_HANDLER' | 'MISSING_MODEL_KEY' | 'PARSE_ERROR';

export interface ValidateIssue {
  readonly code: ValidateIssueCode;
  readonly model: string;
  readonly verb: CrudVerb | undefined;
  readonly specifier: string | undefined;
  readonly message: string;
  readonly source: string;
}

export interface DeclaredEntry {
  readonly model: string;
  readonly verb: CrudVerb;
  readonly specifier: string | undefined;
  readonly paramsTypeName: string | undefined;
  readonly resultTypeName: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

export interface HandlerEntry {
  readonly model: string;
  readonly verb: CrudVerb;
  readonly specifier: string | undefined;
  readonly handlerName: string;
  readonly sourceFile: string;
  readonly line: number;
}

export interface ReconciledEntry {
  readonly model: string;
  readonly verb: CrudVerb;
  readonly specifier: string | undefined;
  readonly declared: DeclaredEntry | undefined;
  readonly handler: HandlerEntry | undefined;
}

export interface ModelSummary {
  readonly model: string;
  readonly declaredCount: number;
  readonly handledCount: number;
  readonly matchedCount: number;
  readonly errorCount: number;
}

export interface ValidateReport {
  readonly componentDir: string;
  readonly apiDir: string;
  readonly modelFilter: string | undefined;
  readonly handlerMapPath: string;
  readonly handlerMapStatus: HandlerMapStatus;
  readonly entries: readonly ReconciledEntry[];
  readonly issues: readonly ValidateIssue[];
  readonly summaries: readonly ModelSummary[];
  readonly errorCount: number;
  readonly warningCount: number;
}

export type HandlerMapStatus = { readonly kind: 'ok'; readonly verbsFound: readonly CrudVerb[] } | { readonly kind: 'missing'; readonly path: string } | { readonly kind: 'error'; readonly message: string };
