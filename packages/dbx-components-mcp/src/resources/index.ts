/**
 * MCP resource registration for dbx-components.
 *
 * Planned URIs:
 *   dbx://forge-fields, dbx://forge-fields/{slug}, dbx://forge-fields/category/{category}
 *   dbx://models, dbx://models/{pattern}
 *   dbx://actions, dbx://actions/{type}
 *   dbx://components, dbx://components/{pattern}
 *   dbx://conventions
 *   dbx://semantic-types
 *   dbx://instructions
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerForgeFieldsResource } from './forge-fields.resource.js';
import { registerFirebaseModelsResource } from './firebase-models.resource.js';

export function registerResources(server: McpServer): void {
  registerForgeFieldsResource(server);
  registerFirebaseModelsResource(server);
}
