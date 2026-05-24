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
}
