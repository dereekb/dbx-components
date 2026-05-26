/**
 * Model-snapshot-fields MCP resources.
 *
 * Exposes the merged snapshot-field registry — opted-in via
 * `@dbxModelSnapshotField` JSDoc tags across @dereekb/firebase (plus any
 * downstream packages) — as read-only resources for clients that prefer
 * browsing data over calling `dbx_model_snapshot_field_lookup`.
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ModelSnapshotFieldRegistry } from '@dereekb/dbx-cli';
import { buildSlugDetailResponse, pickFirstVariable } from './_resource-helpers.js';

const URI = 'dbx://model-snapshot-field/entries';
const TEMPLATE = 'dbx://model-snapshot-field/entries/{slug}';
const BY_CATEGORY_TEMPLATE = 'dbx://model-snapshot-field/entries/category/{category}';
const BY_MODULE_TEMPLATE = 'dbx://model-snapshot-field/entries/module/{module}';
const BY_TAG_TEMPLATE = 'dbx://model-snapshot-field/entries/tag/{tag}';

/**
 * Input to {@link registerModelSnapshotFieldsResource}. The registry is
 * supplied by the server bootstrap after loading the bundled
 * model-snapshot-fields manifest plus any external sources declared in
 * `dbx-mcp.config.json`.
 */
export interface RegisterModelSnapshotFieldsResourceOptions {
  readonly registry: ModelSnapshotFieldRegistry;
}

/**
 * Registers the model-snapshot-field MCP resources (catalog, per-slug
 * details, category / module / tag filters) on the given server, mirroring
 * the layout used by other registry resources so clients can browse instead
 * of invoking `dbx_model_snapshot_field_lookup`.
 *
 * @param server - The MCP server to register resources against.
 * @param options - Registry the resources read from.
 */
export function registerModelSnapshotFieldsResource(server: McpServer, options: RegisterModelSnapshotFieldsResourceOptions): void {
  const { registry } = options;

  server.registerResource(
    'dbx-components Model Snapshot Field Entries',
    URI,
    {
      title: 'Model Snapshot Field Entries',
      description: 'Catalog of snapshot-field factories and reusable consts registered via @dbxModelSnapshotField JSDoc tags.',
      mimeType: 'application/json'
    },
    async () => {
      const payload = {
        description: 'All registered @dbxModelSnapshotField snapshot fields.',
        categories: registry.categories,
        modules: registry.modules,
        fields: registry.all.map((e) => ({
          slug: e.slug,
          name: e.name,
          kind: e.kind,
          category: e.category,
          module: e.module,
          subpath: e.subpath,
          signature: e.signature,
          description: e.description,
          optional: e.optional,
          tags: e.tags
        }))
      };
      return {
        contents: [
          {
            uri: URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Model Snapshot Field Entry Details',
    new ResourceTemplate(TEMPLATE, { list: undefined }),
    {
      title: 'Model Snapshot Field Entry Details',
      description: 'Full metadata for a single snapshot-field entry by slug.',
      mimeType: 'application/json'
    },
    async (uri, variables) =>
      buildSlugDetailResponse({
        uri,
        rawSlug: variables.slug,
        resolveEntry: (slug) => registry.findBySlug(slug),
        listAvailableSlugs: () => registry.all.map((e) => e.slug),
        label: 'Model snapshot field'
      })
  );

  server.registerResource(
    'dbx-components Model Snapshot Field Entries by Category',
    new ResourceTemplate(BY_CATEGORY_TEMPLATE, { list: undefined }),
    {
      title: 'Model Snapshot Field Entries by Category',
      description: 'Snapshot-field entries filtered by category (primitive, date, array, map, object, model-key, geo, …).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const category = pickFirstVariable(variables.category);
      let text: string;
      let valid = false;
      if (category && registry.categories.includes(category)) {
        valid = true;
        const fields = registry.findByCategory(category);
        text = JSON.stringify({ category, fields }, null, 2);
      } else {
        text = `Invalid category. Valid values: ${registry.categories.join(', ')}`;
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: valid ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Model Snapshot Field Entries by Module',
    new ResourceTemplate(BY_MODULE_TEMPLATE, { list: undefined }),
    {
      title: 'Model Snapshot Field Entries by Module',
      description: 'Snapshot-field entries filtered by npm module (e.g. @dereekb/firebase).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const module = pickFirstVariable(variables.module);
      let text: string;
      let valid = false;
      if (module && registry.modules.includes(module)) {
        valid = true;
        const fields = registry.findByModule(module);
        text = JSON.stringify({ module, fields }, null, 2);
      } else {
        text = `Invalid module. Valid values: ${registry.modules.join(', ')}`;
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: valid ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Model Snapshot Field Entries by Tag',
    new ResourceTemplate(BY_TAG_TEMPLATE, { list: undefined }),
    {
      title: 'Model Snapshot Field Entries by Tag',
      description: 'Snapshot-field entries filtered by tag (case-insensitive).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const tag = pickFirstVariable(variables.tag);
      let text: string;
      let valid = false;
      if (tag && tag.length > 0) {
        valid = true;
        const fields = registry.findByTag(tag);
        text = JSON.stringify({ tag, fields }, null, 2);
      } else {
        text = 'No tag provided.';
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: valid ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );
}
