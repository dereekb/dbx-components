import { Controller, Get, Inject } from '@nestjs/common';
import { OidcProviderConfigService } from '@dereekb/firebase-server/oidc';
import { McpModuleConfig } from '../mcp.config';
import { type OidcScope } from '@dereekb/firebase';

/**
 * Discovery document body for the OAuth protected-resource indicator.
 *
 * Format defined by RFC 9728 (OAuth 2.0 Protected Resource Metadata).
 */
export interface OAuthProtectedResourceMetadata {
  readonly resource: string;
  readonly authorization_servers: ReadonlyArray<string>;
  /**
   * Scopes the resource accepts (RFC 9728 §2). Advertised so dynamic-registration
   * MCP clients (e.g. the Claude Code CLI) know which scopes to request on the
   * authorization call. Omitted when {@link McpModuleConfig.scopesSupported} is unset.
   */
  readonly scopes_supported?: ReadonlyArray<OidcScope>;
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
  constructor(
    @Inject(McpModuleConfig) private readonly mcpConfig: McpModuleConfig,
    @Inject(OidcProviderConfigService) private readonly oidcProviderConfigService: OidcProviderConfigService
  ) {}

  @Get('oauth-protected-resource')
  getProtectedResourceMetadata(): OAuthProtectedResourceMetadata {
    const { mcpUrl, oidcIssuer, scopesSupported: scopesFilter } = this.mcpConfig;

    // Base scope list is the OIDC provider's own `scopes_supported`, so the resource
    // advertises exactly what the issuer grants; the optional filter narrows it.
    const providerScopes = this.oidcProviderConfigService.scopesSupported;
    const scopes = scopesFilter ? scopesFilter(providerScopes) : providerScopes;

    return {
      resource: mcpUrl,
      authorization_servers: [oidcIssuer],
      ...(scopes.length ? { scopes_supported: [...scopes] } : undefined)
    };
  }
}
