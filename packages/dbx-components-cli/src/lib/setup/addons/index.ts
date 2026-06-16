/**
 * Registry of the setup add-ons, keyed by id, plus the canonical id order.
 */

import { type SetupAddon, type SetupAddonId } from '../addon.js';
import { OIDC_ADDON } from './oidc.addon.js';
import { MCP_ADDON } from './mcp.addon.js';

/**
 * Every add-on keyed by its id.
 */
export const SETUP_ADDONS: Readonly<Record<SetupAddonId, SetupAddon>> = {
  oidc: OIDC_ADDON,
  mcp: MCP_ADDON
};

/**
 * The add-on ids in canonical (command + validation) order.
 */
export const SETUP_ADDON_IDS: readonly SetupAddonId[] = ['oidc', 'mcp'];

export { OIDC_ADDON, MCP_ADDON };
