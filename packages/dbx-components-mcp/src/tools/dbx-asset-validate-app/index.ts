/**
 * Pure entry point for the app-assets validator. Callers pass a
 * prepared {@link AppAssetsInspection} and receive a
 * {@link ValidationResult}. The sibling list tool imports
 * {@link extractAppAssets} directly so it can reshape the same
 * extraction result into its report without re-running the AST walk.
 */

import { extractAppAssets } from './extract.js';
import { runRules } from './rules.js';
import type { AppAssetsInspection, ValidationResult, Violation } from './types.js';

export interface ValidateAppAssetsOptions {
  readonly componentDir: string;
  readonly apiDir: string;
}

/**
 * Pure validation entry point. Reuses the shared extractor and runs the
 * cross-file rules over a single snapshot so the listing and validation
 * reports stay in sync.
 *
 * @param inspection - the prepared component + app inspection
 * @param options - workspace directories used to relativise emitted paths
 * @returns the aggregated validation outcome with counts and violations
 */
export function validateAppAssets(inspection: AppAssetsInspection, options: ValidateAppAssetsOptions): ValidationResult {
  const extracted = extractAppAssets(inspection);
  const violations: Violation[] = [];
  let errorCount = 0;
  let warningCount = 0;
  for (const v of runRules(inspection, extracted)) {
    violations.push(v);
    if (v.severity === 'error') {
      errorCount += 1;
    } else {
      warningCount += 1;
    }
  }
  const result: ValidationResult = {
    violations,
    errorCount,
    warningCount,
    componentDir: options.componentDir,
    apiDir: options.apiDir
  };
  return result;
}

export { extractAppAssets } from './extract.js';
export { formatResult } from './format.js';
export { inspectAppAssets } from './inspect.js';
export type { AppAssetWiringInspection, AppAssetsInspection, AssetBuilderHelper, AssetSourceType, ExtractedAppAssets, ExtractedAssetArrayExport, ExtractedAssetConstant, ExtractedFolderBuilder, ExtractedInvalidRemoteUrl, ExtractedRemoteBaseBuilder, ExtractedUnknownBuilder, InspectedFile, SideInspection, ValidationResult, Violation, ViolationCode } from './types.js';
export type { ViolationSeverity } from './types.js';
