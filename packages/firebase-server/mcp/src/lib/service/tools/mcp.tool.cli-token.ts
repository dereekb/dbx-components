import type { CallToolResult } from '@modelcontextprotocol/server';
import { AUTH_ADMIN_ROLE, type Maybe } from '@dereekb/util';
import { CLI_TOKEN_OIDC_SCOPE } from '@dereekb/firebase';
import { requestClientIp } from '@dereekb/firebase-server';
import { type McpCliTokenMinter, type McpCliTokenMintResult } from '../../mcp.config';
import { buildStaticToolDefinition, type McpToolDefinition, type McpStaticToolHandler, type McpStaticToolHandlerContext } from '../mcp.tool-generator';

// MARK: Constants
/**
 * Reserved tool name for the built-in `cli-token` static tool.
 */
export const CLI_TOKEN_TOOL_NAME = 'cli-token';

/**
 * Synthetic call type used in the tool's dispatch identity. `create` so the visibility classifier
 * treats the tool as a write — minting a credential is not a read.
 */
export const CLI_TOKEN_DISPATCH_CALL = 'create';

/**
 * Synthetic model type used in the tool's dispatch identity.
 */
export const CLI_TOKEN_DISPATCH_MODEL_TYPE = 'auth';

// MARK: Types
/**
 * Constructor dependencies for {@link createCliTokenTool}.
 */
export interface CreateCliTokenToolDeps {
  /**
   * The app-supplied minter. The tool is only ever built when one is wired.
   */
  readonly minter: McpCliTokenMinter;
}

/**
 * Output payload for the `cli-token` tool.
 *
 * Deliberately does NOT carry the refresh token: the claim code is a one-time, short-lived pointer
 * at it, which is what makes the tool's output safe to leave in a transcript.
 */
export interface CliTokenToolOutput {
  readonly claimCode: string;
  readonly claimExpiresAt: string;
  readonly expiresAt: string;
  readonly scope: string;
  readonly cliName?: string;
  readonly downloadUrl?: string;
  readonly downloadSha256?: string;
  /**
   * The exact command to run once the CLI is on the machine.
   */
  readonly handoffCommand: string;
}

// MARK: Factory
/**
 * Builds the built-in `cli-token` MCP tool definition — the agent-facing half of the CLI handoff.
 *
 * Mints a short-lived CLI login credential carrying no more privilege than the calling session and
 * returns the one-time claim code that unwraps it, optionally alongside a signed download URL for
 * the CLI binary so a bare machine can go from nothing to logged in without a human.
 *
 * Three independent gates apply before the handler ever runs:
 *
 * - `requiredScopeTerms: [token.cli]` — the tool is invisible to `tools/list` AND uncallable without
 *   the scope, through the factory's existing scope filter.
 * - `visibility.requiredRoles: [admin]` — the declarative role gate, which fails closed when the app
 *   wires no `McpAuthRoleReader`.
 * - The mint endpoint's own admin predicate, inside the minter.
 *
 * @param deps - The app-supplied minter.
 * @returns A statically-registered {@link McpToolDefinition} to append to the MCP server factory's tool registry.
 */
export function createCliTokenTool(deps: CreateCliTokenToolDeps): McpToolDefinition {
  const handler: McpStaticToolHandler = (args, ctx) => cliTokenToolHandler(args, ctx, deps);

  return buildStaticToolDefinition({
    name: CLI_TOKEN_TOOL_NAME,
    description:
      'Mints a short-lived CLI login credential for YOU (the calling session) and returns a one-time claim code plus, when available, a signed download URL for the CLI binary. The credential is capped at one hour, carries no more privilege than this session (never `token.cli` or `token.service`), and expires with this session if that is sooner. The refresh token is never returned here — redeem the claim code with `<cli> auth handoff <code>` within two minutes.',
    inputSchema: CLI_TOKEN_INPUT_SCHEMA,
    outputSchema: CLI_TOKEN_OUTPUT_SCHEMA,
    dispatch: {
      call: CLI_TOKEN_DISPATCH_CALL,
      modelType: CLI_TOKEN_DISPATCH_MODEL_TYPE
    },
    staticHandler: handler,
    effectiveReadOnly: false,
    requiredScopeTerms: [CLI_TOKEN_OIDC_SCOPE],
    rule: { requireAuthenticated: true, requiredRoles: [AUTH_ADMIN_ROLE] }
  });
}

// MARK: Handler
async function cliTokenToolHandler(args: Record<string, unknown>, ctx: McpStaticToolHandlerContext, deps: CreateCliTokenToolDeps): Promise<CallToolResult> {
  const minted = await deps.minter({
    auth: ctx.auth,
    scopes: parseScopes(args['scopes']),
    ttlSeconds: parseTtlSeconds(args['ttlSeconds']),
    includeDownloadUrl: args['includeDownloadUrl'] !== false,
    // resolved from the tool call's raw request so an MCP mint records the same address an HTTP mint
    // does — see McpCliTokenMintInput.requestIp
    requestIp: requestClientIp(ctx.rawRequest)
  });

  const output = buildOutput(minted);

  return {
    content: [{ type: 'text', text: renderText(output) }],
    structuredContent: output as unknown as Record<string, unknown>
  };
}

function buildOutput(minted: McpCliTokenMintResult): CliTokenToolOutput {
  const cliName = minted.cliName ?? '<cli>';

  return {
    claimCode: minted.claimCode,
    claimExpiresAt: minted.claimExpiresAt,
    expiresAt: minted.expiresAt,
    scope: minted.scope,
    handoffCommand: `${cliName} auth handoff ${minted.claimCode}`,
    ...(minted.cliName == null ? {} : { cliName: minted.cliName }),
    ...(minted.downloadUrl == null ? {} : { downloadUrl: minted.downloadUrl }),
    ...(minted.downloadSha256 == null ? {} : { downloadSha256: minted.downloadSha256 })
  };
}

// Reads the optional `scopes` input as a string array, ignoring anything that is not a non-empty string.
function parseScopes(value: unknown): Maybe<readonly string[]> {
  let result: Maybe<readonly string[]>;

  if (Array.isArray(value)) {
    const scopes = value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
    result = scopes.length > 0 ? scopes : undefined;
  }

  return result;
}

// Reads the optional `ttlSeconds` input, ignoring non-positive or non-finite values (the minter clamps the rest).
function parseTtlSeconds(value: unknown): Maybe<number> {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

function renderText(output: CliTokenToolOutput): string {
  const lines: string[] = ['# CLI credential minted', ''];

  if (output.downloadUrl == null) {
    lines.push('## Log in', '');
  } else {
    const cliName = output.cliName ?? 'cli';
    lines.push('## 1. Download the CLI', '', '```sh', `curl -fsSL -o ${cliName} "${output.downloadUrl}" && chmod +x ${cliName}`, '```', '');

    if (output.downloadSha256 != null) {
      lines.push(`SHA-256: \`${output.downloadSha256}\``, '');
    }

    lines.push('## 2. Log it in', '');
  }

  lines.push('```sh', `./${output.handoffCommand}`, '```', '', `- **claim code expires:** ${output.claimExpiresAt} (one-time use)`, `- **credential expires:** ${output.expiresAt}`, `- **scopes:** \`${output.scope}\``, '', '_The claim code is single-use and short-lived; the credential it unwraps is capped at one hour. Re-run this tool for a fresh one rather than trying to extend either._');

  return lines.join('\n');
}

// MARK: Schemas
const CLI_TOKEN_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    scopes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optional subset of YOUR OWN scopes to grant the credential. May only narrow — a scope you do not hold is ignored, and `token.cli` / `token.service` are always stripped. Defaults to every scope this session holds.'
    },
    ttlSeconds: {
      type: 'integer',
      description: 'Optional requested lifetime in seconds. Clamped to one hour and to the remaining life of this session.'
    },
    includeDownloadUrl: {
      type: 'boolean',
      description: 'Also mint a signed download URL for the CLI binary (default true). Has no effect when the app does not publish one.'
    }
  },
  additionalProperties: false
} as const;

const CLI_TOKEN_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['claimCode', 'claimExpiresAt', 'expiresAt', 'scope', 'handoffCommand'],
  description: 'The one-time claim code and the minted credential’s metadata. The refresh token itself is never returned here.',
  properties: {
    claimCode: { type: 'string' },
    claimExpiresAt: { type: 'string' },
    expiresAt: { type: 'string' },
    scope: { type: 'string' },
    cliName: { type: 'string' },
    downloadUrl: { type: 'string' },
    downloadSha256: { type: 'string' },
    handoffCommand: { type: 'string' }
  }
} as const;
