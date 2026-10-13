/**
 * Types for `dbx_model_api_validate_app`.
 */

import type { CrudVerb } from '@dereekb/dbx-cli/manifest-extract';
import type { Maybe } from '@dereekb/util';
import type { ViolationSeverity } from '../_core/validate-format.js';
import type { ModelApiValidateAppCodeString } from './codes.js';

export type ValidateIssueCode = ModelApiValidateAppCodeString;

export interface ValidateIssue {
  readonly code: ValidateIssueCode;
  readonly severity: ViolationSeverity;
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
  /**
   * How the scan read the MCP read/write classification the handler declares. Set only when {@link verb} leaves it to the
   * handler (`invoke`, custom verbs).
   */
  readonly mcpReadOnly?: HandlerMcpReadOnly;
}

/**
 * How the scan read the MCP read/write classification a wired handler declares. Set only on handlers whose verb leaves
 * it to the handler (`invoke`, custom verbs): `read`/`query` infer a read and `create`/`update`/`delete` a write.
 */
export type HandlerMcpReadOnly = HandlerMcpReadOnlyDeclared | HandlerMcpReadOnlyUnset | HandlerMcpReadOnlyNoApiDetails | HandlerMcpReadOnlyUnresolved;

/**
 * The handler's `withApiDetails({ ... })` declares `mcp.readOnly`.
 */
export interface HandlerMcpReadOnlyDeclared {
  readonly kind: 'declared';
  /**
   * The literal value; `undefined` when `readOnly` is set to an expression the scan can't evaluate.
   */
  readonly value: Maybe<boolean>;
  /**
   * `<apiDir>/<file>:<line>` of the handler declaration.
   */
  readonly declarationSource: string;
}

/**
 * The handler's `withApiDetails({ ... })` has no `mcp` block, or an `mcp` block without `readOnly`.
 */
export interface HandlerMcpReadOnlyUnset {
  readonly kind: 'unset';
  /**
   * Whether the declaration has an `mcp` block (without `readOnly`).
   */
  readonly hasMcp: boolean;
  /**
   * `<apiDir>/<file>:<line>` of the handler declaration.
   */
  readonly declarationSource: string;
}

/**
 * A plain-function handler: no `withApiDetails`, so no `_apiDetails` and no MCP tool.
 */
export interface HandlerMcpReadOnlyNoApiDetails {
  readonly kind: 'noApiDetails';
  /**
   * `<apiDir>/<file>:<line>` of the handler declaration.
   */
  readonly declarationSource: string;
}

/**
 * The scan could not follow the handler back to a literal `withApiDetails({ ... })`.
 */
export interface HandlerMcpReadOnlyUnresolved {
  readonly kind: 'unresolved';
  /**
   * Why the scan could not follow the handler to a literal `withApiDetails({ ... })`.
   */
  readonly reason: string;
  /**
   * The declaration, when the scan reached it but could not read its config.
   */
  readonly declarationSource?: string;
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
  readonly warningCount: number;
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
