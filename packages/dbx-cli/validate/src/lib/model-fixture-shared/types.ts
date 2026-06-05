/**
 * Validation diagnostic types for the `dbx_model_fixture_*` tool cluster.
 *
 * The extraction types (`FixtureEntry`, `AppFixturesExtraction`, the params /
 * method / factory shapes) now live in `@dereekb/dbx-cli/model-test`; this
 * file keeps only the validation-result types, which depend on the
 * rule-catalog remediation layer and so stay alongside `validateAppFixtures`.
 */

import type { FixtureDiagnosticCodeEnum } from './codes.js';
import type { RemediationHint } from '../_core/rule-catalog/types.js';

/**
 * Severity of a validation diagnostic. The validator returns `error` for
 * structural issues (a missing class in the triplet) and `warning` for
 * convention-only issues (a parent field name that doesn't match the
 * registered short alias).
 */
export type FixtureDiagnosticSeverity = 'error' | 'warning';

/**
 * String-literal union derived from {@link FixtureDiagnosticCodeEnum}.
 * Source of truth for code metadata is the enum's per-member JSDoc;
 * the template-literal type widens the enum back to its underlying
 * kebab-case strings so existing emit-sites still typecheck.
 */
export type FixtureDiagnosticCode = `${FixtureDiagnosticCodeEnum}`;

/**
 * One validation diagnostic.
 */
export interface FixtureDiagnostic {
  readonly code: FixtureDiagnosticCode;
  readonly severity: FixtureDiagnosticSeverity;
  readonly message: string;
  readonly model?: string;
  readonly line?: number;
  /**
   * Auto-attached remediation hint pulled from the rule catalog at
   * emission time. `undefined` when no catalog entry exists for the
   * code (the formatter renders no nested block in that case).
   */
  readonly remediation?: RemediationHint;
}

/**
 * Result returned by `validateAppFixtures()`.
 */
export interface FixtureValidationResult {
  readonly fixturePath: string;
  readonly diagnostics: readonly FixtureDiagnostic[];
  readonly errorCount: number;
  readonly warningCount: number;
}

/**
 * Subset of `FirebaseModel` used by the validator's cross-reference rule.
 *
 * The validator accepts an opaque registry interface so it can be fed by
 * `FIREBASE_MODELS` (the @dereekb/firebase catalog) or by an app-local
 * registry without coupling to the larger registry surface.
 */
export interface FixtureModelRegistryEntry {
  readonly name: string;
  readonly modelType: string;
  readonly collectionPrefix: string;
}

/**
 * Pluggable model registry used by `validateAppFixtures()`. Consumers either
 * hand in a list of entries or skip the parent-naming + cross-reference
 * rules entirely.
 */
export interface FixtureModelRegistry {
  readonly entries: readonly FixtureModelRegistryEntry[];
}
