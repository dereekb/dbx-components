/**
 * `dbx_auth_claim_lookup` tool.
 *
 * Given a custom-claim key (`a`, `o`, `fr`) or a `*ApiAuthClaims` interface
 * name, returns the catalogued meaning, value type, role mapping (via
 * {@link authRoleClaimsService}), and the source `path:line` declaration.
 *
 * Resolution order:
 *   1. `'list'` / `'all'` / `'catalog'` → catalog of every claim
 *   2. Exact key match (case-sensitive — claim keys are user-facing)
 *      Optionally scoped to an app slug.
 *   3. Interface name match (case-insensitive) → every claim on the interface
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import type { AuthClaimInfo, AuthRegistry } from '../registry/auth-runtime.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DBX_AUTH_CLAIM_LOOKUP_TOOL: Tool = {
  name: 'dbx_auth_claim_lookup',
  description: ['Look up a Firebase Auth custom-claim entry by key (`a`, `o`, `fr`) or by `*ApiAuthClaims` interface name (`DemoApiAuthClaims`).', '', 'Returns the claim meaning, value type, role mapping through `authRoleClaimsService`, owning app + interface, and the source path:line where the claim is declared.', '', 'Use the optional `app` parameter (`demo-api`) to scope the lookup when the same claim key exists in multiple apps.'].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Claim key, interface name, or "list".' },
      app: { type: 'string', description: 'Optional app slug to scope a key lookup (e.g. "demo-api").' },
      depth: { type: 'string', enum: ['brief', 'full'], default: 'full', description: 'Detail level for single-entry hits.' }
    },
    required: ['topic']
  }
};

const ClaimArgsType = type({
  topic: 'string',
  'app?': 'string',
  'depth?': "'brief' | 'full'"
});

interface CreateAuthClaimLookupToolInput {
  readonly registry: AuthRegistry;
}

/**
 * Creates the `dbx_auth_claim_lookup` MCP tool bound to the supplied auth registry.
 *
 * @param input - Tool factory input.
 * @param input.registry - Pre-merged auth registry consulted by the tool to resolve claim keys, interface names, and the catalog topic.
 * @returns A {@link DbxTool} that resolves claim queries against the registry.
 * @__NO_SIDE_EFFECTS__
 */
export function createAuthClaimLookupTool(input: CreateAuthClaimLookupToolInput): DbxTool {
  const { registry } = input;
  const tool: DbxTool = {
    definition: DBX_AUTH_CLAIM_LOOKUP_TOOL,
    run(rawArgs) {
      const parsed = ClaimArgsType(rawArgs);
      let result: ToolResult;
      if (parsed instanceof type.errors) {
        result = toolError(`Invalid arguments: ${parsed.summary}`);
      } else {
        const { topic, app, depth = 'full' } = parsed;
        const normalized = topic.trim();
        if (isCatalogTopic(normalized)) {
          result = { content: [{ type: 'text', text: formatCatalog(registry.claims) }] };
        } else {
          const byKey = registry.findClaim(normalized, app);
          const byInterface = byKey === undefined ? registry.findClaimsByInterface(normalized) : [];
          if (byKey !== undefined) {
            result = { content: [{ type: 'text', text: formatClaim(byKey, depth) }] };
          } else if (byInterface.length > 0) {
            result = { content: [{ type: 'text', text: formatInterfaceClaims(normalized, byInterface, depth) }] };
          } else {
            result = { content: [{ type: 'text', text: formatNotFound(normalized, registry.claims) }] };
          }
        }
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

function formatCatalog(claims: readonly AuthClaimInfo[]): string {
  const lines: string[] = ['# Auth claim catalog', '', `${claims.length} entries.`, ''];
  for (const claim of claims) {
    const owner = claim.app ? ` (${claim.app})` : '';
    lines.push(`- \`${claim.key}\`${owner} → ${claim.interfaceName ?? '?'} — ${claim.description}`);
  }
  return lines.join('\n').trimEnd();
}

function formatClaim(claim: AuthClaimInfo, depth: 'brief' | 'full'): string {
  const lines: string[] = [`# Claim \`${claim.key}\``, '', claim.description, '', bullet('type', `\`${claim.type}\``), bullet('source', `${claim.source}`), bullet('path', sourceLink(claim.sourcePath, claim.sourceLine))];
  if (claim.app !== undefined) lines.push(bullet('app', `\`${claim.app}\``));
  if (claim.interfaceName !== undefined) lines.push(bullet('interface', `\`${claim.interfaceName}\``));

  if (depth === 'full') {
    lines.push('', '## Role mapping', '', formatMapping(claim));
    if (claim.tags.length > 0) {
      lines.push('', `→ Tags: ${claim.tags.map(code).join(', ')}`);
    }
  } else {
    lines.push('', `→ Call \`dbx_auth_claim_lookup topic="${claim.key}" depth="full"\` for the full mapping.`);
  }
  return lines.join('\n');
}

function formatInterfaceClaims(interfaceName: string, claims: readonly AuthClaimInfo[], depth: 'brief' | 'full'): string {
  const lines: string[] = [`# Claims on \`${interfaceName}\``, '', `${claims.length} claim${claims.length === 1 ? '' : 's'}.`, ''];
  for (const claim of claims) {
    lines.push(formatClaim(claim, depth), '');
  }
  return lines.join('\n').trimEnd();
}

function formatMapping(claim: AuthClaimInfo): string {
  const { mapping } = claim;
  const lines: string[] = [];
  if (mapping.customEncodeDecode) {
    lines.push('- Custom encode/decode functions are supplied by the catalog entry; the role list below is approximate.');
  }
  const roleList = mapping.roles.map(code).join(', ') || '_(none)_';
  if (mapping.inverse) {
    const mode = mapping.inverseMode ?? 'any';
    lines.push(`- Inverse claim (mode \`${mode}\`) — when set, **revokes** ${roleList} from the user.`);
  } else {
    lines.push(`- Forward claim — when set, **grants** ${roleList}.`);
  }
  if (mapping.claimValue !== undefined) {
    lines.push(`- Expected claim value: \`${String(mapping.claimValue)}\``);
  }
  return lines.join('\n');
}

function formatNotFound(topic: string, claims: readonly AuthClaimInfo[]): string {
  const lines: string[] = [`No claim matched \`${topic}\`.`, ''];
  if (claims.length > 0) {
    lines.push('Available keys:');
    for (const claim of claims) {
      const owner = claim.app ? ` (${claim.app})` : '';
      lines.push(`- \`${claim.key}\`${owner} — ${claim.interfaceName ?? '?'}`);
    }
  } else {
    lines.push('No claims registered.');
  }
  return lines.join('\n');
}

function bullet(label: string, value: string): string {
  return `- **${label}:** ${value}`;
}

function sourceLink(path: string, line: number | undefined): string {
  return line === undefined ? `\`${path}\`` : `\`${path}:${line}\``;
}

function code(value: string): string {
  return '`' + value + '`';
}
