/**
 * Report shapes for `dbx_asset_list_app`. Built from the same
 * {@link ExtractedAppAssets} the validator produces — this tool
 * reshapes the extraction into a flat per-asset summary plus the
 * aggregator listing.
 */

import type { AssetBuilderHelper, AssetSourceType } from '../dbx-asset-validate-app/index.js';

/**
 * One row in the listing report — a single exported `AssetPathRef`
 * constant. `resolved` is the joined path / url for direct or
 * `.asset(...)` builders; `resolvedPaths` is non-empty only for the
 * `.assets([...])` plural forms.
 */
export interface AssetReportEntry {
  readonly symbolName: string;
  readonly sourceType: AssetSourceType;
  readonly helper: AssetBuilderHelper;
  readonly resolved: string | undefined;
  readonly resolvedPaths: readonly string[];
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * One aggregator export `export const X: AssetPathRef[] = [...]`.
 */
export interface AssetAggregatorEntry {
  readonly symbolName: string;
  readonly memberNames: readonly string[];
  readonly sourceFile: string;
  readonly line: number;
}

export interface AppAssetsReport {
  readonly componentDir: string;
  readonly apiDir: string;
  readonly assetsFileExists: boolean;
  readonly barrelReExportsAssets: boolean;
  readonly providerWiredInApp: boolean;
  readonly assets: readonly AssetReportEntry[];
  readonly aggregators: readonly AssetAggregatorEntry[];
}
