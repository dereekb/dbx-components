import { Inject, Injectable } from '@nestjs/common';
import {
  type MicrosoftEntraTenantId,
  type MicrosoftOAuth,
  type MicrosoftOAuthAccessToken,
  type MicrosoftOAuthAuthorizeUrlFactory,
  type MicrosoftOAuthAuthorizeUrlFactoryConfig,
  type MicrosoftOAuthClientId,
  type MicrosoftOAuthContext,
  type MicrosoftOAuthExchangeAuthorizationCodeInput,
  type MicrosoftOAuthRefreshTokenInput,
  exchangeAuthorizationCode,
  microsoftOAuthAccessTokenFromTokenResponse,
  microsoftOAuthAuthorizeUrlFactory,
  microsoftOAuthFactory,
  readCurrentUser,
  refreshAccessToken
} from '@dereekb/microsoft';
import { MicrosoftOAuthServiceConfig } from './oauth.config';

/**
 * Provides the app's configured single-tenant Microsoft OAuth client.
 *
 * Holds one client authenticated with the APPLICATION's credentials. The external-connection framework
 * persists each user's credentials itself, so there is no token cache here.
 */
@Injectable()
export class MicrosoftOAuthApi {
  readonly microsoftOAuth: MicrosoftOAuth;

  get oauthContext(): MicrosoftOAuthContext {
    return this.microsoftOAuth.oauthContext;
  }

  /**
   * The OAuth client id the api authorizes as.
   *
   * @returns The configured client id.
   */
  get clientId(): MicrosoftOAuthClientId {
    return this.oauthContext.config.clientId;
  }

  /**
   * The single tenant the api authorizes against.
   *
   * @returns The configured tenant id.
   */
  get tenantId(): MicrosoftEntraTenantId {
    return this.oauthContext.config.tenantId;
  }

  constructor(@Inject(MicrosoftOAuthServiceConfig) readonly config: MicrosoftOAuthServiceConfig) {
    const microsoftOAuthConfig = MicrosoftOAuthServiceConfig.assertedMicrosoftOAuthConfig(config);
    this.microsoftOAuth = microsoftOAuthFactory(config.factoryConfig ?? {})(microsoftOAuthConfig);
  }

  // MARK: Accessors
  /**
   * Configured pass-through for {@link exchangeAuthorizationCode}.
   *
   * @returns Function to exchange an authorization code for tokens.
   */
  get exchangeAuthorizationCode() {
    return exchangeAuthorizationCode(this.oauthContext);
  }

  /**
   * Configured pass-through for {@link refreshAccessToken}.
   *
   * @returns Function to refresh an access token.
   */
  get refreshAccessToken() {
    return refreshAccessToken(this.oauthContext);
  }

  /**
   * Configured pass-through for {@link readCurrentUser}. Bearer-authenticated with the user's token.
   *
   * @returns Function to read the Graph user an access token belongs to.
   */
  get readCurrentUser() {
    return readCurrentUser(this.oauthContext);
  }

  /**
   * Builds a {@link MicrosoftOAuthAuthorizeUrlFactory} for the app's tenant and client id.
   *
   * @param config - The redirect URI and optional authorize URL.
   * @returns A factory composing the authorize URL for a state, challenge and scope set.
   */
  authorizeUrlFactory(config: Omit<MicrosoftOAuthAuthorizeUrlFactoryConfig, 'clientId' | 'tenantId'>): MicrosoftOAuthAuthorizeUrlFactory {
    return microsoftOAuthAuthorizeUrlFactory({ ...config, tenantId: this.tenantId, clientId: this.clientId });
  }

  /**
   * Exchanges an authorization code and maps the response to a {@link MicrosoftOAuthAccessToken}.
   *
   * @param input - The code, the exact redirect URI it was issued for, and the PKCE verifier.
   * @returns The exchanged access token.
   */
  async exchangeAuthorizationCodeToAccessToken(input: MicrosoftOAuthExchangeAuthorizationCodeInput): Promise<MicrosoftOAuthAccessToken> {
    const response = await this.exchangeAuthorizationCode(input);
    return microsoftOAuthAccessTokenFromTokenResponse(response);
  }

  /**
   * Refreshes an access token and maps the response to a {@link MicrosoftOAuthAccessToken}. Its `scopes`
   * are every scope the user has consented to for the resource.
   *
   * @param input - The stored refresh token.
   * @returns The refreshed access token, carrying the rotated refresh token.
   */
  async refreshToAccessToken(input: MicrosoftOAuthRefreshTokenInput): Promise<MicrosoftOAuthAccessToken> {
    const response = await this.refreshAccessToken(input);
    return microsoftOAuthAccessTokenFromTokenResponse(response);
  }
}
