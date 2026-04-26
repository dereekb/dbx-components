/**
 * Filters MCP resources.
 *
 * Exposes the @dereekb/dbx-core filter registry — `DbxFilterSourceDirective`,
 * source/connector pairings, the `FilterMap` variants, and the
 * `ClickableFilterPreset` shape — as read-only resources for clients that
 * prefer browsing data over calling `dbx_filter_lookup`.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FILTER_ENTRIES, FILTER_KIND_ORDER, getFilterEntries, getFilterEntriesByKind, getFilterEntry, type FilterEntryKind } from '../tools/data/filter-entries.js';

const FILTERS_URI = 'dbx://filter/entries';
const FILTER_TEMPLATE = 'dbx://filter/entries/{slug}';
const FILTERS_BY_KIND_TEMPLATE = 'dbx://filter/entries/kind/{kind}';

export function registerFiltersResource(server: McpServer): void {
  server.registerResource(
    'dbx-components Filter Entries',
    FILTERS_URI,
    {
      title: 'Filter Entries',
      description: 'Catalog of @dereekb/dbx-core filter directives and presets.',
      mimeType: 'application/json'
    },
    async () => {
      const entries = getFilterEntries();
      const payload = {
        description: 'All registered @dereekb/dbx-core filter entries.',
        kindOrder: FILTER_KIND_ORDER,
        filters: entries.map((e) => ({
          slug: e.slug,
          kind: e.kind,
          className: e.className,
          selector: e.selector,
          description: e.description
        }))
      };
      const result = {
        contents: [
          {
            uri: FILTERS_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
      return result;
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
      const entry = slug ? getFilterEntry(slug) : undefined;

      let text: string;
      if (!slug) {
        text = 'No slug provided.';
      } else if (!entry) {
        const available = FILTER_ENTRIES.map((e) => e.slug).join(', ');
        text = `Filter '${slug}' not found. Available slugs: ${available}`;
      } else {
        text = JSON.stringify(entry, null, 2);
      }

      const result = {
        contents: [
          {
            uri: uri.href,
            mimeType: entry ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
      return result;
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
      const kind = (Array.isArray(rawKind) ? rawKind[0] : rawKind) as FilterEntryKind | undefined;

      const valid = kind && FILTER_KIND_ORDER.includes(kind);
      let text: string;
      if (!valid) {
        text = `Invalid kind. Valid values: ${FILTER_KIND_ORDER.join(', ')}`;
      } else {
        const filters = getFilterEntriesByKind(kind);
        text = JSON.stringify({ kind, filters }, null, 2);
      }

      const result = {
        contents: [
          {
            uri: uri.href,
            mimeType: valid ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
      return result;
    }
  );
}
