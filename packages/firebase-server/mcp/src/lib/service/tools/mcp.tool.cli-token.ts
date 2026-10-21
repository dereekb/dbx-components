import type { CallToolResult } from '@modelcontextprotocol/server';
import { AUTH_ADMIN_ROLE, type AuthRole, type Maybe } from '@dereekb/util';
import { type CliTokenCredentialType, CLI_TOKEN_BEARER_CREDENTIAL_TYPE, CLI_TOKEN_OIDC_SCOPE, isCliTokenCredentialType } from '@dereekb/firebase';
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

/**
 * Credential type the tool mints when the caller names none.
 *
 * `bearer`: the CLI uses the access token directly and never authenticates as the app's CLI client, so
 * the handoff works whatever that client's registration is. The HTTP mint keeps `refresh` as its own
 * default for older callers.
 */
export const DEFAULT_MCP_CLI_TOKEN_CREDENTIAL_TYPE: CliTokenCredentialType = CLI_TOKEN_BEARER_CREDENTIAL_TYPE;

/**
 * Roles the tool requires when the app configures none. See `McpModuleConfig.cliTokenRequiredRoles`.
 */
export const DEFAULT_MCP_CLI_TOKEN_REQUIRED_ROLES: ReadonlyArray<AuthRole> = [AUTH_ADMIN_ROLE];

// MARK: Types
/**
 * Constructor dependencies for {@link createCliTokenTool}.
 */
export interface CreateCliTokenToolDeps {
  /**
   * The app-supplied minter. The tool is only ever built when one is wired.
   */
  readonly minter: McpCliTokenMinter;
  /**
   * The advertised tool name. Defaults to {@link CLI_TOKEN_TOOL_NAME}; the compact MCP surface names
   * it `<prefix>_cli_token`.
   */
  readonly name?: string;
  /**
   * Roles the caller must hold to see and call the tool. Defaults to {@link DEFAULT_MCP_CLI_TOKEN_REQUIRED_ROLES}.
   */
  readonly requiredRoles?: ReadonlyArray<AuthRole>;
}

/**
 * Output payload for the `cli-token` tool.
 *
 * Deliberately does NOT carry the credential: the claim code is a one-time, short-lived pointer at
 * it, which is what makes the tool's output safe to leave in a transcript.
 */
export interface CliTokenToolOutput {
  readonly claimCode: string;
  readonly claimExpiresAt: string;
  readonly expiresAt: string;
  readonly scope: string;
  /**
   * The kind of credential the claim code redeems to, when the minter reported it. A minter that does
   * not forward the requested type mints the service default and reports `refresh`.
   */
  readonly credentialType?: CliTokenCredentialType;
  readonly cliName?: string;
  readonly downloadUrl?: string;
  readonly downloadSha256?: string;
  /**
   * The command that downloads the CLI to a file named {@link cliName} and marks it executable.
   * Present with {@link downloadUrl}.
   *
   * In the structured output, not only the rendered text, because a client that surfaces
   * `structuredContent` never shows the text — and the saved name matters: the CLI is a single
   * ES-module file, and Node refuses to run an ES module whose file has an unrecognized extension
   * (`demo-cli.download` fails with `ERR_UNKNOWN_FILE_EXTENSION`). Extensionless, `.mjs`, and `.js`
   * all run.
   */
  readonly installCommand?: string;
  /**
   * Name of the CLI env the credential is redeemed into, when the app configured one.
   */
  readonly envName?: string;
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
 * - `visibility.requiredRoles` — the declarative role gate ({@link CreateCliTokenToolDeps.requiredRoles},
 *   `[admin]` by default), which fails closed when the app wires no `McpAuthRoleReader`.
 * - The mint endpoint's own admin predicate, inside the minter.
 *
 * @param deps - The app-supplied minter, plus the optional tool name and required roles.
 * @returns A statically-registered {@link McpToolDefinition} to append to the MCP server factory's tool registry.
 */
export function createCliTokenTool(deps: CreateCliTokenToolDeps): McpToolDefinition {
  const handler: McpStaticToolHandler = (args, ctx) => cliTokenToolHandler(args, ctx, deps);

  return buildStaticToolDefinition({
    name: deps.name ?? CLI_TOKEN_TOOL_NAME,
    description:
      'Mints a short-lived CLI login credential for YOU (the calling session) and returns a one-time claim code plus, when available, a signed download URL for the CLI binary. The credential is capped at one hour, carries no more privilege than this session (never `token.cli` or `token.service`), and expires with this session if that is sooner. By default it is a bearer access token the CLI uses directly; it cannot be refreshed, so re-mint rather than refresh when it lapses. The credential itself is never returned here — redeem the claim code with `<cli> auth handoff <code>` within two minutes. Download with `installCommand`: it saves the CLI under its own name, and Node will not run the single-file ES-module CLI under an unrecognized extension.',
    inputSchema: CLI_TOKEN_INPUT_SCHEMA,
    outputSchema: CLI_TOKEN_OUTPUT_SCHEMA,
    dispatch: {
      call: CLI_TOKEN_DISPATCH_CALL,
      modelType: CLI_TOKEN_DISPATCH_MODEL_TYPE
    },
    staticHandler: handler,
    effectiveReadOnly: false,
    requiredScopeTerms: [CLI_TOKEN_OIDC_SCOPE],
    rule: { requireAuthenticated: true, requiredRoles: deps.requiredRoles ?? DEFAULT_MCP_CLI_TOKEN_REQUIRED_ROLES }
  });
}

// MARK: Handler
async function cliTokenToolHandler(args: Record<string, unknown>, ctx: McpStaticToolHandlerContext, deps: CreateCliTokenToolDeps): Promise<CallToolResult> {
  const minted = await deps.minter({
    auth: ctx.auth,
    scopes: parseScopes(args['scopes']),
    ttlSeconds: parseTtlSeconds(args['ttlSeconds']),
    credentialType: parseCredentialType(args['credentialType']) ?? DEFAULT_MCP_CLI_TOKEN_CREDENTIAL_TYPE,
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

/**
 * Renders the tool's output, including the command the target machine runs verbatim.
 *
 * `--env` is appended whenever the mint supplied an `envName`. Without it the rendered command is
 * only correct on a machine that already has the right env ACTIVE — `auth handoff` takes the issuer
 * to redeem against from the active env, so a bare machine fails `AUTH_HANDOFF_NO_ISSUER` and a
 * machine pointed at another env sends the claim to the wrong issuer. Naming the env also
 * instantiates it from its built-in default template, which a name alone does not do.
 *
 * @param minted - The mint result from the app-supplied minter.
 * @returns The tool output payload.
 */
function buildOutput(minted: McpCliTokenMintResult): CliTokenToolOutput {
  const cliName = minted.cliName ?? '<cli>';
  const envArgument = minted.envName == null ? '' : ` --env ${minted.envName}`;
  // a real file name, never the `<cli>` placeholder — a shell would read that as a redirect
  const binaryName = minted.cliName ?? 'cli';

  return {
    claimCode: minted.claimCode,
    claimExpiresAt: minted.claimExpiresAt,
    expiresAt: minted.expiresAt,
    scope: minted.scope,
    ...(minted.credentialType == null ? {} : { credentialType: minted.credentialType }),
    handoffCommand: `${cliName} auth handoff ${minted.claimCode}${envArgument}`,
    ...(minted.cliName == null ? {} : { cliName: minted.cliName }),
    ...(minted.downloadUrl == null ? {} : { downloadUrl: minted.downloadUrl }),
    ...(minted.downloadSha256 == null ? {} : { downloadSha256: minted.downloadSha256 }),
    ...(minted.downloadUrl == null ? {} : { installCommand: `curl -fsSL -o ${binaryName} "${minted.downloadUrl}" && chmod +x ${binaryName}` }),
    ...(minted.envName == null ? {} : { envName: minted.envName })
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

// Reads the optional `credentialType` input, ignoring anything that is not a known type (the tool then uses its default).
function parseCredentialType(value: unknown): Maybe<CliTokenCredentialType> {
  return isCliTokenCredentialType(value) ? value : undefined;
}

function describeCredentialType(credentialType: Maybe<CliTokenCredentialType>): Maybe<string> {
  let result: Maybe<string>;

  switch (credentialType) {
    case 'bearer':
      result = 'bearer access token — the CLI uses it directly and cannot refresh it';
      break;
    case 'refresh':
      result = 'refresh token bound to the CLI’s OAuth client';
      break;
  }

  return result;
}

function renderText(output: CliTokenToolOutput): string {
  const lines: string[] = ['# CLI credential minted', ''];

  if (output.installCommand == null) {
    lines.push('## Log in', '');
  } else {
    lines.push('## 1. Download the CLI', '', '```sh', output.installCommand, '```', '');

    if (output.downloadSha256 != null) {
      lines.push(`SHA-256: \`${output.downloadSha256}\``, '');
    }

    lines.push('## 2. Log it in', '');
  }

  const credentialDescription = describeCredentialType(output.credentialType);

  lines.push('```sh', `./${output.handoffCommand}`, '```', '', `- **claim code expires:** ${output.claimExpiresAt} (one-time use)`);

  if (credentialDescription != null) {
    lines.push(`- **credential:** ${credentialDescription}`);
  }

  lines.push(`- **credential expires:** ${output.expiresAt}`, `- **scopes:** \`${output.scope}\``, '', '_The claim code is single-use and short-lived; the credential it unwraps is capped at one hour. Re-run this tool for a fresh one rather than trying to extend either._');

  return lines.join('\n');
}

// MARK: Schemas
const CLI_TOKEN_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    scopes: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Optional subset of YOUR OWN scopes to grant the credential. Narrows the verb and capability scopes (such as `model.read`). The identity scopes are always kept when you hold them — `openid`, `profile`, `email`, and the app’s own claims scope, which carries your roles — so a narrowed credential is still you, with your roles. Scopes you do not hold are ignored, and `token.cli` / `token.service` are always stripped. Defaults to every scope this session holds.'
    },
    credentialType: {
      type: 'string',
      enum: ['bearer', 'refresh'],
      description:
        'The kind of credential to mint. `bearer` (the default) is an access token the CLI uses directly, with no client authentication; it cannot be refreshed, so mint again when it lapses. `refresh` is only for a CLI that predates bearer handoffs, and only works when the CLI can authenticate as the app’s CLI OAuth client.'
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
  description: 'The one-time claim code and the minted credential’s metadata. The credential itself is never returned here.',
  properties: {
    claimCode: { type: 'string' },
    claimExpiresAt: { type: 'string' },
    expiresAt: { type: 'string' },
    scope: { type: 'string' },
    credentialType: { type: 'string', enum: ['bearer', 'refresh'], description: 'The kind of credential the claim code redeems to. A bearer credential cannot be refreshed — mint again when it lapses.' },
    cliName: { type: 'string' },
    downloadUrl: { type: 'string' },
    downloadSha256: { type: 'string' },
    installCommand: { type: 'string', description: 'Downloads the CLI to a file named `cliName` and marks it executable. Keep that name: the CLI is a single ES-module file, and Node refuses to run it under an unrecognized extension.' },
    envName: { type: 'string' },
    handoffCommand: { type: 'string' }
  }
} as const;
