/**
 * Semantic-types MCP resources.
 *
 * Exposes the merged semantic-types registry as read-only resources for
 * clients that prefer browsing registry data over calling tools. Companion
 * to `dbx_semantic_type_lookup` / `dbx_semantic_type_search` which consume
 * the same registry.
 *
 * URI scheme:
 *
 *   dbx://semantic-type/entries                — full catalog summary
 *   dbx://semantic-type/entries/{name}         — single entry by name
 *   dbx://semantic-type/topic/{topic}          — entries tagged with topic
 *   dbx://semantic-type/package/{package}      — entries from one package
 *
 * The registry is loaded asynchronously at server startup (see
 * `loadSemanticTypeRegistry` and `createServer()`), so the registrar takes
 * the registry as a parameter rather than importing it from a module-level
 * static.
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SemanticTypeRegistry } from '../registry/semantic-types.js';

const SEMANTIC_TYPES_URI = 'dbx://semantic-type/entries';
const SEMANTIC_TYPE_ENTRY_TEMPLATE = 'dbx://semantic-type/entries/{name}';
const SEMANTIC_TYPE_BY_TOPIC_TEMPLATE = 'dbx://semantic-type/topic/{topic}';
const SEMANTIC_TYPE_BY_PACKAGE_TEMPLATE = 'dbx://semantic-type/package/{package}';

/**
 * Configuration for {@link registerSemanticTypesResource}.
 */
export interface RegisterSemanticTypesResourceConfig {
  readonly registry: SemanticTypeRegistry;
}

/**
 * Registers the four semantic-types MCP resources (catalog, per-name lookup,
 * per-topic listing, per-package listing) on the given server. Mirrors the
 * pattern used by {@link registerFirebaseModelsResource}.
 *
 * @param server - the MCP server to register resources against
 * @param config - the registry to expose
 */
export function registerSemanticTypesResource(server: McpServer, config: RegisterSemanticTypesResourceConfig): void {
  const { registry } = config;

  server.registerResource(
    'dbx-components Semantic Types',
    SEMANTIC_TYPES_URI,
    {
      title: 'Semantic Types',
      description: 'Catalog summary of every semantic type loaded from @dereekb/* and downstream-app manifests.',
      mimeType: 'application/json'
    },
    async () => {
      const payload = {
        description: 'Merged semantic-types registry.',
        loadedSources: registry.loadedSources,
        totalEntries: registry.all.length,
        topics: registry.topics,
        packages: registry.packages,
        baseTypes: registry.baseTypes,
        names: registry.all.map((e) => `${e.package}::${e.name}`)
      };
      return {
        contents: [
          {
            uri: SEMANTIC_TYPES_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Semantic Type Entry',
    new ResourceTemplate(SEMANTIC_TYPE_ENTRY_TEMPLATE, { list: undefined }),
    {
      title: 'Semantic Type Entry',
      description: 'Full metadata for a single semantic type by exact name.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawName = variables.name;
      const name = Array.isArray(rawName) ? rawName[0] : rawName;
      const matches = name ? registry.findByName(name) : [];
      let text: string;
      let mimeType: string;
      if (!name) {
        text = 'No semantic-type name provided.';
        mimeType = 'text/plain';
      } else if (matches.length === 0) {
        text = `No semantic type matched '${name}'. Loaded sources: ${registry.loadedSources.join(', ')}`;
        mimeType = 'text/plain';
      } else {
        text = JSON.stringify(matches.length === 1 ? matches[0] : { name, matches }, null, 2);
        mimeType = 'application/json';
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType,
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Semantic Types by Topic',
    new ResourceTemplate(SEMANTIC_TYPE_BY_TOPIC_TEMPLATE, { list: undefined }),
    {
      title: 'Semantic Types by Topic',
      description: 'Semantic-type entries tagged with a given topic (core or namespaced).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawTopic = variables.topic;
      const topic = Array.isArray(rawTopic) ? rawTopic[0] : rawTopic;
      let text: string;
      let mimeType: string;
      if (topic) {
        const entries = registry.findByTopic(topic);
        text = JSON.stringify({ topic, entries }, null, 2);
        mimeType = 'application/json';
      } else {
        text = `No topic supplied. Available topics: ${registry.topics.join(', ')}`;
        mimeType = 'text/plain';
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType,
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Semantic Types by Package',
    new ResourceTemplate(SEMANTIC_TYPE_BY_PACKAGE_TEMPLATE, { list: undefined }),
    {
      title: 'Semantic Types by Package',
      description: 'Semantic-type entries belonging to a single package label (e.g. `@dereekb/util`).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawPackage = variables.package;
      const packageLabel = Array.isArray(rawPackage) ? rawPackage[0] : rawPackage;
      let text: string;
      let mimeType: string;
      if (packageLabel) {
        const entries = registry.findByPackage(packageLabel);
        text = JSON.stringify({ package: packageLabel, entries }, null, 2);
        mimeType = 'application/json';
      } else {
        text = `No package supplied. Available packages: ${registry.packages.join(', ')}`;
        mimeType = 'text/plain';
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType,
            text
          }
        ]
      };
    }
  );
}
