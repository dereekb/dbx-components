import { Controller, Get, Inject } from '@nestjs/common';
import { McpModuleConfig } from '../mcp.config';

/**
 * Discovery document body for the OAuth protected-resource indicator.
 *
 * Format defined by RFC 9728 (OAuth 2.0 Protected Resource Metadata).
 */
export interface OAuthProtectedResourceMetadata {
  readonly resource: string;
  readonly authorization_servers: ReadonlyArray<string>;
}

/**
 * Serves the `GET /.well-known/oauth-protected-resource` metadata document so
 * Claude (and other MCP clients) can discover which OIDC issuer guards this
 * MCP endpoint.
 *
 * The route is registered without a controller-level prefix because well-known
 * URIs must live at the host root. Apps need to exclude `.well-known/{*path}`
 * from any global API route prefix (see `FIREBASE_SERVER_OIDC_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE`
 * in `firebase-server/oidc` for the corresponding OIDC excludes).
 */
@Controller('.well-known')
export class McpWellKnownController {
  constructor(@Inject(McpModuleConfig) private readonly mcpConfig: McpModuleConfig) {}

  @Get('oauth-protected-resource')
  getProtectedResourceMetadata(): OAuthProtectedResourceMetadata {
    return {
      resource: this.mcpConfig.mcpUrl,
      authorization_servers: [this.mcpConfig.oidcIssuer]
    };
  }
}
