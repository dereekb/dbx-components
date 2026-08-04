import { Inject, Injectable } from '@nestjs/common';
import { type DiscordAccessToken, type DiscordOAuth, type DiscordOAuthAuthorizeUrlFactory, type DiscordOAuthAuthorizeUrlFactoryConfig, type DiscordOAuthClientId, type DiscordOAuthContext, type DiscordOAuthExchangeAuthorizationCodeInput, type DiscordOAuthRefreshTokenInput, discordAccessTokenFromTokenResponse, discordOAuthAuthorizeUrlFactory, discordOAuthFactory, exchangeAuthorizationCode, readCurrentUser, refreshAccessToken } from '@dereekb/discord';
import { DiscordOAuthServiceConfig } from './oauth.config';

/**
 * Provides the app's configured Discord OAuth client.
 *
 * Deliberately thinner than `CalcomOAuthApi`, which owns an access-token cache service and memoizes a
 * token factory per user. Discord needs neither: the external-connection framework persists each
 * user's credentials itself, so this api holds one client authenticated with the *application's*
 * credentials and hands out the three calls that run through it.
 *
 * Note this is not the bot. The app acting as itself against Discord goes through `DiscordApi` and
 * discord.js with a bot token; that token never reaches this client.
 */
@Injectable()
export class DiscordOAuthApi {
  readonly discordOAuth: DiscordOAuth;

  get oauthContext(): DiscordOAuthContext {
    return this.discordOAuth.oauthContext;
  }

  /**
   * The OAuth client id the api authorizes as. Read from the context so there is a single source.
   *
   * @returns The configured Discord OAuth client id.
   */
  get clientId(): DiscordOAuthClientId {
    return this.oauthContext.config.clientId;
  }

  constructor(@Inject(DiscordOAuthServiceConfig) readonly config: DiscordOAuthServiceConfig) {
    // asserted here rather than trusted: the config's credentials are optional to mirror the DISCORD_*
    // variables they are read from, while the core factory requires both
    const discordOAuthConfig = DiscordOAuthServiceConfig.assertedDiscordOAuthConfig(config);
    this.discordOAuth = discordOAuthFactory(config.factoryConfig ?? {})(discordOAuthConfig);
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
   * Configured pass-through for {@link readCurrentUser}.
   *
   * Bearer-authenticated with the user's own access token, unlike the two token-endpoint calls above,
   * which authenticate with the application's Basic credentials.
   *
   * @returns Function to read the Discord user an access token belongs to.
   */
  get readCurrentUser() {
    return readCurrentUser(this.oauthContext);
  }

  /**
   * Builds a {@link DiscordOAuthAuthorizeUrlFactory} for the app's client id.
   *
   * The redirect URI and scopes stay the caller's, since they are properties of the flow being
   * mounted rather than of the client, but the client id comes from this api so a caller never has to
   * read it out of the config itself.
   *
   * @param config - The redirect URI, requested scopes, and optional authorize URL override.
   * @returns A factory composing the authorize URL to redirect a user's browser to.
   */
  authorizeUrlFactory(config: Omit<DiscordOAuthAuthorizeUrlFactoryConfig, 'clientId'>): DiscordOAuthAuthorizeUrlFactory {
    return discordOAuthAuthorizeUrlFactory({ ...config, clientId: this.clientId });
  }

  /**
   * Exchanges an OAuth authorization code and maps the response to a {@link DiscordAccessToken}.
   *
   * @param input - The authorization code and the exact redirect URI it was issued for.
   * @returns The exchanged access token.
   */
  async exchangeAuthorizationCodeToAccessToken(input: DiscordOAuthExchangeAuthorizationCodeInput): Promise<DiscordAccessToken> {
    const response = await this.exchangeAuthorizationCode(input);
    return discordAccessTokenFromTokenResponse(response);
  }

  /**
   * Refreshes an access token and maps the response to a {@link DiscordAccessToken}.
   *
   * The returned `refreshToken` is the one to persist: Discord's refresh responses carry a refresh
   * token of their own, so storing whatever came back is correct whether or not it rotated.
   *
   * @param input - The stored refresh token.
   * @returns The refreshed access token.
   */
  async refreshToAccessToken(input: DiscordOAuthRefreshTokenInput): Promise<DiscordAccessToken> {
    const response = await this.refreshAccessToken(input);
    return discordAccessTokenFromTokenResponse(response);
  }
}
