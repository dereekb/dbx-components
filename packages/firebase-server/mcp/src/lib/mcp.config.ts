import { type AuthClaims, type AuthRoleSet } from '@dereekb/util';

/**
 * Default path the MCP Streamable HTTP transport is mounted at.
 *
 * Combined with the app origin to form the canonical MCP resource URL
 * (e.g., `https://api.example.com/mcp`) advertised in the protected-resource
 * discovery document at `/.well-known/oauth-protected-resource`.
 */
export const DEFAULT_MCP_PATH = '/mcp';

/**
 * Default name advertised by the MCP server on the JSON-RPC `initialize` handshake.
 *
 * Apps may override this via {@link McpModuleConfig.serverName} to identify their
 * deployment (e.g., `demo-api-mcp`, `hellosubs-api-mcp`).
 */
export const DEFAULT_MCP_SERVER_NAME = 'dbx-firebase-server-mcp';

/**
 * Default `instructions` string advertised by the MCP server on the JSON-RPC `initialize`
 * handshake. Apps may override this via {@link McpModuleConfig.serverInstructions}.
 */
export const DEFAULT_MCP_SERVER_INSTRUCTIONS = 'A set of call-model tools generated automatically.';

/**
 * Default name of the auto-injected reason parameter added to every advertised MCP tool's input
 * schema. See {@link McpReasonParameterConfig.parameterName}.
 */
export const DEFAULT_MCP_REASON_PARAMETER_NAME = 'reason';

/**
 * Default maximum length (in characters) of the auto-injected reason parameter. Values longer than
 * this are clamped server-side before being forwarded to analytics. See
 * {@link McpReasonParameterConfig.maxLength}.
 */
export const DEFAULT_MCP_REASON_PARAMETER_MAX_LENGTH = 250;

/**
 * Default required-ness of the auto-injected reason parameter. See
 * {@link McpReasonParameterConfig.required}.
 */
export const DEFAULT_MCP_REASON_PARAMETER_REQUIRED = true;

/**
 * Default description advertised for the auto-injected reason parameter on every tool's input schema.
 * See {@link McpReasonParameterConfig.description}.
 */
export const DEFAULT_MCP_REASON_PARAMETER_DESCRIPTION = 'A brief human-readable reason (≤250 chars) explaining why this tool is being called. Recorded for analytics/audit only; not part of the operation.';

/**
 * Configuration for the auto-injected `reason` parameter the MCP server adds to every advertised
 * tool's input schema.
 *
 * When enabled (the default), the server augments each tool's `inputSchema` with a `reason` string
 * property — a short human-readable justification for the call, surfaced to the model and recorded on
 * the per-call analytics event. The field is stripped from the JSON body before the args are
 * dispatched to the underlying handler, so call-model handlers never receive it.
 *
 * Supplied to {@link McpModuleConfig.reasonParameter} as a full object (to tune individual fields), or
 * as a boolean shorthand (`true` = defaults on, `false` = disabled).
 */
export interface McpReasonParameterConfig {
  /**
   * Whether the reason parameter is injected at all. Defaults to `true`. Set `false` to disable
   * (equivalent to `reasonParameter: false`).
   */
  readonly enabled?: boolean;
  /**
   * Whether the parameter is marked `required` in the advertised input schema. Defaults to
   * {@link DEFAULT_MCP_REASON_PARAMETER_REQUIRED}.
   */
  readonly required?: boolean;
  /**
   * Maximum character length advertised (`maxLength`) and enforced server-side (the forwarded value is
   * clamped). Defaults to {@link DEFAULT_MCP_REASON_PARAMETER_MAX_LENGTH}.
   */
  readonly maxLength?: number;
  /**
   * Description advertised for the parameter on each tool's input schema. Defaults to
   * {@link DEFAULT_MCP_REASON_PARAMETER_DESCRIPTION}.
   */
  readonly description?: string;
  /**
   * Name of the injected parameter. Defaults to {@link DEFAULT_MCP_REASON_PARAMETER_NAME} (`'reason'`).
   * Rename to avoid colliding with a handler that legitimately consumes a `reason` input field.
   */
  readonly parameterName?: string;
}

/**
 * Configuration for the firebase-server/mcp module.
 *
 * Apps construct this in their `*McpModule` provider and pass it through
 * {@link mcpModuleMetadata}. It carries:
 *
 * - The canonical issuer URL for the OIDC provider that gates this MCP endpoint
 *   (used in the protected-resource discovery document).
 * - The canonical resource URL where the MCP transport is mounted (also part of
 *   the discovery document; doubles as the `resource` claim consumers should
 *   verify their access tokens against).
 * - Optional server identity (name, version) advertised on the MCP `initialize` handshake.
 *
 * The OAuth bearer middleware that authenticates `/mcp` is configured on
 * {@link OidcModuleConfig.protectedPaths} — that's outside this config's scope.
 */
export abstract class McpModuleConfig {
  /**
   * The canonical issuer URL of the OIDC provider that gates this MCP endpoint.
   *
   * Surfaced in the `authorization_servers` field of the protected-resource
   * discovery document. Claude custom-connector reads this to discover the OIDC issuer.
   *
   * @example 'https://api.example.com/oidc'
   */
  readonly oidcIssuer!: string;

  /**
   * The canonical resource URL of the MCP endpoint.
   *
   * Surfaced as the `resource` field of the protected-resource discovery document,
   * and used as the audience the access token's `aud` claim should match.
   *
   * @example 'https://api.example.com/mcp'
   */
  readonly mcpUrl!: string;

  /**
   * Optional name advertised on the MCP `initialize` handshake. Defaults to
   * {@link DEFAULT_MCP_SERVER_NAME}.
   */
  readonly serverName?: string;

  /**
   * Optional version advertised on the MCP `initialize` handshake.
   */
  readonly serverVersion?: string;
  /**
   * Optional override for the `instructions` string passed to `new McpServer(...)` and
   * advertised on the JSON-RPC `initialize` handshake. Defaults to
   * {@link DEFAULT_MCP_SERVER_INSTRUCTIONS}.
   */
  readonly serverInstructions?: string;
  /**
   * Absolute path to a pre-rendered MCP manifest JSON file produced by
   * `dbx-cli-generate-mcp-manifest`. When set, the runtime reads it once at
   * boot and uses each tool's `description`, `inputSchema`, and `outputSchema`
   * during tool generation — no per-request file I/O.
   *
   * Optional. When unset or the file is missing, the runtime falls back to
   * today's behavior (auto-generated descriptions, ArkType-derived input
   * schemas, no output schemas) and emits a single boot warning.
   */
  readonly mcpManifestPath?: string;
  /**
   * Absolute path to a pre-rendered route manifest JSON file produced by
   * `dbx-cli-generate-route-manifest`. When set, the runtime reads it once at
   * boot and registers the built-in `url-models` tool, which decodes an app URL
   * into the Firestore models its page renders.
   *
   * Optional. When unset or the file is missing, the runtime skips registering
   * `url-models` and emits a single boot warning when the path was set but
   * unreadable.
   */
  readonly mcpRouteManifestPath?: string;
  /**
   * When `true`, the MCP server only advertises tools whose effective read-only classification is `true`.
   *
   * Write tools (`create`/`update`/`delete`) and tools with unknown classification (e.g., `invoke`
   * with no explicit `mcp.readOnly` override) are dropped from `tools/list` — fail-safe under the
   * principle that anything not provably read-only is treated as a write.
   *
   * The advertised `serverName` on the JSON-RPC `initialize` handshake is suffixed with
   * ` (read-only)` so the client surface reflects the mode.
   */
  readonly readOnly?: boolean;

  /**
   * Controls the auto-injected `reason` parameter added to every advertised tool's input schema.
   *
   * Enabled by default (unset / `true` = defaults on). Pass a {@link McpReasonParameterConfig} object
   * to tune `required`, `maxLength`, `description`, or `parameterName`, or `false` to disable it.
   *
   * When enabled, every advertised tool's `inputSchema` carries a required `reason` string the model
   * fills with a short justification for the call. The value is forwarded to analytics and stripped
   * from the dispatched handler body. See {@link McpReasonParameterConfig}.
   */
  readonly reasonParameter?: McpReasonParameterConfig | boolean;
}

/**
 * Signature for the optional role reader the MCP module uses when evaluating
 * declarative {@link McpVisibilityRule.requiredRoles} on `tools/list`.
 *
 * The MCP factory does not have access to the constructed `FirebaseServerAuthContext`
 * (that's built later by the dispatch chain), so apps wire a thin function that
 * maps the caller's Firebase custom claims to the corresponding role set —
 * typically `authRoleClaimsService(...).toRoles` from `@dereekb/util`.
 *
 * When no reader is provided, declarative role checks fail closed (treated as
 * "missing role"), and the factory emits a single boot-time warning.
 */
export type McpAuthRoleReader = (claims: AuthClaims) => AuthRoleSet;

/**
 * NestJS injection token for the optional {@link McpAuthRoleReader} provider.
 */
export const MCP_AUTH_ROLE_READER = 'MCP_AUTH_ROLE_READER';
