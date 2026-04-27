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
import type { ActionRegistry } from '../registry/actions-runtime.js';
import type { FilterRegistry } from '../registry/filters-runtime.js';
import type { ForgeFieldRegistry } from '../registry/forge-fields.js';
import type { PipeRegistry } from '../registry/pipes-runtime.js';
import type { SemanticTypeRegistry } from '../registry/semantic-types.js';
import type { UiComponentRegistry } from '../registry/ui-components-runtime.js';
import { registerFormFieldsResource } from './form-fields.resource.js';
import { registerFirebaseModelsResource } from './firebase-models.resource.js';
import { registerActionsResource } from './actions.resource.js';
import { registerUiComponentsResource } from './ui-components.resource.js';
import { registerPipesResource } from './pipes.resource.js';
import { registerFiltersResource } from './filters.resource.js';
import { registerSemanticTypesResource } from './semantic-types.resource.js';

/**
 * Options consumed by {@link registerResources}. Mirrors {@link RegisterToolsOptions}
 * — registries are loaded asynchronously at startup, so the resource registrar
 * takes them via this options bag. When a registry is omitted, the resources
 * that depend on it are skipped.
 */
export interface RegisterResourcesOptions {
  readonly semanticTypeRegistry?: SemanticTypeRegistry;
  readonly forgeFieldRegistry?: ForgeFieldRegistry;
  readonly pipeRegistry?: PipeRegistry;
  readonly uiComponentRegistry?: UiComponentRegistry;
  readonly actionRegistry?: ActionRegistry;
  readonly filterRegistry?: FilterRegistry;
}

/**
 * Aggregates every domain-level `register*Resource` call so server bootstrap
 * stays a single line. Adding a new domain means importing the registrar above
 * and adding one call here.
 *
 * @param server - the MCP server to register resources against
 * @param options - optional registry handles passed to dynamic resources
 */
export function registerResources(server: McpServer, options: RegisterResourcesOptions = {}): void {
  if (options.forgeFieldRegistry !== undefined) {
    registerFormFieldsResource(server, { registry: options.forgeFieldRegistry });
  }
  registerFirebaseModelsResource(server);
  if (options.actionRegistry !== undefined) {
    registerActionsResource(server, { registry: options.actionRegistry });
  }
  if (options.uiComponentRegistry !== undefined) {
    registerUiComponentsResource(server, { registry: options.uiComponentRegistry });
  }
  if (options.pipeRegistry !== undefined) {
    registerPipesResource(server, { registry: options.pipeRegistry });
  }
  if (options.filterRegistry !== undefined) {
    registerFiltersResource(server, { registry: options.filterRegistry });
  }
  if (options.semanticTypeRegistry !== undefined) {
    registerSemanticTypesResource(server, { registry: options.semanticTypeRegistry });
  }
}
