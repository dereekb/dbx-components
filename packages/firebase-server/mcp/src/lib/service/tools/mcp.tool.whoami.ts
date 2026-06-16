import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type AuthClaims, type AuthRoleSet } from '@dereekb/util';
import { type McpAuthRoleReader } from '../../mcp.config';
import { type McpManifestAuth, type McpManifestAuthClaim } from '../mcp.manifest';
import { buildStaticToolDefinition, type McpToolDefinition, type McpStaticToolHandler, type McpStaticToolHandlerContext } from '../mcp.tool-generator';

// MARK: Constants
/**
 * Reserved tool name for the built-in `whoami` static tool.
 */
export const WHOAMI_TOOL_NAME = 'whoami';

/**
 * Synthetic call type used in the tool's dispatch identity. Matches the
 * pattern set by `model-info` — `read` (not `info`) so the visibility
 * classifier treats the tool as a read.
 */
export const WHOAMI_DISPATCH_CALL = 'read';

/**
 * Synthetic model type used in the tool's dispatch identity.
 */
export const WHOAMI_DISPATCH_MODEL_TYPE = 'auth';

// MARK: Types
/**
 * Constructor dependencies for {@link createWhoamiTool}.
 */
export interface CreateWhoamiToolDeps {
  /**
   * Auth section loaded from the pre-rendered MCP manifest JSON. Drives the
   * description text plus the role-detail enrichment for claim keys present
   * on the live token.
   */
  readonly auth: McpManifestAuth;
  /**
   * Optional role reader. When present, decodes the live token's claims into
   * a {@link AuthRoleSet}; the resulting roles are returned alongside the
   * claim details. When absent, `roles` is empty.
   */
  readonly roleReader?: McpAuthRoleReader;
}

/**
 * One entry returned in `claimDetails`. Mirrors the `dbx_auth_list_app`
 * formatter shape minus source paths.
 */
export interface WhoamiClaimDetail {
  readonly key: string;
  readonly interfaceName?: string;
  readonly description: string;
  readonly grantedRoles: readonly string[];
  readonly inverse: boolean;
  readonly tags: readonly string[];
}

/**
 * Output payload for the `whoami` tool.
 */
export interface WhoamiToolOutput {
  readonly authenticated: boolean;
  readonly uid?: string;
  readonly email?: string;
  readonly emailVerified?: boolean;
  readonly app?: string;
  readonly claims: Readonly<Record<string, unknown>>;
  readonly roles: readonly string[];
  readonly claimDetails: readonly WhoamiClaimDetail[];
  readonly unknownClaimKeys: readonly string[];
}

// MARK: Factory
/**
 * Builds the built-in `whoami` MCP tool definition. Returns the calling
 * caller's `uid`, claims object, decoded role set, and rendered descriptions
 * for every claim key actually present on the live token.
 *
 * Unauthenticated callers receive a structured `authenticated: false` result
 * (no exception) so the tool can be used as a "do you see me?" probe.
 *
 * @param deps - The manifest's auth section + optional role reader.
 * @returns A statically-registered {@link McpToolDefinition} to append to the MCP server factory's tool registry.
 */
export function createWhoamiTool(deps: CreateWhoamiToolDeps): McpToolDefinition {
  const handler: McpStaticToolHandler = (_args, ctx) => Promise.resolve(whoamiToolHandler(ctx, deps));
  const name = WHOAMI_TOOL_NAME;
  const appLabel = deps.auth.app?.app ?? 'this server';
  const description = `Reports the authenticated caller's uid, raw custom claims, and decoded role set for \`${appLabel}\`. Returns \`authenticated: false\` for anonymous callers. Claim descriptions are drawn from the build-time auth manifest; only keys actually present on the live token are detailed.`;

  return buildStaticToolDefinition({
    name,
    description,
    inputSchema: WHOAMI_INPUT_SCHEMA,
    outputSchema: WHOAMI_OUTPUT_SCHEMA,
    dispatch: {
      call: WHOAMI_DISPATCH_CALL,
      modelType: WHOAMI_DISPATCH_MODEL_TYPE
    },
    staticHandler: handler,
    effectiveReadOnly: true,
    rule: {}
  });
}

// MARK: Handler
function whoamiToolHandler(ctx: McpStaticToolHandlerContext, deps: CreateWhoamiToolDeps): CallToolResult {
  const auth = ctx.auth;

  if (auth?.uid == null) {
    const output: WhoamiToolOutput = {
      authenticated: false,
      claims: {},
      roles: [],
      claimDetails: [],
      unknownClaimKeys: []
    };
    return buildResult(output, '# whoami\n\nUnauthenticated.');
  }

  const token = (auth.token ?? {}) as unknown as AuthClaims & { readonly email?: string; readonly email_verified?: boolean };
  const presentKeys = Object.entries(token)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);

  const roleSet: AuthRoleSet = deps.roleReader == null ? new Set<string>() : deps.roleReader(token);
  const roles = [...roleSet].sort((a, b) => a.localeCompare(b));

  const claimsByKey = new Map<string, McpManifestAuthClaim>();
  for (const claim of deps.auth.claims) {
    claimsByKey.set(claim.key, claim);
  }

  const claimDetails: WhoamiClaimDetail[] = [];
  const unknownClaimKeys: string[] = [];

  for (const key of presentKeys) {
    if (key === 'email' || key === 'email_verified') {
      continue;
    }
    const claim = claimsByKey.get(key);
    if (claim == null) {
      unknownClaimKeys.push(key);
    } else {
      claimDetails.push({
        key: claim.key,
        description: claim.description,
        grantedRoles: claim.mapping.roles,
        inverse: claim.mapping.inverse,
        tags: claim.tags,
        ...(claim.interfaceName == null ? {} : { interfaceName: claim.interfaceName })
      });
    }
  }

  const output: WhoamiToolOutput = {
    authenticated: true,
    uid: auth.uid,
    claims: { ...token },
    roles,
    claimDetails,
    unknownClaimKeys,
    ...(deps.auth.app?.app == null ? {} : { app: deps.auth.app.app }),
    ...(token.email == null ? {} : { email: token.email }),
    ...(token.email_verified == null ? {} : { emailVerified: token.email_verified })
  };

  const text = renderText(output);
  return buildResult(output, text);
}

function buildResult(output: WhoamiToolOutput, text: string): CallToolResult {
  return {
    content: [{ type: 'text', text }],
    structuredContent: output as unknown as Record<string, unknown>
  };
}

function renderText(output: WhoamiToolOutput): string {
  const lines: string[] = ['# whoami', ''];
  appendHeaderLines(lines, output);
  appendClaimDetailLines(lines, output.claimDetails);
  appendUnknownClaimLines(lines, output.unknownClaimKeys);
  return lines.join('\n');
}

function appendHeaderLines(lines: string[], output: WhoamiToolOutput): void {
  if (output.uid != null) {
    lines.push(`- **uid:** \`${output.uid}\``);
  }
  if (output.app != null) {
    lines.push(`- **app:** \`${output.app}\``);
  }
  if (output.email != null) {
    lines.push(`- **email:** \`${output.email}\``);
  }
  if (output.roles.length > 0) {
    const rolesText = output.roles.map((role) => `\`${role}\``).join(', ');
    lines.push(`- **roles:** ${rolesText}`);
  } else {
    lines.push('- **roles:** _(none)_');
  }
}

function appendClaimDetailLines(lines: string[], claimDetails: readonly WhoamiClaimDetail[]): void {
  if (claimDetails.length === 0) {
    return;
  }
  lines.push('', '## Claims on this token');
  for (const detail of claimDetails) {
    const headerInterfacePart = detail.interfaceName == null ? '' : ` on \`${detail.interfaceName}\``;
    const grants = detail.grantedRoles.length > 0 ? detail.grantedRoles.map((role) => `\`${role}\``).join(', ') : '_(no roles)_';
    const action = detail.inverse ? 'revokes' : 'grants';
    lines.push(`- \`${detail.key}\`${headerInterfacePart} — ${action} ${grants}`);
    if (detail.description.length > 0) {
      lines.push(`  ${detail.description}`);
    }
  }
}

function appendUnknownClaimLines(lines: string[], unknownClaimKeys: readonly string[]): void {
  if (unknownClaimKeys.length === 0) {
    return;
  }
  lines.push('', '## Unknown claim keys');
  for (const key of unknownClaimKeys) {
    lines.push(`- \`${key}\``);
  }
}

// MARK: Schemas
const WHOAMI_INPUT_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: false
} as const;

const WHOAMI_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['authenticated', 'claims', 'roles', 'claimDetails', 'unknownClaimKeys'],
  description: 'Caller identity, raw token claims, decoded role set, and per-claim descriptions for every key present on the live token.',
  properties: {
    authenticated: { type: 'boolean' },
    uid: { type: 'string' },
    email: { type: 'string' },
    emailVerified: { type: 'boolean' },
    app: { type: 'string' },
    claims: { type: 'object', additionalProperties: true },
    roles: { type: 'array', items: { type: 'string' } },
    claimDetails: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'description', 'grantedRoles', 'inverse', 'tags'],
        properties: {
          key: { type: 'string' },
          interfaceName: { type: 'string' },
          description: { type: 'string' },
          grantedRoles: { type: 'array', items: { type: 'string' } },
          inverse: { type: 'boolean' },
          tags: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    unknownClaimKeys: { type: 'array', items: { type: 'string' } }
  }
} as const;
