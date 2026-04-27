/**
 * UI Components MCP resources.
 *
 * Exposes the @dereekb/dbx-web UI component registry — components, directives,
 * pipes, and services — as read-only resources for clients that prefer
 * browsing data over calling the `dbx_ui_*` tools.
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { UI_COMPONENT_CATEGORIES, UI_COMPONENT_KINDS, type UiComponentCategoryValue, type UiComponentKindValue } from '../manifest/ui-components-schema.js';
import type { UiComponentRegistry } from '../registry/ui-components-runtime.js';

const UI_COMPONENTS_URI = 'dbx://ui/components';
const UI_COMPONENT_TEMPLATE = 'dbx://ui/components/{slug}';
const UI_COMPONENTS_BY_CATEGORY_TEMPLATE = 'dbx://ui/components/category/{category}';
const UI_COMPONENTS_BY_KIND_TEMPLATE = 'dbx://ui/components/kind/{kind}';

/**
 * Input to {@link registerUiComponentsResource}. The registry is supplied by
 * the server bootstrap after loading the bundled `@dereekb/dbx-web`
 * ui-components manifest plus any external sources declared in
 * `dbx-mcp.config.json`.
 */
export interface RegisterUiComponentsResourceOptions {
  readonly registry: UiComponentRegistry;
}

/**
 * Registers the UI-component MCP resources (catalog, per-slug details, plus
 * category and kind filters) on the given server. Mirrors the indexes used by
 * `dbx_ui_lookup` so browsing clients see the same access patterns.
 *
 * @param server - the MCP server to register resources against
 * @param options - registry the resources read from
 */
export function registerUiComponentsResource(server: McpServer, options: RegisterUiComponentsResourceOptions): void {
  const { registry } = options;
  server.registerResource(
    'dbx-components UI Components',
    UI_COMPONENTS_URI,
    {
      title: 'UI Components',
      description: 'Catalog of @dereekb/dbx-web components, directives, pipes, and services.',
      mimeType: 'application/json'
    },
    async () => {
      const payload = {
        description: 'All registered @dereekb/dbx-web UI entries.',
        categoryOrder: UI_COMPONENT_CATEGORIES,
        kindOrder: UI_COMPONENT_KINDS,
        components: registry.all.map((c) => ({
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

      let entry;
      if (slug) {
        const slugHits = registry.findBySlug(slug);
        entry = slugHits.length > 0 ? slugHits[0] : (registry.findByClassName(slug) ?? registry.findBySelector(slug));
      }

      let text: string;
      if (slug && entry) {
        text = JSON.stringify(entry, null, 2);
      } else if (slug) {
        const available = registry.all.map((c) => c.slug).join(', ');
        text = `UI component '${slug}' not found. Available slugs: ${available}`;
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
    'dbx-components UI Components by Category',
    new ResourceTemplate(UI_COMPONENTS_BY_CATEGORY_TEMPLATE, { list: undefined }),
    {
      title: 'UI Components by Category',
      description: 'UI entries filtered by visual/functional category (layout, list, button, ...).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawCategory = variables.category;
      const category = (Array.isArray(rawCategory) ? rawCategory[0] : rawCategory) as UiComponentCategoryValue | undefined;

      const valid = category !== undefined && UI_COMPONENT_CATEGORIES.includes(category);
      let text: string;
      if (valid && category !== undefined) {
        const components = registry.findByCategory(category);
        text = JSON.stringify({ category, components }, null, 2);
      } else {
        text = `Invalid category. Valid values: ${UI_COMPONENT_CATEGORIES.join(', ')}`;
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
      const kind = (Array.isArray(rawKind) ? rawKind[0] : rawKind) as UiComponentKindValue | undefined;

      const valid = kind !== undefined && UI_COMPONENT_KINDS.includes(kind);
      let text: string;
      if (valid && kind !== undefined) {
        const components = registry.findByKind(kind);
        text = JSON.stringify({ kind, components }, null, 2);
      } else {
        text = `Invalid kind. Valid values: ${UI_COMPONENT_KINDS.join(', ')}`;
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
