/**
 * Auth MCP resources.
 *
 * Surfaces the auth catalog (roles + claims + scopes + apps) as read-only
 * resources for clients that prefer browsing data over invoking the
 * `dbx_auth_*` tools.
 */

import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthRegistry } from '@dereekb/dbx-cli';
import { pickFirstVariable } from './_resource-helpers.js';

const AUTH_CATALOG_URI = 'dbx://auth/catalog';
const AUTH_CLAIM_TEMPLATE = 'dbx://auth/claim/{key}';
const AUTH_ROLE_TEMPLATE = 'dbx://auth/role/{role}';
const AUTH_ROLES_BY_TAG_TEMPLATE = 'dbx://auth/role/tag/{tag}';
const AUTH_SCOPE_TEMPLATE = 'dbx://auth/scope/{scope}';
const AUTH_APP_TEMPLATE = 'dbx://auth/app/{app}';

/**
 * Input to {@link registerAuthResource}. The registry is supplied by the
 * server bootstrap after merging built-in entries with downstream
 * overrides.
 */
export interface RegisterAuthResourceOptions {
  readonly registry: AuthRegistry;
}

/**
 * Registers the auth-cluster MCP resources (catalog, per-key/role/scope/app
 * details, role-by-tag filter) on the given server.
 *
 * @param server - The MCP server instance to register resource handlers on.
 * @param options - Registration options carrying the resolved auth registry to query.
 * @param options.registry - Pre-merged auth registry (built-in entries plus downstream overrides) supplied by the server bootstrap.
 */
export function registerAuthResource(server: McpServer, options: RegisterAuthResourceOptions): void {
  const { registry } = options;

  server.registerResource(
    'dbx-components Auth Catalog',
    AUTH_CATALOG_URI,
    {
      title: 'Auth Catalog',
      description: 'Top-level catalog of auth roles, claims, scopes, and per-app surface.',
      mimeType: 'application/json'
    },
    async () => {
      const payload = {
        loadedSources: registry.loadedSources,
        roles: registry.roles.map((r) => ({ role: r.role, constName: r.constName, source: r.source, tags: r.tags, sourcePath: r.sourcePath, sourceLine: r.sourceLine })),
        claims: registry.claims.map((c) => ({ key: c.key, app: c.app, interfaceName: c.interfaceName, source: c.source, mapping: c.mapping, tags: c.tags, sourcePath: c.sourcePath, sourceLine: c.sourceLine })),
        scopes: registry.scopes.map((s) => ({ scope: s.scope, prefix: s.prefix, callType: s.callType, errorCode: s.errorCode, apps: s.apps, sourcePath: s.sourcePath })),
        apps: registry.apps.map((a) => ({ app: a.app, claimsInterfaceName: a.claimsInterfaceName, claimKeys: a.claimKeys, scopes: a.scopes, sourcePath: a.sourcePath, description: a.description }))
      };
      return {
        contents: [
          {
            uri: AUTH_CATALOG_URI,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Auth Claim',
    new ResourceTemplate(AUTH_CLAIM_TEMPLATE, { list: undefined }),
    {
      title: 'Auth Claim',
      description: 'Full metadata for a single claim entry by key.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const key = pickFirstVariable(variables.key);
      const entry = key ? registry.findClaim(key) : undefined;
      let text: string;
      if (entry !== undefined) {
        text = JSON.stringify(entry, null, 2);
      } else if (key) {
        text = `Claim '${key}' not found. Available keys: ${registry.claims.map((c) => c.key).join(', ')}`;
      } else {
        text = 'No key provided.';
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
    'dbx-components Auth Role',
    new ResourceTemplate(AUTH_ROLE_TEMPLATE, { list: undefined }),
    {
      title: 'Auth Role',
      description: 'Full metadata for a single role entry by role string or const name.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const role = pickFirstVariable(variables.role);
      const entry = role ? registry.findRole(role) : undefined;
      let text: string;
      if (entry !== undefined) {
        const claims = registry.findClaimsForRole(entry.role);
        text = JSON.stringify({ ...entry, claims }, null, 2);
      } else if (role) {
        text = `Role '${role}' not found. Available roles: ${registry.roles.map((r) => r.role).join(', ')}`;
      } else {
        text = 'No role provided.';
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
    'dbx-components Auth Roles by Tag',
    new ResourceTemplate(AUTH_ROLES_BY_TAG_TEMPLATE, { list: undefined }),
    {
      title: 'Auth Roles by Tag',
      description: 'Every role tagged with the given tag.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const tag = pickFirstVariable(variables.tag);
      let text: string;
      if (tag) {
        const roles = registry.findRolesByTag(tag);
        text = JSON.stringify({ tag, roles }, null, 2);
      } else {
        text = 'No tag provided.';
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: tag ? 'application/json' : 'text/plain',
            text
          }
        ]
      };
    }
  );

  server.registerResource(
    'dbx-components Auth Scope',
    new ResourceTemplate(AUTH_SCOPE_TEMPLATE, { list: undefined }),
    {
      title: 'Auth Scope',
      description: 'Full metadata for a single OIDC scope by name.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const scope = pickFirstVariable(variables.scope);
      const entry = scope ? registry.findScope(scope) : undefined;
      let text: string;
      if (entry !== undefined) {
        text = JSON.stringify(entry, null, 2);
      } else if (scope) {
        text = `Scope '${scope}' not found. Available: ${registry.scopes.map((s) => s.scope).join(', ')}`;
      } else {
        text = 'No scope provided.';
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
    'dbx-components Auth App',
    new ResourceTemplate(AUTH_APP_TEMPLATE, { list: undefined }),
    {
      title: 'Auth App',
      description: 'Full auth surface (claims + scopes) for a single app.',
      mimeType: 'application/json'
    },
    async (uri, variables) => {
      const app = pickFirstVariable(variables.app);
      const entry = app ? registry.findApp(app) : undefined;
      let text: string;
      if (entry !== undefined) {
        const ownClaims = registry.findClaimsByApp(entry.app);
        const allClaims = entry.claimKeys.map((k) => ownClaims.find((c) => c.key === k) ?? registry.findClaim(k)).filter((c): c is NonNullable<typeof c> => c !== undefined);
        text = JSON.stringify({ ...entry, claims: allClaims, scopes: entry.scopes.map((s) => registry.findScope(s) ?? { scope: s }) }, null, 2);
      } else if (app) {
        text = `App '${app}' not found. Available: ${registry.apps.map((a) => a.app).join(', ')}`;
      } else {
        text = 'No app provided.';
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
}
