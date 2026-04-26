/**
 * MCP resource registration for dbx-components.
 *
 * URIs are namespaced by domain (`dbx://<domain>/...`) so each cluster can
 * grow its own subpaths without colliding. Currently registered:
 *
 *   dbx://form/fields[/{slug} | /produces/{produces} | /tier/{tier} | /array-output/{arrayOutput}]
 *   dbx://model/firebase[/{name} | /prefix/{prefix} | /subcollections/{parent}]
 *   dbx://action/entries[/{slug} | /role/{role}]
 *   dbx://ui/components[/{slug} | /category/{category} | /kind/{kind}]
 *   dbx://pipe/entries[/{slug} | /category/{category}]
 *   dbx://filter/entries[/{slug} | /kind/{kind}]
 *
 * Resource-less clusters (route, storagefile_m, notification_m, system_m,
 * artifact) don't expose data endpoints because their output is computed from
 * caller input rather than a fixed catalog.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFormFieldsResource } from './form-fields.resource.js';
import { registerFirebaseModelsResource } from './firebase-models.resource.js';
import { registerActionsResource } from './actions.resource.js';
import { registerUiComponentsResource } from './ui-components.resource.js';
import { registerPipesResource } from './pipes.resource.js';
import { registerFiltersResource } from './filters.resource.js';

/**
 * Aggregates every domain-level `register*Resource` call so server bootstrap
 * stays a single line. Adding a new domain means importing the registrar above
 * and adding one call here.
 *
 * @param server - the MCP server to register resources against
 */
export function registerResources(server: McpServer): void {
  registerFormFieldsResource(server);
  registerFirebaseModelsResource(server);
  registerActionsResource(server);
  registerUiComponentsResource(server);
  registerPipesResource(server);
  registerFiltersResource(server);
}
