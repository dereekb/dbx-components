/**
 * Pure entry point for the asset-folder validator. Reuses the
 * extractor from `dbx_asset_validate_app` to test for any
 * `AssetPathRef` / `AssetPathRef[]` exports — no separate AST walk.
 */

import { attachRemediation } from '../rule-catalog/index.js';
import { extractAppAssets, type AppAssetsInspection } from '../dbx-asset-validate-app/index.js';
import type { ValidationResult, Violation, ViolationSeverity } from './types.js';

export interface ValidateAssetFolderOptions {
  readonly componentDir: string;
  readonly apiDir: string;
}

/**
 * Validates the component-side asset folder structure: `assets.ts`
 * exists under `src/lib/`, exports at least one ref or aggregator, and
 * the `src/lib/index.ts` barrel re-exports it.
 *
 * @param inspection - the prepared two-side inspection
 * @param options - workspace directories used to relativise emitted paths
 * @returns the aggregated validation outcome with counts and violations
 */
export function validateAssetFolder(inspection: AppAssetsInspection, options: ValidateAssetFolderOptions): ValidationResult {
  const violations: Violation[] = [];
  let errorCount = 0;
  let warningCount = 0;

  if (inspection.component.status === 'dir-not-found') {
    pushViolation(violations, {
      code: 'DBX_ASSET_FOLDER_COMPONENT_DIR_NOT_FOUND',
      message: `Component directory \`${inspection.component.rootDir}\` does not exist.`,
      side: 'component',
      file: undefined
    });
  } else {
    const extracted = extractAppAssets(inspection);
    if (!extracted.assetsFileExists) {
      pushViolation(violations, {
        code: 'DBX_ASSET_FOLDER_FILE_MISSING',
        message: `Component is missing \`src/lib/assets.ts\`. Add the file and export \`AssetPathRef\` constants.`,
        side: 'component',
        file: undefined
      });
    } else {
      if (extracted.assetConstants.length === 0 && extracted.aggregatorExports.length === 0) {
        pushViolation(violations, {
          code: 'DBX_ASSET_FOLDER_NO_EXPORTS',
          severity: 'warning',
          message: `\`src/lib/assets.ts\` exports neither an \`AssetPathRef\` constant nor an \`AssetPathRef[]\` aggregator.`,
          side: 'component',
          file: 'src/lib/assets.ts'
        });
      }
      if (!extracted.barrelReExportsAssets) {
        pushViolation(violations, {
          code: 'DBX_ASSET_FOLDER_BARREL_MISSING',
          severity: 'warning',
          message: `Component barrel \`src/lib/index.ts\` does not re-export \`./assets\`. Add \`export * from './assets';\` so downstream consumers see the refs.`,
          side: 'component',
          file: 'src/lib/index.ts'
        });
      }
    }
  }

  for (const v of violations) {
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

function pushViolation(buffer: Violation[], violation: Omit<Violation, 'severity' | 'remediation'> & { readonly severity?: ViolationSeverity }): void {
  const severity: ViolationSeverity = violation.severity ?? 'error';
  const filled: Violation = {
    code: violation.code,
    severity,
    message: violation.message,
    side: violation.side,
    file: violation.file,
    remediation: attachRemediation(violation.code)
  };
  buffer.push(filled);
}

export { formatResult } from './format.js';
export { inspectAppAssets } from '../dbx-asset-validate-app/index.js';
export type { AppAssetsInspection } from '../dbx-asset-validate-app/index.js';
export type { ValidationResult, Violation, ViolationCode } from './types.js';
export type { ViolationSeverity } from './types.js';
