/**
 * Arktype schema for the `cssUtilities` section of `dbx-mcp.scan.json`.
 *
 * CSS-utility scanning lives next to the existing semantic-types,
 * ui-components, forge-fields, and pipes sections — they all use the same
 * `dbx-mcp.scan.json` filename so a project that opts into multiple
 * pipelines keeps a single config file.
 *
 * The schema is intentionally permissive at the root (extra keys are
 * preserved untouched) so co-located scan sections don't trigger
 * cross-section validation.
 */

import { type } from 'arktype';

/**
 * Inner config that drives one css-utilities scan run. `source` becomes the
 * manifest's `source` label (used for collision detection across loaded
 * sources); `module` becomes the npm package name attached to every produced
 * entry. Both default to the project's `package.json#name` when omitted.
 */
export const CssUtilitiesScanSection = type({
  'source?': 'string',
  'module?': 'string',
  include: 'string[] >= 1',
  'exclude?': 'string[]',
  'out?': 'string'
});

/**
 * Static type inferred from {@link CssUtilitiesScanSection}.
 */
export type CssUtilitiesScanSection = typeof CssUtilitiesScanSection.infer;

/**
 * Top-level shape used by the css-utilities builder. Only the
 * `cssUtilities` key is consumed; the rest of the document is ignored so a
 * single `dbx-mcp.scan.json` can house multiple cluster configurations.
 */
export const CssUtilitiesScanConfig = type({
  version: '1',
  cssUtilities: CssUtilitiesScanSection
});

/**
 * Static type inferred from {@link CssUtilitiesScanConfig}.
 */
export type CssUtilitiesScanConfig = typeof CssUtilitiesScanConfig.infer;

/**
 * Default value used when the scan config does not specify `out`. Lives
 * next to the scan config in the project root.
 */
export const DEFAULT_CSS_UTILITIES_SCAN_OUT_PATH = 'css-utilities.mcp.generated.json';

/**
 * Filename the loader looks for at `${projectRoot}/`.
 */
export const CSS_UTILITIES_SCAN_CONFIG_FILENAME = 'dbx-mcp.scan.json';
