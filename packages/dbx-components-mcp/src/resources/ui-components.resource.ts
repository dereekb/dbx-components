/**
 * UI Components MCP resources.
 *
 * Exposes the @dereekb/dbx-web UI component registry — components, directives,
 * pipes, and services — as read-only resources for clients that prefer
 * browsing data over calling the `dbx_ui_*` tools.
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { UI_CATEGORY_ORDER, UI_KIND_ORDER, getUiComponents, getUiComponent, getUiComponentsByCategory, getUiComponentsByKind, type UiComponentCategory, type UiComponentKind } from '../registry/index.js';

const UI_COMPONENTS_URI = 'dbx://ui/components';
const UI_COMPONENT_TEMPLATE = 'dbx://ui/components/{slug}';
const UI_COMPONENTS_BY_CATEGORY_TEMPLATE = 'dbx://ui/components/category/{category}';
const UI_COMPONENTS_BY_KIND_TEMPLATE = 'dbx://ui/components/kind/{kind}';

/**
 * Registers the UI-component MCP resources (catalog, per-slug details, plus
 * category and kind filters) on the given server. Mirrors the indexes used by
 * `dbx_ui_lookup` so browsing clients see the same access patterns.
 *
 * @param server - the MCP server to register resources against
 */
export function registerUiComponentsResource(server: McpServer): void {
  server.registerResource(
    'dbx-components UI Components',
    UI_COMPONENTS_URI,
    {
      title: 'UI Components',
      description: 'Catalog of @dereekb/dbx-web components, directives, pipes, and services.',
      mimeType: 'application/json'
    },
    async () => {
      const entries = getUiComponents();
      const payload = {
        description: 'All registered @dereekb/dbx-web UI entries.',
        categoryOrder: UI_CATEGORY_ORDER,
        kindOrder: UI_KIND_ORDER,
        components: entries.map((c) => ({
          slug: c.slug,
          className: c.className,
          selector: c.selector,
          category: c.category,
          kind: c.kind,
          description: c.description
        }))
      };
      return {
        contents: [
          {
            uri: UI_COMPONENTS_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components UI Component Details',
    new ResourceTemplate(UI_COMPONENT_TEMPLATE, { list: undefined }),
    {
      title: 'UI Component Details',
      description: 'Full metadata for a single UI entry by slug, class name, or selector.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawSlug = variables.slug;
      const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
      const entry = slug ? getUiComponent(slug) : undefined;

      let text: string;
      if (!slug) {
        text = 'No slug provided.';
      } else if (entry) {
        text = JSON.stringify(entry, null, 2);
      } else {
        const available = getUiComponents()
          .map((c) => c.slug)
          .join(', ');
        text = `UI component '${slug}' not found. Available slugs: ${available}`;
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
    'dbx-components UI Components by Category',
    new ResourceTemplate(UI_COMPONENTS_BY_CATEGORY_TEMPLATE, { list: undefined }),
    {
      title: 'UI Components by Category',
      description: 'UI entries filtered by visual/functional category (layout, list, button, ...).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawCategory = variables.category;
      const category = (Array.isArray(rawCategory) ? rawCategory[0] : rawCategory) as UiComponentCategory | undefined;

      const valid = category && UI_CATEGORY_ORDER.includes(category);
      let text: string;
      if (valid) {
        const components = getUiComponentsByCategory(category);
        text = JSON.stringify({ category, components }, null, 2);
      } else {
        text = `Invalid category. Valid values: ${UI_CATEGORY_ORDER.join(', ')}`;
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
    'dbx-components UI Components by Kind',
    new ResourceTemplate(UI_COMPONENTS_BY_KIND_TEMPLATE, { list: undefined }),
    {
      title: 'UI Components by Kind',
      description: 'UI entries filtered by Angular kind (component, directive, pipe, service).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawKind = variables.kind;
      const kind = (Array.isArray(rawKind) ? rawKind[0] : rawKind) as UiComponentKind | undefined;

      const valid = kind && UI_KIND_ORDER.includes(kind);
      let text: string;
      if (valid) {
        const components = getUiComponentsByKind(kind);
        text = JSON.stringify({ kind, components }, null, 2);
      } else {
        text = `Invalid kind. Valid values: ${UI_KIND_ORDER.join(', ')}`;
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
