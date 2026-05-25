import { Controller, Get, Inject } from '@nestjs/common';
import { JwksService } from '../service/oidc.jwks.service';
import { OidcProviderConfigService, type OidcDiscoveryMetadata } from '../service/oidc.config.service';

// MARK: Well-Known Controller
/**
 * Controller for OIDC discovery and JWKS endpoints under `/.well-known`.
 *
 * The protected-resource discovery doc (`/.well-known/oauth-protected-resource`)
 * is owned by the protected resource itself (the MCP module's
 * `McpWellKnownController`), not the authorization server, per RFC 9728.
 */
@Controller('.well-known')
export class OidcWellKnownController {
  constructor(
    @Inject(OidcProviderConfigService) private readonly providerConfigService: OidcProviderConfigService,
    @Inject(JwksService) private readonly jwksService: JwksService
  ) {}

  /**
   * OpenID Connect Discovery endpoint (RFC 8414 / OpenID Connect Discovery 1.0).
   *
   * Returns the provider metadata so clients can auto-discover endpoints,
   * supported scopes, signing algorithms, etc.
   *
   * @returns The OIDC discovery metadata document.
   */
  @Get('openid-configuration')
  async getOpenIdConfiguration(): Promise<OidcDiscoveryMetadata> {
    const jwksUri = (await this.jwksService.getJwksStoragePublicUrl()) ?? undefined;
    return this.providerConfigService.buildDiscoveryMetadata(jwksUri);
  }

  /**
   * JWKS endpoint. Returns the public JSON Web Key Set for token verification.
   *
   * This endpoint is typically skipped if the JwksServiceStorageConfig is provided.
   *
   * @returns The public JWKS containing all non-retired signing keys.
   */
  @Get('jwks.json')
  async getJwks() {
    return this.jwksService.getLatestPublicJwks();
  }
}
