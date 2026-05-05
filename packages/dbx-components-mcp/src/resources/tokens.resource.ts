/**
 * Design-token MCP resources.
 *
 * Exposes the merged dbx-web + Material token catalog as read-only resources
 * for clients that prefer browsing data over calling the `dbx_css_token_lookup` /
 * `dbx_ui_smell_check` tools.
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOKEN_ROLES, TOKEN_SOURCES, type TokenRoleValue, type TokenSourceValue } from '../manifest/tokens-schema.js';
import type { TokenRegistry } from '../registry/tokens-runtime.js';

const TOKENS_URI = 'dbx://token/entries';
const TOKENS_BY_SOURCE_TEMPLATE = 'dbx://token/source/{source}';
const TOKENS_BY_ROLE_TEMPLATE = 'dbx://token/role/{role}';
const TOKENS_BY_VAR_TEMPLATE = 'dbx://token/css-var/{cssVariable}';

/**
 * Input to {@link registerTokensResource}. Registry is supplied by the
 * server bootstrap.
 */
export interface RegisterTokensResourceOptions {
  readonly registry: TokenRegistry;
}

/**
 * Registers the tokens MCP resources (catalog, per-source, per-role, per-var
 * details). Keeps in lockstep with the other domain resources.
 *
 * @param server - the MCP server to register resources against
 * @param options - registry the resources read from
 */
export function registerTokensResource(server: McpServer, options: RegisterTokensResourceOptions): void {
  const { registry } = options;
  server.registerResource(
    'dbx-components Tokens',
    TOKENS_URI,
    {
      title: 'Design Tokens',
      description: 'Catalog of dbx-web + Angular Material design tokens (system, MDC, dbx-web aliases).',
      mimeType: 'application/json'
    },
    async () => {
      const payload = {
        description: 'Every registered design token.',
        sourceOrder: TOKEN_SOURCES,
        roleOrder: TOKEN_ROLES,
        tokens: registry.all.map((t) => ({
          cssVariable: t.cssVariable,
          source: t.source,
          role: t.role,
          description: t.description
        }))
      };
      return {
        contents: [
          {
            uri: TOKENS_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Tokens by Source',
    new ResourceTemplate(TOKENS_BY_SOURCE_TEMPLATE, { list: undefined }),
    {
      title: 'Tokens by Source',
      description: 'Tokens filtered by origin: dbx-web, mat-sys, mdc, app.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawSource = variables.source;
      const source = (Array.isArray(rawSource) ? rawSource[0] : rawSource) as TokenSourceValue | undefined;
      const valid = source !== undefined && (TOKEN_SOURCES as readonly string[]).includes(source);
      let text: string;
      if (valid && source !== undefined) {
        const tokens = registry.bySource.get(source) ?? [];
        text = JSON.stringify({ source, tokens }, null, 2);
      } else {
        text = `Invalid source. Valid values: ${TOKEN_SOURCES.join(', ')}`;
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
    'dbx-components Tokens by Role',
    new ResourceTemplate(TOKENS_BY_ROLE_TEMPLATE, { list: undefined }),
    {
      title: 'Tokens by Role',
      description: 'Tokens filtered by role (color, surface, spacing, radius, ...).',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawRole = variables.role;
      const role = (Array.isArray(rawRole) ? rawRole[0] : rawRole) as TokenRoleValue | undefined;
      const valid = role !== undefined && (TOKEN_ROLES as readonly string[]).includes(role);
      let text: string;
      if (valid && role !== undefined) {
        const tokens = registry.byRole.get(role) ?? [];
        text = JSON.stringify({ role, tokens }, null, 2);
      } else {
        text = `Invalid role. Valid values: ${TOKEN_ROLES.join(', ')}`;
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
    'dbx-components Token Details',
    new ResourceTemplate(TOKENS_BY_VAR_TEMPLATE, { list: undefined }),
    {
      title: 'Token Details',
      description: 'Full metadata for a single token by CSS variable name.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const rawVar = variables.cssVariable;
      const cssVariable = Array.isArray(rawVar) ? rawVar[0] : rawVar;
      let text: string;
      let entry;
      if (cssVariable !== undefined) {
        entry = registry.findByCssVariable(cssVariable) ?? registry.findByScssVariable(cssVariable);
      }
      if (entry !== undefined) {
        text = JSON.stringify(entry, null, 2);
      } else if (cssVariable === undefined) {
        text = 'No cssVariable provided.';
      } else {
        text = `Token '${cssVariable}' not found.`;
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: entry === undefined ? 'text/plain' : 'application/json',
            text
          }
        ]
      };
    }
  );
}
