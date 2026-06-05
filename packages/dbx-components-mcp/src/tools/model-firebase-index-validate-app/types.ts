/**
 * Public report + violation shapes for `dbx_model_firebase_index_validate_app`.
 *
 * The tool aggregates three signal sources into one violation stream:
 *   - extractor warnings (`@dbxModelFirebaseIndex` JSDoc + body checks)
 *   - analyzer warnings (Firestore composite-shape sanity checks)
 *   - diff drift between generated composites/fieldOverrides and the
 *     committed `firestore.indexes.json`
 *
 * Each violation carries a stable `code` from `codes.ts` plus an
 * auto-attached {@link RemediationHint} pulled from the rule catalog —
 * the formatter renders the canonical fix / template / see-also block
 * without per-warning prose duplication.
 */

import type { FirestoreIndexesDiff } from '@dereekb/dbx-cli/firestore-indexes';
import type { ViolationLine, ViolationSeverity, ModelFirebaseIndexValidateAppCodeString } from '@dereekb/dbx-cli/validate';

// MARK: Violation
/**
 * String-literal union of every code `dbx_model_firebase_index_validate_app`
 * may emit. Mirrors the runtime values of {@link ModelFirebaseIndexValidateAppCode}.
 */
export type ModelFirebaseIndexValidateAppViolationCode = ModelFirebaseIndexValidateAppCodeString;

/**
 * One violation surfaced by the validator. Extends the shared
 * {@link ViolationLine} so the canonical markdown formatter can render
 * the line + nested remediation block without domain knowledge.
 */
export interface ModelFirebaseIndexValidateAppViolation extends ViolationLine<ModelFirebaseIndexValidateAppViolationCode> {
  /**
   * Source file the violation points at — extractor entries report the
   * tagged factory's file; analyzer entries don't carry a source location.
   */
  readonly file: string | undefined;
  /**
   * Line within {@link file} when available — extractor entries carry
   * the factory's declaration line; analyzer entries omit it.
   */
  readonly line: number | undefined;
  /**
   * The tagged factory the violation is attributed to (when known).
   */
  readonly factory: string | undefined;
}

// MARK: Report
/**
 * Outcome of one `dbx_model_firebase_index_validate_app` invocation.
 * Both markdown and JSON formatters operate on this shape.
 */
export interface ModelFirebaseIndexValidateAppReport {
  readonly componentDir: string;
  readonly indexesFile: string;
  readonly indexesFileExists: boolean;
  /**
   * `true` when there is at least one error-severity violation OR any
   * non-empty diff bucket. The pre-`codes.ts` shape used the same signal.
   */
  readonly drift: boolean;
  readonly diff: FirestoreIndexesDiff;
  readonly generatedComposites: number;
  readonly generatedFieldOverrides: number;
  readonly existingComposites: number;
  readonly existingFieldOverrides: number;
  readonly violations: readonly ModelFirebaseIndexValidateAppViolation[];
  readonly errorCount: number;
  readonly warningCount: number;
}

export type ModelFirebaseIndexValidateAppViolationSeverity = ViolationSeverity;
