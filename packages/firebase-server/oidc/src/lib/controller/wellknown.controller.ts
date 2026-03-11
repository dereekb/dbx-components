import { Controller, Get, Inject } from '@nestjs/common';
import { JwksService } from '../service/jwks.service';
import { OidcModuleConfig } from '../oidc.config';
import { OidcProviderConfigService, type OidcDiscoveryMetadata } from '../service/oidc.config.service';

// MARK: Well-Known Controller
/**
 * Controller for OAuth/OIDC discovery and metadata endpoints.
 */
@Controller('.well-known')
export class OidcWellKnownController {
  constructor(
    @Inject(OidcModuleConfig) private readonly config: OidcModuleConfig,
    @Inject(OidcProviderConfigService) private readonly providerConfigService: OidcProviderConfigService,
    @Inject(JwksService) private readonly jwksService: JwksService
  ) {}

  /**
   * OpenID Connect Discovery endpoint (RFC 8414 / OpenID Connect Discovery 1.0).
   *
   * Returns the provider metadata so clients can auto-discover endpoints,
   * supported scopes, signing algorithms, etc.
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
   */
  @Get('jwks.json')
  async getJwks() {
    return this.jwksService.getLatestPublicJwks();
  }

  /**
   * OAuth Protected Resource discovery endpoint.
   * Required by Claude custom connectors (RFC 8707).
   */
  @Get('oauth-protected-resource')
  getProtectedResource() {
    return {
      authorization_servers: [this.config.issuer]
    };
  }
}
