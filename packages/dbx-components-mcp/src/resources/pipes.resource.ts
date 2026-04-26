/**
 * Pipes MCP resources.
 *
 * Exposes the @dereekb/dbx-core Angular pipe registry — value pipes, the
 * date-pipe family, the async helper, etc. — as read-only resources for
 * clients that prefer browsing data over calling `dbx_pipe_lookup`.
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PIPE_CATEGORY_ORDER, PIPE_ENTRIES, getPipeEntries, getPipeEntriesByCategory, getPipeEntry, type PipeCategory } from '../tools/data/pipe-entries.js';

const PIPES_URI = 'dbx://pipe/entries';
const PIPE_TEMPLATE = 'dbx://pipe/entries/{slug}';
const PIPES_BY_CATEGORY_TEMPLATE = 'dbx://pipe/entries/category/{category}';

/**
 * Registers the pipe-entry MCP resources (catalog, per-slug details, category
 * filter) on the given server, mirroring the layout used by other registry
 * resources so clients can browse instead of invoking `dbx_pipe_lookup`.
 *
 * @param server - the MCP server to register resources against
 */
export function registerPipesResource(server: McpServer): void {
  server.registerResource(
    'dbx-components Pipe Entries',
    PIPES_URI,
    {
      title: 'Pipe Entries',
      description: 'Catalog of @dereekb/dbx-core Angular pipes (value, date, async, misc).',
      mimeType: 'application/json'
    },
    async () => {
      const entries = getPipeEntries();
      const payload = {
        description: 'All registered @dereekb/dbx-core Angular pipes.',
        categoryOrder: PIPE_CATEGORY_ORDER,
        pipes: entries.map((e) => ({
          slug: e.slug,
          pipeName: e.pipeName,
          className: e.className,
          category: e.category,
          purity: e.purity,
          inputType: e.inputType,
          outputType: e.outputType,
          description: e.description
        }))
      };
      return {
        contents: [
          {
            uri: PIPES_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Pipe Entry Details',
    new ResourceTemplate(PIPE_TEMPLATE, { list: undefined }),
    {
      title: 'Pipe Entry Details',
      description: 'Full metadata for a single pipe by slug.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawSlug = variables.slug;
      const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
      const entry = slug ? getPipeEntry(slug) : undefined;

      let text: string;
      if (!slug) {
        text = 'No slug provided.';
      } else if (!entry) {
        const available = PIPE_ENTRIES.map((e) => e.slug).join(', ');
        text = `Pipe '${slug}' not found. Available slugs: ${available}`;
      } else {
        text = JSON.stringify(entry, null, 2);
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
    'dbx-components Pipe Entries by Category',
    new ResourceTemplate(PIPES_BY_CATEGORY_TEMPLATE, { list: undefined }),
    {
      title: 'Pipe Entries by Category',
      description: 'Pipe entries filtered by category (value, date, async, misc).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawCategory = variables.category;
      const category = (Array.isArray(rawCategory) ? rawCategory[0] : rawCategory) as PipeCategory | undefined;

      const valid = category && PIPE_CATEGORY_ORDER.includes(category);
      let text: string;
      if (!valid) {
        text = `Invalid category. Valid values: ${PIPE_CATEGORY_ORDER.join(', ')}`;
      } else {
        const pipes = getPipeEntriesByCategory(category);
        text = JSON.stringify({ category, pipes }, null, 2);
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
