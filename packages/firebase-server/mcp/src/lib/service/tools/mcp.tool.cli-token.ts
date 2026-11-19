import type { CallToolResult } from '@modelcontextprotocol/server';
import { AUTH_ADMIN_ROLE, type AuthRole, type Maybe } from '@dereekb/util';
import { type CliTokenCredentialType, CLI_TOKEN_BEARER_CREDENTIAL_TYPE, CLI_TOKEN_OIDC_SCOPE, isCliTokenCredentialType } from '@dereekb/firebase';
import { requestClientIp } from '@dereekb/firebase-server';
import { type McpCliTokenAdditionalDownload, type McpCliTokenMintAdditionalDownload, type McpCliTokenMinter, type McpCliTokenMintResult } from '../../mcp.config';
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

/**
 * Pattern every configured additional-download name must match: lowercase letters, digits, `.`, `_` and
 * `-`, starting with a letter or digit.
 *
 * The name is written unquoted into the rendered `curl -fsSL -o <name> "<url>" && chmod +x <name>`
 * command, so anything that a shell would read as more than a plain file name is refused at boot.
 */
export const MCP_CLI_TOKEN_DOWNLOAD_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

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
  /**
   * Binaries the caller can request by name beside the CLI, from `McpModuleConfig.cliTokenAdditionalDownloads`.
   * Each name must match {@link MCP_CLI_TOKEN_DOWNLOAD_NAME_PATTERN}. When empty or unset the tool's
   * schemas, description and output are exactly those of a tool without additional downloads.
   */
  readonly additionalDownloads?: Maybe<readonly McpCliTokenAdditionalDownload[]>;
}

/**
 * One additional download in {@link CliTokenToolOutput.downloads}.
 */
export interface CliTokenToolDownloadOutput {
  readonly name: string;
  readonly downloadUrl: string;
  readonly downloadSha256?: string;
  readonly version?: string;
  /**
   * The command that downloads the binary to a file named {@link name} and marks it executable.
   */
  readonly installCommand: string;
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
  /**
   * The additional downloads the caller requested with `includeDownloads` and the minter could serve.
   * A requested binary whose artifact is missing is left out.
   */
  readonly downloads?: readonly CliTokenToolDownloadOutput[];
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
 * With {@link CreateCliTokenToolDeps.additionalDownloads} configured, the caller can also request other
 * binaries by name (`includeDownloads`); the minter mints their URLs and the tool renders an install
 * command for each. With none configured the tool is exactly the tool without them.
 *
 * @param deps - The app-supplied minter, plus the optional tool name, required roles and additional downloads.
 * @returns A statically-registered {@link McpToolDefinition} to append to the MCP server factory's tool registry.
 * @throws {Error} When an additional download's name is not a safe binary file name, or is configured twice.
 */
export function createCliTokenTool(deps: CreateCliTokenToolDeps): McpToolDefinition {
  const additionalDownloads = deps.additionalDownloads ?? [];
  assertValidCliTokenAdditionalDownloads(additionalDownloads);

  const downloadNames: ReadonlySet<string> = new Set(additionalDownloads.map((download) => download.name));
  const hasDownloads = additionalDownloads.length > 0;
  const downloadNamesList = additionalDownloads.map((download) => '`' + download.name + '`').join(', ');
  const handler: McpStaticToolHandler = (args, ctx) => cliTokenToolHandler({ args, ctx, minter: deps.minter, downloadNames });

  return buildStaticToolDefinition({
    name: deps.name ?? CLI_TOKEN_TOOL_NAME,
    description: hasDownloads ? `${CLI_TOKEN_TOOL_DESCRIPTION} Additional CLIs can be requested by name with \`includeDownloads\` (${downloadNamesList}); each one available comes back in \`downloads\` with its own \`installCommand\`.` : CLI_TOKEN_TOOL_DESCRIPTION,
    inputSchema: hasDownloads ? makeCliTokenInputSchemaWithDownloads(additionalDownloads) : CLI_TOKEN_INPUT_SCHEMA,
    outputSchema: hasDownloads ? CLI_TOKEN_OUTPUT_SCHEMA_WITH_DOWNLOADS : CLI_TOKEN_OUTPUT_SCHEMA,
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

/**
 * Throws when a configured additional download has a name that is not a safe binary file name, or when
 * two share a name. Runs when the tool is built, which is at boot.
 *
 * @param additionalDownloads - The configured additional downloads.
 * @throws {Error} When a name does not match {@link MCP_CLI_TOKEN_DOWNLOAD_NAME_PATTERN} or is used twice.
 */
export function assertValidCliTokenAdditionalDownloads(additionalDownloads: readonly McpCliTokenAdditionalDownload[]): void {
  const seen = new Set<string>();

  additionalDownloads.forEach(({ name }) => {
    if (typeof name !== 'string' || !MCP_CLI_TOKEN_DOWNLOAD_NAME_PATTERN.test(name)) {
      throw new Error(`Invalid McpModuleConfig.cliTokenAdditionalDownloads name "${String(name)}": it must match ${MCP_CLI_TOKEN_DOWNLOAD_NAME_PATTERN.source}, because it is written into a shell command.`);
    }

    if (seen.has(name)) {
      throw new Error(`McpModuleConfig.cliTokenAdditionalDownloads names "${name}" more than once.`);
    }

    seen.add(name);
  });
}

// MARK: Handler
interface CliTokenToolHandlerInput {
  readonly args: Record<string, unknown>;
  readonly ctx: McpStaticToolHandlerContext;
  readonly minter: McpCliTokenMinter;
  readonly downloadNames: ReadonlySet<string>;
}

async function cliTokenToolHandler(input: CliTokenToolHandlerInput): Promise<CallToolResult> {
  const { args, ctx, minter, downloadNames } = input;
  const includeDownloads = parseIncludeDownloads(args['includeDownloads'], downloadNames);
  const minted = await minter({
    auth: ctx.auth,
    scopes: parseScopes(args['scopes']),
    ttlSeconds: parseTtlSeconds(args['ttlSeconds']),
    credentialType: parseCredentialType(args['credentialType']) ?? DEFAULT_MCP_CLI_TOKEN_CREDENTIAL_TYPE,
    includeDownloadUrl: args['includeDownloadUrl'] !== false,
    // resolved from the tool call's raw request so an MCP mint records the same address an HTTP mint
    // does — see McpCliTokenMintInput.requestIp
    requestIp: requestClientIp(ctx.rawRequest),
    ...(includeDownloads == null ? {} : { includeDownloads })
  });

  const output = buildOutput(minted, includeDownloads ?? []);

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
 * @param includeDownloads - The validated additional-download names the caller requested.
 * @returns The tool output payload.
 */
function buildOutput(minted: McpCliTokenMintResult, includeDownloads: readonly string[]): CliTokenToolOutput {
  const cliName = minted.cliName ?? '<cli>';
  const envArgument = minted.envName == null ? '' : ` --env ${minted.envName}`;
  // a real file name, never the `<cli>` placeholder — a shell would read that as a redirect
  const binaryName = minted.cliName ?? 'cli';

  const output: CliTokenToolOutput = {
    claimCode: minted.claimCode,
    claimExpiresAt: minted.claimExpiresAt,
    expiresAt: minted.expiresAt,
    scope: minted.scope,
    ...(minted.credentialType == null ? {} : { credentialType: minted.credentialType }),
    handoffCommand: `${cliName} auth handoff ${minted.claimCode}${envArgument}`,
    ...(minted.cliName == null ? {} : { cliName: minted.cliName }),
    ...(minted.downloadUrl == null ? {} : { downloadUrl: minted.downloadUrl }),
    ...(minted.downloadSha256 == null ? {} : { downloadSha256: minted.downloadSha256 }),
    ...(minted.downloadUrl == null ? {} : { installCommand: makeInstallCommand(binaryName, minted.downloadUrl) }),
    ...(minted.envName == null ? {} : { envName: minted.envName })
  };
  const downloads = buildDownloadsOutput(minted.additionalDownloads ?? [], includeDownloads);

  return downloads.length > 0 ? { ...output, downloads } : output;
}

/**
 * Pairs each requested name with the minter's entry for it, in request order.
 *
 * Only requested names are rendered, so the shell command only ever carries a name that passed
 * {@link MCP_CLI_TOKEN_DOWNLOAD_NAME_PATTERN} at boot, whatever the minter returned. A requested name the
 * minter left out (a missing artifact) is left out here too.
 *
 * @param minted - The minter's additional downloads.
 * @param includeDownloads - The validated, de-duplicated names the caller requested.
 * @returns One output entry per requested name the minter served.
 */
function buildDownloadsOutput(minted: readonly McpCliTokenMintAdditionalDownload[], includeDownloads: readonly string[]): CliTokenToolDownloadOutput[] {
  const byName = new Map<string, McpCliTokenMintAdditionalDownload>();

  minted.forEach((download) => {
    if (typeof download?.downloadUrl === 'string' && download.downloadUrl.length > 0 && !byName.has(download.name)) {
      byName.set(download.name, download);
    }
  });

  return includeDownloads
    .map((name) => byName.get(name))
    .filter((download): download is McpCliTokenMintAdditionalDownload => download != null)
    .map((download) => ({
      name: download.name,
      downloadUrl: download.downloadUrl,
      ...(download.downloadSha256 == null ? {} : { downloadSha256: download.downloadSha256 }),
      ...(download.version == null ? {} : { version: download.version }),
      installCommand: makeInstallCommand(download.name, download.downloadUrl)
    }));
}

function makeInstallCommand(binaryName: string, downloadUrl: string): string {
  return `curl -fsSL -o ${binaryName} "${downloadUrl}" && chmod +x ${binaryName}`;
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

// Reads the optional `includeDownloads` input, keeping only configured names, each once, in request order.
function parseIncludeDownloads(value: unknown, downloadNames: ReadonlySet<string>): Maybe<readonly string[]> {
  let result: Maybe<readonly string[]>;

  if (Array.isArray(value) && downloadNames.size > 0) {
    const names = Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string' && downloadNames.has(entry))));
    result = names.length > 0 ? names : undefined;
  }

  return result;
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
  const downloads = output.downloads ?? [];

  if (downloads.length > 0) {
    lines.push('## 1. Download', '');

    if (output.installCommand != null) {
      pushInstallLines(lines, { heading: `### ${output.cliName ?? 'cli'}`, installCommand: output.installCommand, downloadSha256: output.downloadSha256 });
    }

    downloads.forEach((download) => pushInstallLines(lines, { heading: download.version == null ? `### ${download.name}` : `### ${download.name} (${download.version})`, installCommand: download.installCommand, downloadSha256: download.downloadSha256 }));
    lines.push(output.installCommand == null ? '## 2. Log in' : '## 2. Log it in', '');
  } else if (output.installCommand == null) {
    lines.push('## Log in', '');
  } else {
    lines.push('## 1. Download the CLI', '');
    pushInstallLines(lines, { installCommand: output.installCommand, downloadSha256: output.downloadSha256 });
    lines.push('## 2. Log it in', '');
  }

  const credentialDescription = describeCredentialType(output.credentialType);

  lines.push('```sh', `./${output.handoffCommand}`, '```', '', `- **claim code expires:** ${output.claimExpiresAt} (one-time use)`);

  if (credentialDescription != null) {
    lines.push(`- **credential:** ${credentialDescription}`);
  }

  lines.push(`- **credential expires:** ${output.expiresAt}`, `- **scopes:** \`${output.scope}\``, '', '_The claim code is single-use and short-lived; the credential it unwraps lapses at the time above (the app caps it, one hour by default). Re-run this tool for a fresh one rather than trying to extend either._');

  return lines.join('\n');
}

interface PushInstallLinesInput {
  readonly heading?: string;
  readonly installCommand: string;
  readonly downloadSha256?: Maybe<string>;
}

function pushInstallLines(lines: string[], input: PushInstallLinesInput): void {
  if (input.heading != null) {
    lines.push(input.heading, '');
  }

  lines.push('```sh', input.installCommand, '```', '');

  if (input.downloadSha256 != null) {
    lines.push(`SHA-256: \`${input.downloadSha256}\``, '');
  }
}

// MARK: Schemas
const CLI_TOKEN_TOOL_DESCRIPTION =
  'Mints a short-lived CLI login credential for YOU (the calling session) and returns a one-time claim code plus, when available, a signed download URL for the CLI binary. The credential is capped by the app (one hour by default), carries no more privilege than this session (never `token.cli` or `token.service`), and expires with this session if that is sooner. By default it is a bearer access token the CLI uses directly; it cannot be refreshed, so re-mint rather than refresh when it lapses. The credential itself is never returned here — redeem the claim code with `<cli> auth handoff <code>` within two minutes. Download with `installCommand`: it saves the CLI under its own name, and Node will not run the single-file ES-module CLI under an unrecognized extension.';

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
      description: "Optional requested lifetime in seconds. Clamped to the app's ceiling (one hour by default) and to the remaining life of this session."
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

const CLI_TOKEN_DOWNLOAD_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['name', 'downloadUrl', 'installCommand'],
  properties: {
    name: { type: 'string' },
    downloadUrl: { type: 'string' },
    downloadSha256: { type: 'string' },
    version: { type: 'string' },
    installCommand: { type: 'string', description: 'Downloads the binary to a file named `name` and marks it executable. Keep that name.' }
  }
} as const;

const CLI_TOKEN_OUTPUT_SCHEMA_WITH_DOWNLOADS = {
  ...CLI_TOKEN_OUTPUT_SCHEMA,
  properties: {
    ...CLI_TOKEN_OUTPUT_SCHEMA.properties,
    downloads: {
      type: 'array',
      description: 'The additional downloads requested with `includeDownloads` that are available. A requested binary whose artifact is missing is left out.',
      items: CLI_TOKEN_DOWNLOAD_OUTPUT_SCHEMA
    }
  }
} as const;

/**
 * Builds the input schema for a tool with additional downloads configured: the base schema plus an
 * `includeDownloads` array whose items are the configured names, each listed with its description.
 *
 * @param additionalDownloads - The configured, validated additional downloads. Never empty.
 * @returns The input schema.
 */
function makeCliTokenInputSchemaWithDownloads(additionalDownloads: readonly McpCliTokenAdditionalDownload[]): object {
  const available = additionalDownloads.map((download) => `- \`${download.name}\`: ${download.description}`);

  return {
    ...CLI_TOKEN_INPUT_SCHEMA,
    properties: {
      ...CLI_TOKEN_INPUT_SCHEMA.properties,
      includeDownloads: {
        type: 'array',
        items: { type: 'string', enum: additionalDownloads.map((download) => download.name) },
        description: ['Also mint signed download URLs for these additional CLIs, by name. Each one available comes back in `downloads` with its own `installCommand`, which saves it under its name; one whose artifact is missing is left out. Independent of `includeDownloadUrl`. Available:', ...available].join('\n')
      }
    }
  };
}
