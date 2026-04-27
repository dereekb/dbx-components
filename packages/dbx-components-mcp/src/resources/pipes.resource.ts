/**
 * Pipes MCP resources.
 *
 * Exposes the @dereekb/dbx-core Angular pipe registry — value pipes, the
 * date-pipe family, the async helper, etc. — as read-only resources for
 * clients that prefer browsing data over calling `dbx_pipe_lookup`.
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PIPE_CATEGORY_ORDER, type PipeCategory, type PipeRegistry } from '../registry/pipes-runtime.js';

const PIPES_URI = 'dbx://pipe/entries';
const PIPE_TEMPLATE = 'dbx://pipe/entries/{slug}';
const PIPES_BY_CATEGORY_TEMPLATE = 'dbx://pipe/entries/category/{category}';

/**
 * Input to {@link registerPipesResource}. The registry is supplied by the
 * server bootstrap after loading the bundled pipes manifest plus any external
 * sources declared in `dbx-mcp.config.json`.
 */
export interface RegisterPipesResourceOptions {
  readonly registry: PipeRegistry;
}

/**
 * Registers the pipe-entry MCP resources (catalog, per-slug details, category
 * filter) on the given server, mirroring the layout used by other registry
 * resources so clients can browse instead of invoking `dbx_pipe_lookup`.
 *
 * @param server - the MCP server to register resources against
 * @param options - registry the resources read from
 */
export function registerPipesResource(server: McpServer, options: RegisterPipesResourceOptions): void {
  const { registry } = options;
  server.registerResource(
    'dbx-components Pipe Entries',
    PIPES_URI,
    {
      title: 'Pipe Entries',
      description: 'Catalog of @dereekb/dbx-core Angular pipes (value, date, async, misc).',
      mimeType: 'application/json'
    },
    async () => {
      const payload = {
        description: 'All registered @dereekb/dbx-core Angular pipes.',
        categoryOrder: PIPE_CATEGORY_ORDER,
        pipes: registry.all.map((e) => ({
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
      const entry = slug ? registry.findBySlug(slug) : undefined;

      let text: string;
      if (slug && entry) {
        text = JSON.stringify(entry, null, 2);
      } else if (slug) {
        const available = registry.all.map((e) => e.slug).join(', ');
        text = `Pipe '${slug}' not found. Available slugs: ${available}`;
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
      if (valid) {
        const pipes = registry.findByCategory(category);
        text = JSON.stringify({ category, pipes }, null, 2);
      } else {
        text = `Invalid category. Valid values: ${PIPE_CATEGORY_ORDER.join(', ')}`;
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
