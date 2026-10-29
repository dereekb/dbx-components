import { Inject, Injectable } from '@nestjs/common';
import {
  type TrelloOAuth,
  type TrelloOAuthAccessToken,
  type TrelloOAuthAuthorizeUrlFactory,
  type TrelloOAuthAuthorizeUrlFactoryConfig,
  type TrelloOAuthClientId,
  type TrelloOAuthContext,
  type TrelloOAuthExchangeAuthorizationCodeInput,
  type TrelloOAuthRefreshTokenInput,
  exchangeAuthorizationCode,
  readCurrentMember,
  refreshAccessToken,
  trelloOAuthAccessTokenFromTokenResponse,
  trelloOAuthAuthorizeUrlFactory,
  trelloOAuthFactory
} from '@dereekb/trello';
import { TrelloOAuthServiceConfig } from './oauth.config';

/**
 * Provides the app's configured Trello OAuth 2.0 client.
 *
 * Holds one client authenticated with the APPLICATION's credentials and hands out the calls that run
 * through it. The external-connection framework persists each member's credentials itself, so there is
 * no token cache here.
 */
@Injectable()
export class TrelloOAuthApi {
  readonly trelloOAuth: TrelloOAuth;

  get oauthContext(): TrelloOAuthContext {
    return this.trelloOAuth.oauthContext;
  }

  /**
   * The OAuth client id the api authorizes as. Read from the context so there is a single source.
   *
   * @returns The configured Trello OAuth client id.
   */
  get clientId(): TrelloOAuthClientId {
    return this.oauthContext.config.clientId;
  }

  constructor(@Inject(TrelloOAuthServiceConfig) readonly config: TrelloOAuthServiceConfig) {
    const trelloOAuthConfig = TrelloOAuthServiceConfig.assertedTrelloOAuthConfig(config);
    this.trelloOAuth = trelloOAuthFactory(config.factoryConfig ?? {})(trelloOAuthConfig);
  }

  // MARK: Accessors
  /**
   * Configured pass-through for {@link exchangeAuthorizationCode}.
   *
   * @returns Function to exchange an OAuth authorization code for tokens.
   */
  get exchangeAuthorizationCode() {
    return exchangeAuthorizationCode(this.oauthContext);
  }

  /**
   * Configured pass-through for {@link refreshAccessToken}.
   *
   * @returns Function to refresh an access token using a stored refresh token.
   */
  get refreshAccessToken() {
    return refreshAccessToken(this.oauthContext);
  }

  /**
   * Configured pass-through for {@link readCurrentMember}.
   *
   * Bearer-authenticated with the member's own access token.
   *
   * @returns Function to read the Trello member an access token belongs to.
   */
  get readCurrentMember() {
    return readCurrentMember(this.oauthContext);
  }

  /**
   * Builds a {@link TrelloOAuthAuthorizeUrlFactory} for the app's client id.
   *
   * @param config - The redirect URI, requested scopes, and optional authorize URL / audience.
   * @returns A factory composing the authorize URL to redirect a member's browser to.
   */
  authorizeUrlFactory(config: Omit<TrelloOAuthAuthorizeUrlFactoryConfig, 'clientId'>): TrelloOAuthAuthorizeUrlFactory {
    return trelloOAuthAuthorizeUrlFactory({ ...config, clientId: this.clientId });
  }

  /**
   * Exchanges an OAuth authorization code and maps the response to a {@link TrelloOAuthAccessToken}.
   *
   * @param input - The authorization code, the exact redirect URI it was issued for, and the PKCE verifier.
   * @returns The exchanged access token.
   */
  async exchangeAuthorizationCodeToAccessToken(input: TrelloOAuthExchangeAuthorizationCodeInput): Promise<TrelloOAuthAccessToken> {
    const response = await this.exchangeAuthorizationCode(input);
    return trelloOAuthAccessTokenFromTokenResponse(response);
  }

  /**
   * Refreshes an access token and maps the response to a {@link TrelloOAuthAccessToken}.
   *
   * The returned `refreshToken` is the ROTATED one and must be persisted: the token sent is spent.
   *
   * @param input - The stored refresh token.
   * @returns The refreshed access token.
   */
  async refreshToAccessToken(input: TrelloOAuthRefreshTokenInput): Promise<TrelloOAuthAccessToken> {
    const response = await this.refreshAccessToken(input);
    return trelloOAuthAccessTokenFromTokenResponse(response);
  }
}
