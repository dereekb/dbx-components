/**
 * Arktype schema for the `uiComponents` section of `dbx-mcp.scan.json`.
 *
 * UI scanning lives next to the existing semantic-types section — both use
 * the same `dbx-mcp.scan.json` filename so a project that opts into both
 * pipelines keeps a single config file. The CLI subcommand
 * `scan-ui-components` reads only the `uiComponents` field; the
 * `scan-semantic-types` subcommand continues to read the top-level fields
 * unchanged.
 *
 * The schema is intentionally permissive at the root (extra keys are
 * preserved untouched) so semantic-types and forge-fields configs can
 * coexist without cross-section validation.
 */

import { type } from 'arktype';

/**
 * Inner config that drives one ui-components scan run. `source` becomes the
 * manifest's `source` label (used for collision detection across loaded
 * sources); `module` becomes the npm package name attached to every produced
 * entry. Both default to the project's `package.json#name` when omitted.
 */
export const UiComponentsScanSection = type({
  'source?': 'string',
  'module?': 'string',
  include: 'string[] >= 1',
  'exclude?': 'string[]',
  'out?': 'string'
});

/**
 * Static type inferred from {@link UiComponentsScanSection}.
 */
export type UiComponentsScanSection = typeof UiComponentsScanSection.infer;

/**
 * Top-level shape used by the ui-components builder. Only the
 * `uiComponents` key is consumed; the rest of the document is ignored so
 * a single `dbx-mcp.scan.json` can house both semantic-types and
 * ui-components configurations.
 */
export const UiComponentsScanConfig = type({
  version: '1',
  uiComponents: UiComponentsScanSection
});

/**
 * Static type inferred from {@link UiComponentsScanConfig}.
 */
export type UiComponentsScanConfig = typeof UiComponentsScanConfig.infer;

/**
 * Default value used when the scan config does not specify `out`.
 * Lives next to the scan config in the project root.
 */
export const DEFAULT_UI_COMPONENTS_SCAN_OUT_PATH = 'ui-components.mcp.json';

/**
 * Filename the loader looks for at `${projectRoot}/`. Re-exported here so
 * the ui-components CLI does not have to import from the semantic-types
 * scan config module.
 */
export const UI_COMPONENTS_SCAN_CONFIG_FILENAME = 'dbx-mcp.scan.json';
