import { Controller, Get, Inject } from '@nestjs/common';
import { OAUTH_MODULE_CONFIG_TOKEN, type OAuthModuleConfig } from './oauth.config';

/**
 * Controller for OAuth/OIDC discovery and metadata endpoints.
 */
@Controller('.well-known')
export class OAuthController {
  constructor(@Inject(OAUTH_MODULE_CONFIG_TOKEN) private readonly config: OAuthModuleConfig) {}

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
