/**
 * Shared types for `dbx_asset_validate_folder`.
 */

import type { DbxAssetValidateFolderCode } from './codes.js';
import type { RemediationHint } from '../_core/rule-catalog/types.js';
import type { TwoSideResult, TwoSideViolation } from '../_core/validate-format.js';

export type { ViolationSeverity } from '../_core/validate-format.js';

export type ViolationCode = `${DbxAssetValidateFolderCode}`;

export interface Violation extends TwoSideViolation {
  readonly code: ViolationCode;
  readonly remediation?: RemediationHint;
}

export interface ValidationResult extends TwoSideResult {
  readonly violations: readonly Violation[];
}
