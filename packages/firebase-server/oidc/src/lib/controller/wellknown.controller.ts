import { Controller, Get, Inject } from '@nestjs/common';
import { JwksService } from '../service/jwks.service';
import { OidcModuleConfig } from '../oidc.config';

// MARK: Well-Known Controller
/**
 * Controller for OAuth/OIDC discovery and metadata endpoints.
 */
@Controller('.well-known')
export class OidcWellKnownController {
  constructor(
    @Inject(OidcModuleConfig) private readonly config: OidcModuleConfig,
    @Inject(JwksService) private readonly jwksService: JwksService
  ) {}

  /**
   * OpenID Connect Discovery endpoint (RFC 8414 / OpenID Connect Discovery 1.0).
   *
   * Returns the provider metadata so clients can auto-discover endpoints,
   * supported scopes, signing algorithms, etc.
   */
  @Get('openid-configuration')
  async getOpenIdConfiguration() {
    const issuer = this.config.issuer;
    const jwksUri = (await this.jwksService.getJwksStoragePublicUrl()) ?? `${issuer}/.well-known/jwks.json`;

    return {
      issuer,
      authorization_endpoint: `${issuer}/auth`,
      token_endpoint: `${issuer}/token`,
      userinfo_endpoint: `${issuer}/userinfo`,
      jwks_uri: jwksUri,
      registration_endpoint: `${issuer}/reg`,
      scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      claims_supported: ['sub', 'name', 'picture', 'email', 'email_verified'],
      code_challenge_methods_supported: ['S256']
    };
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
