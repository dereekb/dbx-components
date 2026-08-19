/**
 * Report + violation shapes for `dbx_model_server_only_validate_app`.
 *
 * The validator reconciles three independent declarations of "no client may read this model" —
 * the `@dbxModelServerOnly` interface tag, the `serverOnly: true` runtime service flag, and the
 * rules-derived verdict from `firestore.rules` — and emits one violation per disagreement, each
 * carrying a stable code from `ModelServerOnlyValidateAppCode` plus the rule catalog's remediation.
 */

import type { FirestoreRulesAccess } from '@dereekb/dbx-cli/firestore-rules';
import type { ModelServerOnlyValidateAppCodeString, ViolationLine } from '@dereekb/dbx-cli/validate';

// MARK: Violation
/**
 * String-literal union of every code `dbx_model_server_only_validate_app` may emit.
 */
export type ModelServerOnlyValidateAppViolationCode = ModelServerOnlyValidateAppCodeString;

/**
 * One violation surfaced by the validator, attributed to a model type.
 */
export interface ModelServerOnlyValidateAppViolation extends ViolationLine<ModelServerOnlyValidateAppViolationCode> {
  /**
   * The model type the violation is attributed to. `undefined` for findings that belong to an
   * interface with no resolvable model type (e.g. a stray `@dbxModelServerOnly` tag).
   */
  readonly modelType: string | undefined;
  /**
   * Workspace-relative source file the violation points at, when known.
   */
  readonly file: string | undefined;
}

// MARK: Reconciliation
/**
 * The three legs of the reconciliation for one model, plus what was resolvable about it.
 */
export interface ModelServerOnlyReconciliation {
  readonly modelType: string;
  /**
   * The model's TS data type name, read off the service factory's second type argument.
   */
  readonly modelName: string | undefined;
  /**
   * Short collection name from the resolved `firestoreModelIdentity(...)`. `undefined` when the
   * identity could not be resolved in the scanned sources.
   */
  readonly collection: string | undefined;
  /**
   * Leg 1 — `@dbxModelServerOnly` on the model interface. `undefined` when no interface by that
   * name was found in the scanned sources (e.g. the data type is a `type` alias).
   */
  readonly tag: boolean | undefined;
  /**
   * Leg 2 — `serverOnly: true` on the `firebaseModelServiceFactory` config.
   */
  readonly flag: boolean;
  /**
   * Leg 3 — the rules-derived verdict. `undefined` when {@link collection} is unresolved.
   */
  readonly rules: boolean | undefined;
  readonly rulesGet: FirestoreRulesAccess | undefined;
  readonly rulesList: FirestoreRulesAccess | undefined;
  /**
   * True when every resolvable leg agrees.
   */
  readonly agrees: boolean;
}

// MARK: Report
/**
 * Outcome of one `dbx_model_server_only_validate_app` invocation. Both formatters read this shape.
 */
export interface ModelServerOnlyValidateAppReport {
  readonly componentDir: string;
  readonly serviceFile: string;
  readonly rulesFile: string;
  /**
   * Workspace-relative dirs scanned for `firestoreModelIdentity(...)` declarations and model interfaces.
   */
  readonly modelDirs: readonly string[];
  /**
   * The generated CLI model manifest the `NOT_IN_MANIFEST` check ran against, when supplied.
   */
  readonly manifestFile: string | undefined;
  /**
   * `true` when there is at least one error-severity violation.
   */
  readonly failed: boolean;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly reconciliations: readonly ModelServerOnlyReconciliation[];
  readonly violations: readonly ModelServerOnlyValidateAppViolation[];
}
