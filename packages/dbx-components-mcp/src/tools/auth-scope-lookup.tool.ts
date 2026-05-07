/**
 * `dbx_auth_scope_lookup` tool.
 *
 * Given an OIDC scope name (`model.read`, `model.write`, `demo`, …)
 * returns: which OIDC client claims surface it, where the scope is
 * enforced (file:line), the error code thrown when missing, and which
 * apps accept the scope.
 *
 * Use `topic="list"` to enumerate the scope catalog.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import type { AuthRegistry, AuthScopeInfo } from '../registry/auth-runtime.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DBX_AUTH_SCOPE_LOOKUP_TOOL: Tool = {
  name: 'dbx_auth_scope_lookup',
  description: ['Look up an OIDC scope (`model.read`, `model.write`, `demo`).', '', 'Returns the prefix family, the CRUD verb (when a callModel scope), the source `path:line` declaration, every gate that enforces it, the error code thrown on rejection, and the apps that accept it.'].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Scope name (`model.read`) or "list".' },
      depth: { type: 'string', enum: ['brief', 'full'], default: 'full' }
    },
    required: ['topic']
  }
};

const ScopeArgsType = type({
  topic: 'string',
  'depth?': "'brief' | 'full'"
});

interface CreateAuthScopeLookupToolInput {
  readonly registry: AuthRegistry;
}

export function createAuthScopeLookupTool(input: CreateAuthScopeLookupToolInput): DbxTool {
  const { registry } = input;
  const tool: DbxTool = {
    definition: DBX_AUTH_SCOPE_LOOKUP_TOOL,
    run(rawArgs) {
      const parsed = ScopeArgsType(rawArgs);
      if (parsed instanceof type.errors) {
        return toolError(`Invalid arguments: ${parsed.summary}`);
      }
      const { topic, depth = 'full' } = parsed;
      const normalized = topic.trim();
      let result: ToolResult;
      if (isCatalogTopic(normalized)) {
        result = { content: [{ type: 'text', text: formatCatalog(registry.scopes) }] };
      } else {
        const scope = registry.findScope(normalized);
        if (scope === undefined) {
          result = { content: [{ type: 'text', text: formatNotFound(normalized, registry.scopes) }] };
        } else {
          result = { content: [{ type: 'text', text: formatScope(scope, depth) }] };
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

function formatCatalog(scopes: readonly AuthScopeInfo[]): string {
  const lines: string[] = ['# OIDC scope catalog', '', `${scopes.length} entries.`, ''];
  for (const scope of scopes) {
    const verb = scope.callType ? ` (${scope.callType})` : '';
    lines.push(`- \`${scope.scope}\`${verb} — ${scope.description}`);
  }
  return lines.join('\n').trimEnd();
}

function formatScope(scope: AuthScopeInfo, depth: 'brief' | 'full'): string {
  const lines: string[] = [`# Scope \`${scope.scope}\``, '', scope.description, ''];
  if (scope.prefix !== undefined) lines.push(bullet('prefix', `\`${scope.prefix}\``));
  if (scope.callType !== undefined) lines.push(bullet('callType', `\`${scope.callType}\``));
  if (scope.errorCode !== undefined) lines.push(bullet('error code', `\`${scope.errorCode}\``));
  if (scope.sourcePath !== undefined) lines.push(bullet('source', sourceLink(scope.sourcePath, scope.sourceLine)));
  if (scope.apps.length > 0) lines.push(bullet('apps', scope.apps.map((a) => '`' + a + '`').join(', ')));

  if (depth === 'full') {
    if (scope.enforcedAt.length > 0) {
      lines.push('', '## Enforced at', '');
      for (const gate of scope.enforcedAt) {
        lines.push(`- ${sourceLink(gate.path, gate.line)} — ${gate.description}`);
      }
    }
  } else {
    lines.push('', `→ Call \`dbx_auth_scope_lookup topic="${scope.scope}" depth="full"\` for enforcement gates.`);
  }
  return lines.join('\n');
}

function formatNotFound(topic: string, scopes: readonly AuthScopeInfo[]): string {
  const lines: string[] = [`No scope matched \`${topic}\`.`, ''];
  if (scopes.length > 0) {
    lines.push('Available scopes:');
    for (const scope of scopes) {
      lines.push(`- \`${scope.scope}\` — ${scope.description}`);
    }
  } else {
    lines.push('No scopes registered.');
  }
  return lines.join('\n');
}

function bullet(label: string, value: string): string {
  return `- **${label}:** ${value}`;
}

function sourceLink(path: string, line: number | undefined): string {
  return line === undefined ? `\`${path}\`` : `\`${path}:${line}\``;
}
