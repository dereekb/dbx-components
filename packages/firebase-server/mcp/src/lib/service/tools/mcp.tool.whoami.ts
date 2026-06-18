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
 * Requested verbosity for the `whoami` tool, set via the `detail` input.
 *
 * - `summary` (default) — identity + decoded roles + a claim count. No claims.
 * - `claims` — adds the raw claims object (key → value).
 * - `full` — adds per-claim descriptions, granted/revoked roles, tags, and unknown claim keys.
 */
export type WhoamiDetailLevel = 'summary' | 'claims' | 'full';

/**
 * Output payload for the `whoami` tool. The claim-bearing fields are populated
 * only at the detail level that requests them, so the structured payload scales
 * with the `detail` input the same way the rendered text does.
 */
export interface WhoamiToolOutput {
  readonly authenticated: boolean;
  readonly uid?: string;
  readonly email?: string;
  readonly emailVerified?: boolean;
  readonly app?: string;
  /**
   * Decoded role set. Present for authenticated callers (empty when no role
   * reader is configured); omitted for anonymous callers.
   */
  readonly roles?: readonly string[];
  /**
   * Count of custom claim keys present on the live token, excluding the reserved
   * `email` / `email_verified` keys. Present for authenticated callers.
   */
  readonly claimCount?: number;
  /**
   * Raw claims object copied from the live token. Included when `detail` is
   * `claims` or `full`.
   */
  readonly claims?: Readonly<Record<string, unknown>>;
  /**
   * Per-claim descriptions for every manifest-known key present on the token.
   * Included when `detail` is `full`.
   */
  readonly claimDetails?: readonly WhoamiClaimDetail[];
  /**
   * Token claim keys with no matching manifest entry. Included when `detail` is `full`.
   */
  readonly unknownClaimKeys?: readonly string[];
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
  const handler: McpStaticToolHandler = (args, ctx) => Promise.resolve(whoamiToolHandler(args, ctx, deps));
  const name = WHOAMI_TOOL_NAME;
  const appLabel = deps.auth.app?.app ?? 'this server';
  const description = `Reports the authenticated caller's identity and decoded role set for \`${appLabel}\`. Returns \`authenticated: false\` for anonymous callers. Defaults to a concise summary (uid + roles only); pass \`detail: "claims"\` to also include the raw claims object, or \`detail: "full"\` to additionally include per-claim descriptions (drawn from the build-time auth manifest) and any unknown claim keys.`;

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
function whoamiToolHandler(args: Record<string, unknown>, ctx: McpStaticToolHandlerContext, deps: CreateWhoamiToolDeps): CallToolResult {
  const auth = ctx.auth;

  if (auth?.uid == null) {
    return buildResult({ authenticated: false }, '# whoami\n\nNot authenticated (anonymous caller).');
  }

  const detail = parseDetailLevel(args);
  const token = (auth.token ?? {}) as unknown as AuthClaims & { readonly email?: string; readonly email_verified?: boolean };
  const claimKeys = Object.entries(token)
    .filter(([key, value]) => value !== undefined && key !== 'email' && key !== 'email_verified')
    .map(([key]) => key);

  const roleSet: AuthRoleSet = deps.roleReader == null ? new Set<string>() : deps.roleReader(token);
  const roles = [...roleSet].sort((a, b) => a.localeCompare(b));

  const claimsByKey = new Map<string, McpManifestAuthClaim>();
  for (const claim of deps.auth.claims) {
    claimsByKey.set(claim.key, claim);
  }

  const claimDetails: WhoamiClaimDetail[] = [];
  const unknownClaimKeys: string[] = [];

  for (const key of claimKeys) {
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
    roles,
    claimCount: claimKeys.length,
    ...(deps.auth.app?.app == null ? {} : { app: deps.auth.app.app }),
    ...(token.email == null ? {} : { email: token.email }),
    ...(token.email_verified == null ? {} : { emailVerified: token.email_verified }),
    ...(detail === 'summary' ? {} : { claims: { ...token } }),
    ...(detail === 'full' ? { claimDetails, unknownClaimKeys } : {})
  };

  const text = renderText(output, detail);
  return buildResult(output, text);
}

// Coerces the `detail` input into a WhoamiDetailLevel, defaulting unknown or absent values to `summary`.
function parseDetailLevel(args: Record<string, unknown>): WhoamiDetailLevel {
  const value = args.detail;
  return value === 'claims' || value === 'full' ? value : 'summary';
}

function buildResult(output: WhoamiToolOutput, text: string): CallToolResult {
  return {
    content: [{ type: 'text', text }],
    structuredContent: output as unknown as Record<string, unknown>
  };
}

function renderText(output: WhoamiToolOutput, detail: WhoamiDetailLevel): string {
  const lines: string[] = ['# whoami', ''];
  appendHeaderLines(lines, output);
  if (detail === 'full') {
    appendClaimDetailLines(lines, output.claimDetails ?? []);
    appendUnknownClaimLines(lines, output.unknownClaimKeys ?? []);
  }
  if (detail !== 'summary') {
    appendRawClaimsLines(lines, output.claims ?? {});
  }
  appendDetailHint(lines, detail);
  return lines.join('\n');
}

function appendHeaderLines(lines: string[], output: WhoamiToolOutput): void {
  const appPart = output.app == null ? '' : ` on \`${output.app}\``;
  lines.push(`Authenticated as \`${output.uid}\`${appPart}.`, '');

  if (output.email != null) {
    lines.push(`- **email:** \`${output.email}\`${formatEmailVerified(output.emailVerified)}`);
  }

  const roles = output.roles ?? [];
  if (roles.length > 0) {
    const rolesText = roles.map((role) => `\`${role}\``).join(', ');
    lines.push(`- **roles:** ${rolesText}`);
  } else {
    lines.push('- **roles:** _(none)_');
  }

  lines.push(`- **claims:** ${output.claimCount ?? 0} present`);
}

// Renders the parenthetical verification suffix for the email line, or an empty string when the token carries no `email_verified` claim.
function formatEmailVerified(emailVerified: boolean | undefined): string {
  if (emailVerified === true) {
    return ' (verified)';
  }
  if (emailVerified === false) {
    return ' (unverified)';
  }
  return '';
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

// Renders the raw claims object as a fenced JSON block — the one place the tool emits raw JSON, since claims are an arbitrary key → value bag.
function appendRawClaimsLines(lines: string[], claims: Readonly<Record<string, unknown>>): void {
  lines.push('', '## Raw claims', '```json', JSON.stringify(claims, null, 2), '```');
}

// Appends a hint pointing at the next, more detailed level. Omitted at `full`, which is already the most detailed level.
function appendDetailHint(lines: string[], detail: WhoamiDetailLevel): void {
  if (detail === 'summary') {
    lines.push('', '_Call again with `detail: "claims"` for the raw claim values, or `detail: "full"` for values plus per-claim descriptions._');
  } else if (detail === 'claims') {
    lines.push('', '_Call again with `detail: "full"` for per-claim descriptions and unknown claim keys._');
  }
}

// MARK: Schemas
const WHOAMI_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    detail: {
      type: 'string',
      enum: ['summary', 'claims', 'full'],
      description: 'Level of detail. "summary" (default): identity + decoded roles only. "claims": adds the raw claims object (key → value). "full": adds per-claim descriptions, granted/revoked roles, tags, and unknown claim keys.'
    }
  },
  additionalProperties: false
} as const;

const WHOAMI_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['authenticated'],
  description: 'Caller identity and decoded role set. Claim-bearing fields (claims, claimDetails, unknownClaimKeys) are present only at the detail level that requests them via the `detail` input.',
  properties: {
    authenticated: { type: 'boolean' },
    uid: { type: 'string' },
    email: { type: 'string' },
    emailVerified: { type: 'boolean' },
    app: { type: 'string' },
    roles: { type: 'array', items: { type: 'string' } },
    claimCount: { type: 'integer' },
    claims: { type: 'object', additionalProperties: true },
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
