/**
 * `dbx_auth_role_lookup` tool.
 *
 * Forward and reverse role lookups across the auth catalog.
 *
 * Forward (single role):
 *   - Given a role string (`'admin'`) or a role const name
 *     (`'AUTH_ADMIN_ROLE'`), returns the catalog entry plus every claim
 *     that sets (or revokes) the role across registered apps.
 *
 * Tag filter:
 *   - Pass `tag="privileged"` to enumerate every role tagged with that
 *     value. Tags come from `@dbxAuthRoleTag` JSDoc on a downstream
 *     app's claims interface — see
 *     `components/demo-firebase/src/lib/auth/claims.ts`.
 *
 * Reverse (model + verb):
 *   - Pass `model="StorageFile" verb="read"` (any string pair will do)
 *     to return every role/scope expected for that combination. The
 *     reverse path is approximate today: it matches scopes by callType
 *     and roles by tag — apps wire their concrete model gates separately.
 *
 * Pass `topic="list"` to enumerate the role catalog.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import type { AuthClaimInfo, AuthRegistry, AuthRoleInfo, AuthScopeInfo } from '@dereekb/dbx-cli';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DBX_AUTH_ROLE_LOOKUP_TOOL: Tool = {
  name: 'dbx_auth_role_lookup',
  description: ['Look up auth roles forward (by role string / const name), by tag, or in reverse (model + verb → required roles/scopes).', '', '- `topic="admin"` or `topic="AUTH_ADMIN_ROLE"` → role entry + claims that set it.', '- `tag="privileged"` → every role tagged with `privileged`.', '- `model="StorageFile" verb="read"` → reverse lookup of the roles/scopes the gate would expect.', '- `topic="list"` → catalog.'].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Role string (`admin`), const name (`AUTH_ADMIN_ROLE`), or "list".' },
      tag: { type: 'string', description: 'Tag to filter by (`privileged`, `verified-user`).' },
      model: { type: 'string', description: 'Model name for reverse lookup (e.g. `StorageFile`).' },
      verb: { type: 'string', description: 'Call verb for reverse lookup (`create | read | update | delete | query | invoke`).' },
      depth: { type: 'string', enum: ['brief', 'full'], default: 'full' }
    }
  }
};

const RoleArgsType = type({
  'topic?': 'string',
  'tag?': 'string',
  'model?': 'string',
  'verb?': 'string',
  'depth?': "'brief' | 'full'"
});

interface CreateAuthRoleLookupToolInput {
  readonly registry: AuthRegistry;
}

/**
 * Creates the `dbx_auth_role_lookup` MCP tool bound to the supplied auth registry.
 *
 * @param input - Tool factory input.
 * @param input.registry - Pre-merged auth registry consulted to resolve role names, tags, and reverse model+verb queries.
 * @returns A {@link DbxTool} that resolves role queries (by topic, by tag, or by `model`+`verb`) against the registry.
 * @__NO_SIDE_EFFECTS__
 */
export function createAuthRoleLookupTool(input: CreateAuthRoleLookupToolInput): DbxTool {
  const { registry } = input;
  const tool: DbxTool = {
    definition: DBX_AUTH_ROLE_LOOKUP_TOOL,
    run(rawArgs) {
      const parsed = RoleArgsType(rawArgs);
      let result: ToolResult;
      if (parsed instanceof type.errors) {
        result = toolError(`Invalid arguments: ${parsed.summary}`);
      } else {
        const { topic, tag, model, verb, depth = 'full' } = parsed;
        let text: string | undefined;

        if (model !== undefined || verb !== undefined) {
          text = formatReverseLookup({ registry, model, verb });
        } else if (tag !== undefined && tag.length > 0) {
          text = formatTagLookup(registry, tag, depth);
        } else if (topic !== undefined && topic.length > 0) {
          const normalized = topic.trim();
          if (isCatalogTopic(normalized)) {
            text = formatCatalog(registry.roles);
          } else {
            const role = registry.findRole(normalized);
            if (role === undefined) {
              text = formatNotFound(normalized, registry.roles);
            } else {
              const claims = registry.findClaimsForRole(role.role);
              text = formatRole(role, claims, depth);
            }
          }
        }

        result = text === undefined ? toolError('Provide one of `topic`, `tag`, or `model` + `verb`.') : { content: [{ type: 'text', text }] };
      }
      return result;
    }
  };
  return tool;
}

function isCatalogTopic(topic: string): boolean {
  const lowered = topic.toLowerCase();
  return lowered === 'list' || lowered === 'all' || lowered === 'catalog';
}

function formatCatalog(roles: readonly AuthRoleInfo[]): string {
  const lines: string[] = ['# Auth role catalog', '', `${roles.length} entries.`, ''];
  for (const role of roles) {
    const constName = role.constName ? ` (\`${role.constName}\`)` : '';
    const tags = role.tags.length > 0 ? ` — tags: ${role.tags.map((t) => '`' + t + '`').join(', ')}` : '';
    lines.push(`- \`${role.role}\`${constName}${tags}`, `  ${role.description}`);
  }
  return lines.join('\n').trimEnd();
}

function formatRole(role: AuthRoleInfo, claims: readonly AuthClaimInfo[], depth: 'brief' | 'full'): string {
  const lines: string[] = [`# Role \`${role.role}\``, '', role.description, '', bullet('source', `${role.source}`), bullet('path', sourceLink(role.sourcePath, role.sourceLine))];
  if (role.constName !== undefined) lines.push(bullet('const', `\`${role.constName}\``));
  if (role.tags.length > 0) lines.push(bullet('tags', role.tags.map((t) => '`' + t + '`').join(', ')));
  if (depth === 'full') {
    appendFullClaimMappings(lines, claims);
  } else {
    lines.push('', `→ Call \`dbx_auth_role_lookup topic="${role.role}" depth="full"\` for the claim mapping.`);
  }
  return lines.join('\n');
}

function appendFullClaimMappings(lines: string[], claims: readonly AuthClaimInfo[]): void {
  lines.push('', '## Set / revoked by claims', '');
  if (claims.length === 0) {
    lines.push('_(no catalogued claims set this role)_');
    return;
  }
  for (const claim of claims) {
    const arrow = claim.mapping.inverse ? 'revokes' : 'grants';
    const owner = claim.app ? ` (${claim.app})` : '';
    lines.push(`- \`${claim.key}\`${owner} on \`${claim.interfaceName ?? '?'}\` — ${arrow} the role at ${sourceLink(claim.sourcePath, claim.sourceLine)}.`);
  }
}

function formatTagLookup(registry: AuthRegistry, tag: string, depth: 'brief' | 'full'): string {
  const roles = registry.findRolesByTag(tag);
  const lines: string[] = [`# Roles tagged \`${tag}\``, '', `${roles.length} role${roles.length === 1 ? '' : 's'}.`, ''];
  if (roles.length === 0) {
    lines.push('No roles match that tag. Try `dbx_auth_role_lookup topic="list"`.');
  } else {
    for (const role of roles) {
      lines.push(formatRole(role, registry.findClaimsForRole(role.role), depth), '');
    }
  }
  return lines.join('\n').trimEnd();
}

function formatReverseLookup(input: { readonly registry: AuthRegistry; readonly model?: string; readonly verb?: string }): string {
  const { registry, model, verb } = input;
  const lines: string[] = ['# Reverse lookup'];
  lines.push('', bullet('model', model === undefined ? '_(unspecified)_' : `\`${model}\``), bullet('verb', verb === undefined ? '_(unspecified)_' : `\`${verb}\``), '');
  appendReverseScopesSection(lines, registry, verb);
  // For now the reverse role lookup is a heuristic: surface every
  // privileged role tagged for the verb. Apps wiring concrete model gates
  // can extend this once their per-model role tags are catalogued.
  appendReverseLikelyRolesSection(lines, registry, verb);
  return lines.join('\n');
}

function appendReverseScopesSection(lines: string[], registry: AuthRegistry, verb: string | undefined): void {
  const scopes: readonly AuthScopeInfo[] = verb === undefined ? [] : registry.scopes.filter((s) => s.callType === verb);
  lines.push('## Required scopes');
  if (scopes.length === 0) {
    lines.push('_(no catalogued scopes match that verb)_');
    return;
  }
  for (const scope of scopes) {
    lines.push(`- \`${scope.scope}\` — ${scope.description}`);
    for (const gate of scope.enforcedAt) {
      lines.push(`  Enforced at ${sourceLink(gate.path, gate.line)} — ${gate.description}`);
    }
  }
}

function appendReverseLikelyRolesSection(lines: string[], registry: AuthRegistry, verb: string | undefined): void {
  lines.push('', '## Likely roles', '');
  const tagHits = verb === undefined ? [] : registry.findRolesByTag(verb);
  const privileged = registry.findRolesByTag('privileged');
  const allHits = dedupeRoles([...tagHits, ...privileged]);
  if (allHits.length === 0) {
    lines.push('_(no roles tagged for that verb — apps wire model-specific roles separately)_');
    return;
  }
  for (const role of allHits) {
    const tags = role.tags.length > 0 ? ` (${role.tags.map((t) => '`' + t + '`').join(', ')})` : '';
    lines.push(`- \`${role.role}\`${tags} — ${role.description}`);
  }
}

function dedupeRoles(roles: readonly AuthRoleInfo[]): readonly AuthRoleInfo[] {
  const seen = new Set<string>();
  const out: AuthRoleInfo[] = [];
  for (const role of roles) {
    if (!seen.has(role.role)) {
      seen.add(role.role);
      out.push(role);
    }
  }
  return out;
}

function formatNotFound(topic: string, roles: readonly AuthRoleInfo[]): string {
  const lines: string[] = [`No role matched \`${topic}\`.`, ''];
  if (roles.length > 0) {
    lines.push('Available roles:');
    for (const role of roles) {
      lines.push(`- \`${role.role}\``);
    }
  } else {
    lines.push('No roles registered.');
  }
  return lines.join('\n');
}

function bullet(label: string, value: string): string {
  return `- **${label}:** ${value}`;
}

function sourceLink(path: string, line: number | undefined): string {
  return line === undefined ? `\`${path}\`` : `\`${path}:${line}\``;
}
