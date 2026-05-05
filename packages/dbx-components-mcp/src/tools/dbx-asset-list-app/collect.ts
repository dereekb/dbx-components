/**
 * Reshapes the validator's {@link ExtractedAppAssets} into the listing
 * report shape — no AST walk happens here.
 */

import type { AppAssetsInspection, ExtractedAppAssets } from '../dbx-asset-validate-app/index.js';
import type { AppAssetsReport, AssetAggregatorEntry, AssetReportEntry } from './types.js';

const PROVIDE_CALL_RE = /provideDbxAssetLoader\s*\(/;

export interface CollectOptions {
  readonly componentDir: string;
  readonly apiDir: string;
}

/**
 * Builds the listing report from the validator's extraction plus the
 * inspected Angular root config text.
 *
 * @param inspection - the prepared two-side inspection (used to read
 *   the Angular root config text for the provider-wired flag)
 * @param extracted - the validator extraction to reshape
 * @param options - workspace directories used to relativise emitted paths
 * @returns the listing report
 */
export function collectAppAssets(inspection: AppAssetsInspection, extracted: ExtractedAppAssets, options: CollectOptions): AppAssetsReport {
  const assets: AssetReportEntry[] = [];
  for (const c of extracted.assetConstants) {
    assets.push({
      symbolName: c.symbolName,
      sourceType: c.sourceType,
      helper: c.helper,
      resolved: c.resolved,
      resolvedPaths: c.resolvedPaths,
      sourceFile: c.sourceFile,
      line: c.line
    });
  }
  const aggregators: AssetAggregatorEntry[] = extracted.aggregatorExports.map((a) => ({
    symbolName: a.symbolName,
    memberNames: a.memberNames,
    sourceFile: a.sourceFile,
    line: a.line
  }));
  const result: AppAssetsReport = {
    componentDir: options.componentDir,
    apiDir: options.apiDir,
    assetsFileExists: extracted.assetsFileExists,
    barrelReExportsAssets: extracted.barrelReExportsAssets,
    providerWiredInApp: detectProviderWired(inspection.app.rootConfigText),
    assets,
    aggregators
  };
  return result;
}

function detectProviderWired(text: string | undefined): boolean {
  if (!text) return false;
  return PROVIDE_CALL_RE.test(text);
}
