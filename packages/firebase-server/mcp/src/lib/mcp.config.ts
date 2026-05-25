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
