/**
 * Shared types for `dbx_asset_validate_folder`.
 */

import type { DbxAssetValidateFolderCode } from './codes.js';
import type { RemediationHint } from '../rule-catalog/types.js';
import type { TwoSideResult, TwoSideViolation } from '../validate-format.js';

export type { ViolationSeverity } from '../validate-format.js';

export type ViolationCode = `${DbxAssetValidateFolderCode}`;

export interface Violation extends TwoSideViolation {
  readonly code: ViolationCode;
  readonly remediation?: RemediationHint;
}

export interface ValidationResult extends TwoSideResult {
  readonly violations: readonly Violation[];
}
