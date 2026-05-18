/**
 * Utils MCP resources.
 *
 * Exposes the merged utility registry — opted-in via `@dbxUtil` JSDoc
 * tags across @dereekb/util, @dereekb/date, @dereekb/rxjs, @dereekb/model
 * (plus any downstream packages) — as read-only resources for clients
 * that prefer browsing data over calling `dbx_util_lookup`.
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { UtilRegistry } from '../registry/utils-runtime.js';
import { buildSlugDetailResponse, pickFirstVariable } from './_resource-helpers.js';

const UTILS_URI = 'dbx://util/entries';
const UTIL_TEMPLATE = 'dbx://util/entries/{slug}';
const UTILS_BY_CATEGORY_TEMPLATE = 'dbx://util/entries/category/{category}';
const UTILS_BY_MODULE_TEMPLATE = 'dbx://util/entries/module/{module}';
const UTILS_BY_TAG_TEMPLATE = 'dbx://util/entries/tag/{tag}';

/**
 * Input to {@link registerUtilsResource}. The registry is supplied by the
 * server bootstrap after loading the bundled utils manifests plus any
 * external sources declared in `dbx-mcp.config.json`.
 */
export interface RegisterUtilsResourceOptions {
  readonly registry: UtilRegistry;
}

/**
 * Registers the util-entry MCP resources (catalog, per-slug details,
 * category / module / tag filters) on the given server, mirroring the
 * layout used by other registry resources so clients can browse instead
 * of invoking `dbx_util_lookup`.
 *
 * @param server - The MCP server to register resources against.
 * @param options - Registry the resources read from.
 */
export function registerUtilsResource(server: McpServer, options: RegisterUtilsResourceOptions): void {
  const { registry } = options;

  server.registerResource(
    'dbx-components Util Entries',
    UTILS_URI,
    {
      title: 'Util Entries',
      description: 'Catalog of utility functions, classes, factories, and constants registered via @dbxUtil JSDoc tags.',
      mimeType: 'application/json'
    },
    async () => {
      const payload = {
        description: 'All registered @dbxUtil utilities.',
        categories: registry.categories,
        modules: registry.modules,
        utils: registry.all.map((e) => ({
          slug: e.slug,
          name: e.name,
          kind: e.kind,
          category: e.category,
          module: e.module,
          subpath: e.subpath,
          signature: e.signature,
          description: e.description,
          tags: e.tags
        }))
      };
      return {
        contents: [
          {
            uri: UTILS_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Util Entry Details',
    new ResourceTemplate(UTIL_TEMPLATE, { list: undefined }),
    {
      title: 'Util Entry Details',
      description: 'Full metadata for a single utility entry by slug.',
      mimeType: 'application/json'
    },
    async (uri, variables) =>
      buildSlugDetailResponse({
        uri,
        rawSlug: variables.slug,
        resolveEntry: (slug) => registry.findBySlug(slug),
        listAvailableSlugs: () => registry.all.map((e) => e.slug),
        label: 'Util'
      })
  );

  server.registerResource(
    'dbx-components Util Entries by Category',
    new ResourceTemplate(UTILS_BY_CATEGORY_TEMPLATE, { list: undefined }),
    {
      title: 'Util Entries by Category',
      description: 'Util entries filtered by category (path-derived: date, promise, array, …).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const category = pickFirstVariable(variables.category);
      let text: string;
      let valid = false;
      if (category && registry.categories.includes(category)) {
        valid = true;
        const utils = registry.findByCategory(category);
        text = JSON.stringify({ category, utils }, null, 2);
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
    'dbx-components Util Entries by Module',
    new ResourceTemplate(UTILS_BY_MODULE_TEMPLATE, { list: undefined }),
    {
      title: 'Util Entries by Module',
      description: 'Util entries filtered by npm module (e.g. @dereekb/util).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const module = pickFirstVariable(variables.module);
      let text: string;
      let valid = false;
      if (module && registry.modules.includes(module)) {
        valid = true;
        const utils = registry.findByModule(module);
        text = JSON.stringify({ module, utils }, null, 2);
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
    'dbx-components Util Entries by Tag',
    new ResourceTemplate(UTILS_BY_TAG_TEMPLATE, { list: undefined }),
    {
      title: 'Util Entries by Tag',
      description: 'Util entries filtered by tag (case-insensitive).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const tag = pickFirstVariable(variables.tag);
      let text: string;
      let valid = false;
      if (tag && tag.length > 0) {
        valid = true;
        const utils = registry.findByTag(tag);
        text = JSON.stringify({ tag, utils }, null, 2);
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
