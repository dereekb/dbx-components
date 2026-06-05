/**
 * Shared types for `dbx_model_test_validate_app`.
 *
 * The validator pairs a downstream `-firebase` component with its API app
 * and verifies the model-test convention:
 *
 *  - Every spec file under `<apiDir>/src/app/function/<group>/` must follow
 *    `<group>.crud[.<sub>...].spec.ts` or `<group>.scenario[.<sub>...].spec.ts`.
 *  - Every model group declared on the component side (`<componentDir>/src/lib/model/<group>/`)
 *    must have at least a baseline `<group>.crud.spec.ts` on the API side.
 *
 * The classifier in `@dereekb/util` (spec-file-conventions) already handles the
 * filename parsing. This module just wires the classifier output into the
 * standard violation / result shape used by the rest of the validator
 * cluster.
 */

import type { ViolationLine, ViolationSeverity } from '../validate-format.js';
import type { ModelTestValidateAppCode } from './codes.js';

export type { ViolationSeverity } from '../validate-format.js';

/**
 * String-literal union of every code this validator emits. Aliases the
 * codes enum so the same set drives both the runtime emission and the rule
 * catalog.
 */
export type ViolationCode = `${ModelTestValidateAppCode}`;

/**
 * One emitted violation. Carries the model group it belongs to (for the
 * formatter to bucket by) and an optional spec-file path (omitted for
 * coverage warnings where no file exists yet).
 */
export interface Violation extends ViolationLine<ViolationCode> {
  readonly group: string;
  readonly file: string | undefined;
}

/**
 * Aggregated result of {@link validateModelTestApp}.
 */
export interface ModelTestValidateAppResult {
  readonly componentDir: string;
  readonly apiDir: string;
  readonly violations: readonly Violation[];
  readonly errorCount: number;
  readonly warningCount: number;
  /**
   * Total spec files inspected across every group folder.
   */
  readonly specFilesChecked: number;
  /**
   * Total model groups enumerated from the component side that participated
   * in the coverage check. Reserved folders (`system`, `notification`,
   * `storagefile`) are excluded — they follow distinct layouts.
   */
  readonly modelGroupsChecked: number;
}

/**
 * Per-call options for {@link validateModelTestApp}.
 */
export interface ValidateModelTestAppOptions {
  /**
   * When `true`, every violation is upgraded to `error` severity so callers
   * (CI, `dbx_app_validate`) treat the run as failing. Defaults to `false`,
   * matching the convention used by the JSDoc-tag warnings in `dbx_model_validate`.
   */
  readonly strict?: boolean;
}

/**
 * Default severity for every code this validator emits. Used by the pure
 * `validate.ts` layer and exposed here so tests + the formatter can share
 * the same source of truth.
 */
export const DEFAULT_SEVERITY: ViolationSeverity = 'warning';
