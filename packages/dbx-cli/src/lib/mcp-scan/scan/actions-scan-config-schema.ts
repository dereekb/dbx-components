/**
 * Arktype schema for the `actions` section of `dbx-mcp.scan.json`.
 */

import { type } from 'arktype';

/**
 * Inner config that drives one actions scan run.
 */
export const ActionsScanSection = type({
  'source?': 'string',
  'module?': 'string',
  include: 'string[] >= 1',
  'exclude?': 'string[]',
  'out?': 'string'
});

/**
 * Static type inferred from {@link ActionsScanSection}.
 */
export type ActionsScanSection = typeof ActionsScanSection.infer;

/**
 * Top-level shape used by the actions builder.
 */
export const ActionsScanConfig = type({
  version: '1',
  actions: ActionsScanSection
});

/**
 * Static type inferred from {@link ActionsScanConfig}.
 */
export type ActionsScanConfig = typeof ActionsScanConfig.infer;

/**
 * Default value used when the scan config does not specify `out`.
 */
export const DEFAULT_ACTIONS_SCAN_OUT_PATH = 'actions.mcp.generated.json';

/**
 * Filename the loader looks for at `${projectRoot}/`.
 */
export const ACTIONS_SCAN_CONFIG_FILENAME = 'dbx-mcp.scan.json';
