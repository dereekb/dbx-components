/**
 * Filters MCP resources.
 *
 * Exposes the @dereekb/dbx-core filter registry — `DbxFilterSourceDirective`,
 * source/connector pairings, the `FilterMap` variants, and the
 * `ClickableFilterPreset` shape — as read-only resources for clients that
 * prefer browsing data over calling `dbx_filter_lookup`.
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FILTER_KIND_ORDER, type FilterKind, type FilterRegistry } from '../registry/filters-runtime.js';

const FILTERS_URI = 'dbx://filter/entries';
const FILTER_TEMPLATE = 'dbx://filter/entries/{slug}';
const FILTERS_BY_KIND_TEMPLATE = 'dbx://filter/entries/kind/{kind}';

/**
 * Input to {@link registerFiltersResource}. The registry is supplied by the
 * server bootstrap after loading the bundled filters manifest plus any
 * external sources declared in `dbx-mcp.config.json`.
 */
export interface RegisterFiltersResourceOptions {
  readonly registry: FilterRegistry;
}

/**
 * Registers the filter-entry MCP resources (catalog, per-slug details, kind
 * filter) on the given server, mirroring the layout used by other registry
 * resources so clients can browse instead of invoking `dbx_filter_lookup`.
 *
 * @param server - the MCP server to register resources against
 * @param options - registry the resources read from
 */
export function registerFiltersResource(server: McpServer, options: RegisterFiltersResourceOptions): void {
  const { registry } = options;
  server.registerResource(
    'dbx-components Filter Entries',
    FILTERS_URI,
    {
      title: 'Filter Entries',
      description: 'Catalog of @dereekb/dbx-core filter directives and presets.',
      mimeType: 'application/json'
    },
    async () => {
      const payload = {
        description: 'All registered @dereekb/dbx-core filter entries.',
        kindOrder: FILTER_KIND_ORDER,
        filters: registry.all.map((e) => ({
          slug: e.slug,
          kind: e.kind,
          className: e.className,
          selector: e.selector,
          description: e.description
        }))
      };
      return {
        contents: [
          {
            uri: FILTERS_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Filter Entry Details',
    new ResourceTemplate(FILTER_TEMPLATE, { list: undefined }),
    {
      title: 'Filter Entry Details',
      description: 'Full metadata for a single filter entry by slug.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawSlug = variables.slug;
      const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
      const entry = slug ? registry.findBySlug(slug) : undefined;

      let text: string;
      if (slug && entry) {
        text = JSON.stringify(entry, null, 2);
      } else if (slug) {
        const available = registry.all.map((e) => e.slug).join(', ');
        text = `Filter '${slug}' not found. Available slugs: ${available}`;
      } else {
        text = 'No slug provided.';
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: entry ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Filter Entries by Kind',
    new ResourceTemplate(FILTERS_BY_KIND_TEMPLATE, { list: undefined }),
    {
      title: 'Filter Entries by Kind',
      description: 'Filter entries filtered by kind (directive, pattern).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawKind = variables.kind;
      const kind = (Array.isArray(rawKind) ? rawKind[0] : rawKind) as FilterKind | undefined;

      const valid = kind && FILTER_KIND_ORDER.includes(kind);
      let text: string;
      if (valid) {
        const filters = registry.findByKind(kind);
        text = JSON.stringify({ kind, filters }, null, 2);
      } else {
        text = `Invalid kind. Valid values: ${FILTER_KIND_ORDER.join(', ')}`;
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
