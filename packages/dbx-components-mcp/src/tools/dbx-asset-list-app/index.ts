/**
 * Pure entry point for `dbx_asset_list_app`. Callers pass a prepared
 * `AppAssetsInspection` and receive an {@link AppAssetsReport}.
 */

import { extractAppAssets, type AppAssetsInspection } from '../dbx-asset-validate-app/index.js';
import { collectAppAssets } from './collect.js';
import type { AppAssetsReport } from './types.js';

export interface ListAppAssetsOptions {
  readonly componentDir: string;
  readonly apiDir: string;
}

/**
 * Pure listing entry point. Reuses the validator's extraction step and
 * reshapes the output into the listing report so listing and validator
 * findings stay in sync.
 *
 * @param inspection - the prepared filesystem inspection
 * @param options - workspace directories used to relativise emitted paths
 * @returns the listing report
 */
export function listAppAssets(inspection: AppAssetsInspection, options: ListAppAssetsOptions): AppAssetsReport {
  const extracted = extractAppAssets(inspection);
  return collectAppAssets(inspection, extracted, options);
}

export { formatReportAsJson } from './format.json.js';
export { formatReportAsMarkdown } from './format.markdown.js';
export type { AppAssetsReport, AssetAggregatorEntry, AssetReportEntry } from './types.js';
