/**
 * MCP resource registration for dbx-components.
 *
 * URIs are namespaced by domain (`dbx://<domain>/...`) so each cluster can
 * grow its own subpaths without colliding. Currently registered:
 *
 *   dbx://form/fields, dbx://form/fields/{slug}, dbx://form/fields/produces/{produces},
 *   dbx://form/fields/tier/{tier}, dbx://form/fields/array-output/{arrayOutput}
 *   dbx://model/firebase, dbx://model/firebase/{name},
 *   dbx://model/firebase/prefix/{prefix}, dbx://model/firebase/subcollections/{parent}
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFormFieldsResource } from './form-fields.resource.js';
import { registerFirebaseModelsResource } from './firebase-models.resource.js';

export function registerResources(server: McpServer): void {
  registerFormFieldsResource(server);
  registerFirebaseModelsResource(server);
}
