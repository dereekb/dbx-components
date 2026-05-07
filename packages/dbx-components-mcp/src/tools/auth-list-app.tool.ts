/**
 * `dbx_auth_list_app` tool.
 *
 * For a specific app slug (`demo-api`, `hellosubs-api`), enumerates all
 * custom claims, the OIDC scopes the app accepts, and a summary of the
 * server-action gates wired into the app. Returns markdown.
 *
 * Today the gate enumeration is sourced from the registry's app entry
 * — the planned scan-driven loader will additionally walk the app's
 * source tree to surface app-defined `enforceOidcScopes` and
 * `callModel` middleware references.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import type { AuthAppInfo, AuthClaimInfo, AuthRegistry } from '../registry/auth-runtime.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DBX_AUTH_LIST_APP_TOOL: Tool = {
  name: 'dbx_auth_list_app',
  description: ['Enumerate the auth surface of one app: every custom claim on its `*ApiAuthClaims` interface, every OIDC scope it accepts, and every server-action gate wired up.', '', 'Pass `app="list"` to enumerate the apps catalogued by the registry.'].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      app: { type: 'string', description: 'App slug (e.g. `demo-api`) or "list".' }
    },
    required: ['app']
  }
};

const ListAppArgsType = type({
  app: 'string'
});

interface CreateAuthListAppToolInput {
  readonly registry: AuthRegistry;
}

export function createAuthListAppTool(input: CreateAuthListAppToolInput): DbxTool {
  const { registry } = input;
  const tool: DbxTool = {
    definition: DBX_AUTH_LIST_APP_TOOL,
    run(rawArgs) {
      const parsed = ListAppArgsType(rawArgs);
      if (parsed instanceof type.errors) {
        return toolError(`Invalid arguments: ${parsed.summary}`);
      }
      const { app } = parsed;
      const normalized = app.trim();
      let result: ToolResult;
      if (isCatalogTopic(normalized)) {
        result = { content: [{ type: 'text', text: formatAppCatalog(registry.apps) }] };
      } else {
        const entry = registry.findApp(normalized);
        if (entry === undefined) {
          result = { content: [{ type: 'text', text: formatNotFound(normalized, registry.apps) }] };
        } else {
          const claims = registry.findClaimsByApp(entry.app);
          const text = formatApp(entry, claims, registry);
          result = { content: [{ type: 'text', text }] };
        }
      }
      return result;
    }
  };
  return tool;
}

function isCatalogTopic(app: string): boolean {
  const lowered = app.toLowerCase();
  return lowered === 'list' || lowered === 'all' || lowered === 'catalog';
}

function formatAppCatalog(apps: readonly AuthAppInfo[]): string {
  const lines: string[] = ['# Apps in auth catalog', '', `${apps.length} app${apps.length === 1 ? '' : 's'}.`, ''];
  if (apps.length === 0) {
    lines.push('No apps registered.');
  } else {
    for (const app of apps) {
      lines.push(`- \`${app.app}\` → \`${app.claimsInterfaceName}\` (${app.claimKeys.length} claim${app.claimKeys.length === 1 ? '' : 's'}, ${app.scopes.length} scope${app.scopes.length === 1 ? '' : 's'})`);
      if (app.description !== undefined) {
        lines.push(`  ${app.description}`);
      }
    }
  }
  return lines.join('\n').trimEnd();
}

function formatApp(app: AuthAppInfo, ownClaims: readonly AuthClaimInfo[], registry: AuthRegistry): string {
  const lines: string[] = [`# App \`${app.app}\``, ''];
  if (app.description !== undefined) lines.push(app.description, '');
  lines.push(bullet('claims interface', `\`${app.claimsInterfaceName}\``));
  if (app.serviceConstName !== undefined) lines.push(bullet('service const', `\`${app.serviceConstName}\``));
  lines.push(bullet('source', `\`${app.sourcePath}\``), '');

  // Resolve every claim listed on the app, including inherited ones (e.g. `fr`
  // from StorageFileUploadUserClaims) — `ownClaims` only includes app-owned
  // entries; the rest come from `registry.findClaim` with no scope.
  const allClaims: AuthClaimInfo[] = [];
  for (const key of app.claimKeys) {
    const owned = ownClaims.find((c) => c.key === key);
    const claim = owned ?? registry.findClaim(key);
    if (claim !== undefined) allClaims.push(claim);
  }

  lines.push('## Custom claims', '');
  if (allClaims.length === 0) {
    lines.push('_(none)_');
  } else {
    for (const claim of allClaims) {
      const arrow = claim.mapping.inverse ? 'revokes' : 'grants';
      const roles = claim.mapping.roles.map((r) => '`' + r + '`').join(', ') || '_(none)_';
      const owner = claim.app ? '' : ' _(inherited)_';
      const lineRef = claim.sourceLine !== undefined ? `:${claim.sourceLine}` : '';
      lines.push(`- \`${claim.key}\`${owner} on \`${claim.interfaceName ?? '?'}\` — ${arrow} ${roles}`);
      lines.push(`  ${claim.description} (\`${claim.sourcePath}${lineRef}\`)`);
    }
  }

  lines.push('', '## OIDC scopes', '');
  if (app.scopes.length === 0) {
    lines.push('_(none)_');
  } else {
    for (const scopeName of app.scopes) {
      const scope = registry.findScope(scopeName);
      if (scope !== undefined) {
        lines.push(`- \`${scopeName}\` — ${scope.description}`);
        for (const gate of scope.enforcedAt) {
          const lineRef = gate.line !== undefined ? `:${gate.line}` : '';
          lines.push(`  Enforced at \`${gate.path}${lineRef}\` — ${gate.description}`);
        }
      } else {
        lines.push(`- \`${scopeName}\` — _(not catalogued)_`);
      }
    }
  }
  return lines.join('\n');
}

function formatNotFound(app: string, apps: readonly AuthAppInfo[]): string {
  const lines: string[] = [`No app matched \`${app}\`.`, ''];
  if (apps.length > 0) {
    lines.push('Available apps:');
    for (const a of apps) {
      lines.push(`- \`${a.app}\``);
    }
  } else {
    lines.push('No apps registered. The auth catalog is empty.');
  }
  return lines.join('\n');
}

function bullet(label: string, value: string): string {
  return `- **${label}:** ${value}`;
}
