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
   * authorization call — they request this list verbatim, so it carries only scopes
   * such a client can actually be granted. Omitted when the resolved list is empty.
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
 *
 * Because the document must be reachable at the origin root, the MCP endpoint has to be
 * exposed through a host that serves the app at `/` — Firebase Hosting, or the hosting
 * emulator in development. Pointing a client straight at the Functions emulator origin
 * (`http://localhost:<port>/<project>/<region>/<function>/mcp`) breaks discovery: that
 * runtime only routes `/<project>/<region>/<function>/…`, so nothing answers at the root
 * and a client that has not yet seen a 401 challenge cannot find the issuer.
 */
@Controller('.well-known')
export class McpWellKnownController {
  constructor(
    @Inject(McpModuleConfig) private readonly mcpConfig: McpModuleConfig,
    @Inject(OidcProviderConfigService) private readonly oidcProviderConfigService: OidcProviderConfigService
  ) {}

  /**
   * Serves both RFC 9728 discovery URLs — the primary form (§3.1), which inserts the resource's
   * path after the well-known prefix (`/.well-known/oauth-protected-resource/mcp`), and the bare
   * form (`/.well-known/oauth-protected-resource`) that clients probe as a fallback.
   *
   * The document is identical either way; the resource identity comes from
   * {@link McpModuleConfig.mcpUrl}, not from the request path. Serving the primary form means
   * discovery succeeds on a client's first probe rather than depending on it implementing the
   * fallback.
   *
   * @returns The protected-resource metadata document.
   */
  @Get(['oauth-protected-resource', 'oauth-protected-resource/{*path}'])
  getProtectedResourceMetadata(): OAuthProtectedResourceMetadata {
    const { mcpUrl, oidcIssuer, scopesSupported: scopesFilter } = this.mcpConfig;

    // Base scope list is what the issuer grants an arbitrary client, NOT its full
    // `scopes_supported`: a dynamic-registration client copies this list verbatim onto
    // `/authorize`, and a provider-profile-gated scope in it would be hard-rejected at the
    // consent unlock gate (`access_denied`) for every client lacking that profile assignment.
    // The optional filter narrows the list further.
    const providerScopes = this.oidcProviderConfigService.clientRequestableScopesSupported;
    const scopes = scopesFilter ? scopesFilter(providerScopes) : providerScopes;

    return {
      resource: mcpUrl,
      authorization_servers: [oidcIssuer],
      ...(scopes.length ? { scopes_supported: [...scopes] } : undefined)
    };
  }
}
