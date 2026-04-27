/**
 * Actions MCP resources.
 *
 * Exposes the @dereekb/dbx-core action registry — directives, the underlying
 * `ActionContextStore`, and the `DbxActionState` enum — as read-only resources
 * for clients that prefer browsing data over calling tools. Companion to the
 * `dbx_action_*` tool family which consumes the same registry.
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ACTION_ROLE_ORDER, type ActionEntryRole, type ActionRegistry } from '../registry/actions-runtime.js';

const ACTIONS_URI = 'dbx://action/entries';
const ACTION_TEMPLATE = 'dbx://action/entries/{slug}';
const ACTIONS_BY_ROLE_TEMPLATE = 'dbx://action/entries/role/{role}';

/**
 * Input to {@link registerActionsResource}. The registry is supplied by the
 * server bootstrap after loading the bundled `@dereekb/dbx-core` actions
 * manifest plus any external sources declared in `dbx-mcp.config.json`.
 */
export interface RegisterActionsResourceOptions {
  readonly registry: ActionRegistry;
}

/**
 * Registers the action-entry MCP resources (catalog, per-slug details, role
 * filter) on the given server. Splitting into three URIs lets clients browse
 * the full registry, drill into a single entry, or page by role classification.
 *
 * @param server - the MCP server to register resources against
 * @param options - registry the resources read from
 */
export function registerActionsResource(server: McpServer, options: RegisterActionsResourceOptions): void {
  const { registry } = options;
  server.registerResource(
    'dbx-components Action Entries',
    ACTIONS_URI,
    {
      title: 'Action Entries',
      description: 'Catalog of @dereekb/dbx-core action directives, the ActionContextStore, and DbxActionState members.',
      mimeType: 'application/json'
    },
    async () => {
      const payload = {
        description: 'All registered @dereekb/dbx-core action entries.',
        roleOrder: ACTION_ROLE_ORDER,
        entries: registry.all.map((entry) => {
          let className: string | undefined;
          if (entry.role === 'directive' || entry.role === 'store') {
            className = entry.className;
          }
          let selector: string | undefined;
          if (entry.role === 'directive') {
            selector = entry.selector;
          }
          return {
            slug: entry.slug,
            role: entry.role,
            className,
            selector,
            description: entry.description
          };
        })
      };
      return {
        contents: [
          {
            uri: ACTIONS_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Action Entry Details',
    new ResourceTemplate(ACTION_TEMPLATE, { list: undefined }),
    {
      title: 'Action Entry Details',
      description: 'Full metadata for a single action entry by slug.',
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
        text = `Action entry '${slug}' not found. Available slugs: ${available}`;
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
    'dbx-components Action Entries by Role',
    new ResourceTemplate(ACTIONS_BY_ROLE_TEMPLATE, { list: undefined }),
    {
      title: 'Action Entries by Role',
      description: 'Action entries filtered by role (directive, store, state).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawRole = variables.role;
      const role = (Array.isArray(rawRole) ? rawRole[0] : rawRole) as ActionEntryRole | undefined;

      const valid = role !== undefined && ACTION_ROLE_ORDER.includes(role);
      let text: string;
      if (valid && role !== undefined) {
        const entries = registry.findByRole(role);
        text = JSON.stringify({ role, entries }, null, 2);
      } else {
        text = `Invalid role. Valid values: ${ACTION_ROLE_ORDER.join(', ')}`;
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
