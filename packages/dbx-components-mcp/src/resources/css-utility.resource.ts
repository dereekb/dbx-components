/**
 * CSS-utility-class MCP resources.
 *
 * Exposes the merged dbx-web (and downstream-app) utility-class catalog as
 * read-only resources for clients that prefer browsing data over calling
 * the `dbx_css_class_lookup` tool.
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CSS_UTILITY_ROLES, type CssUtilityRoleValue } from '../manifest/css-utilities-schema.js';
import type { CssUtilityRegistry } from '../registry/css-utilities-runtime.js';

const CSS_UTILITY_URI = 'dbx://css-utility/entries';
const CSS_UTILITY_BY_SLUG_TEMPLATE = 'dbx://css-utility/entries/{slug}';
const CSS_UTILITY_BY_ROLE_TEMPLATE = 'dbx://css-utility/role/{role}';
const CSS_UTILITY_BY_SOURCE_TEMPLATE = 'dbx://css-utility/source/{source}';
const CSS_UTILITY_BY_PARENT_TEMPLATE = 'dbx://css-utility/parent/{slug}';

/**
 * Input to {@link registerCssUtilityResource}. Registry is supplied by the
 * server bootstrap.
 */
export interface RegisterCssUtilityResourceOptions {
  readonly registry: CssUtilityRegistry;
}

/**
 * Registers the css-utility MCP resources. Keeps in lockstep with the
 * other domain resources.
 *
 * @param server - the MCP server to register resources against
 * @param options - registry the resources read from
 */
export function registerCssUtilityResource(server: McpServer, options: RegisterCssUtilityResourceOptions): void {
  const { registry } = options;

  server.registerResource(
    'dbx-components CSS Utilities',
    CSS_UTILITY_URI,
    {
      title: 'CSS Utility Classes',
      description: 'Catalog of curated dbx-web utility classes (and downstream-app additions) with per-rule provenance.',
      mimeType: 'application/json'
    },
    async () => {
      const payload = {
        description: 'Every registered CSS utility class.',
        roleOrder: CSS_UTILITY_ROLES,
        utilities: registry.all.map((u) => ({
          slug: u.slug,
          selector: u.selector,
          source: u.source,
          role: u.role ?? 'misc',
          intent: u.intent
        }))
      };
      return {
        contents: [
          {
            uri: CSS_UTILITY_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components CSS Utility Details',
    new ResourceTemplate(CSS_UTILITY_BY_SLUG_TEMPLATE, { list: undefined }),
    {
      title: 'CSS Utility Details',
      description: 'Full metadata for a single utility class by slug or selector.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawSlug = variables.slug;
      const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
      const entry = slug === undefined ? undefined : registry.findByName(slug);
      let text: string;
      if (entry !== undefined) {
        text = JSON.stringify(entry, null, 2);
      } else if (slug !== undefined) {
        text = `Utility '${slug}' not found.`;
      } else {
        text = 'No slug provided.';
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: entry !== undefined ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components CSS Utilities by Role',
    new ResourceTemplate(CSS_UTILITY_BY_ROLE_TEMPLATE, { list: undefined }),
    {
      title: 'CSS Utilities by Role',
      description: 'Utilities filtered by role (layout, flex, text, spacing, state, interaction, misc).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawRole = variables.role;
      const role = (Array.isArray(rawRole) ? rawRole[0] : rawRole) as CssUtilityRoleValue | undefined;
      const valid = role !== undefined && (CSS_UTILITY_ROLES as readonly string[]).includes(role);
      let text: string;
      if (valid && role !== undefined) {
        const utilities = registry.byRole.get(role) ?? [];
        text = JSON.stringify({ role, utilities }, null, 2);
      } else {
        text = `Invalid role. Valid values: ${CSS_UTILITY_ROLES.join(', ')}`;
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
    'dbx-components CSS Utilities by Source',
    new ResourceTemplate(CSS_UTILITY_BY_SOURCE_TEMPLATE, { list: undefined }),
    {
      title: 'CSS Utilities by Source',
      description: 'Utilities filtered by source label (e.g. @dereekb/dbx-web).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawSource = variables.source;
      const source = Array.isArray(rawSource) ? rawSource[0] : rawSource;
      let text: string;
      if (source === undefined) {
        text = 'No source provided.';
      } else {
        const utilities = registry.bySource.get(source) ?? [];
        text = JSON.stringify({ source, utilities }, null, 2);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: source !== undefined ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components CSS Utilities by Parent',
    new ResourceTemplate(CSS_UTILITY_BY_PARENT_TEMPLATE, { list: undefined }),
    {
      title: 'CSS Utilities by Parent',
      description: 'Child utilities grouped under a parent slug (e.g. dbx-list-two-line-item). Children are utilities annotated with `/// @parent <slug>`.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawSlug = variables.slug;
      const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
      let text: string;
      if (slug === undefined) {
        text = 'No parent slug provided.';
      } else {
        const children = registry.findChildrenOf(slug);
        text = JSON.stringify({ parent: slug, children }, null, 2);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: slug !== undefined ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );
}
