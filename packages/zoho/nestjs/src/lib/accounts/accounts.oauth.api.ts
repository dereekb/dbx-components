import { Inject, Injectable } from '@nestjs/common';
import {
  type ZohoAccessTokenString,
  type ZohoAccountsAccessTokenResponse,
  type ZohoAccountsApiUrl,
  type ZohoAccountsConfigApiUrlInput,
  type ZohoAccountsOAuthClientContext,
  type ZohoAccountsOAuthClientFactory,
  type ZohoAccountsRefreshTokenFromAuthorizationCodeResponse,
  type ZohoAccountsUserInfoResponse,
  type ZohoAuthorizationCode,
  type ZohoOAuthClientId,
  type ZohoOAuthClientSecret,
  type ZohoRefreshToken,
  zohoAccountsConfigApiUrl,
  zohoAccountsOAuthClientFactory,
  zohoAccountsRefreshTokenFromAuthorizationCode,
  zohoAccountsUserAccessToken,
  zohoAccountsUserInfo
} from '@dereekb/zoho';
import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { ZohoAccountsOAuthServiceConfig } from './accounts.oauth.config';

export interface ZohoAccountsExchangeAuthorizationCodeInput {
  /**
   * The single-use authorization code obtained from the Zoho consent flow.
   */
  readonly code: ZohoAuthorizationCode;
  /**
   * The redirect URI the code was issued against. Must match the authorize request byte-for-byte.
   */
  readonly redirectUri: WebsiteUrl;
  /**
   * The accounts host to exchange against. Defaults to the configured datacenter.
   */
  readonly accountsApiUrl?: Maybe<ZohoAccountsConfigApiUrlInput>;
}

export interface ZohoAccountsUserInfoApiInput {
  /**
   * The access token to read the identity of.
   */
  readonly accessToken: ZohoAccessTokenString;
  /**
   * The accounts host to read from. Defaults to the configured datacenter.
   */
  readonly accountsApiUrl?: Maybe<ZohoAccountsConfigApiUrlInput>;
}

export interface ZohoAccountsRefreshUserAccessTokenInput {
  /**
   * The user's refresh token.
   */
  readonly refreshToken: ZohoRefreshToken;
  /**
   * The accounts host to refresh against. Defaults to the configured datacenter.
   *
   * Should be the datacenter the grant was created at — a refresh token issued by one datacenter is
   * not honored by another.
   */
  readonly accountsApiUrl?: Maybe<ZohoAccountsConfigApiUrlInput>;
}

/**
 * The Zoho Accounts endpoints a per-user connect flow needs: the authorization-code exchange, the
 * per-user token refresh, and the identity lookup that labels the connection.
 *
 * Deliberately separate from {@link ZohoAccountsApi}, which requires a server refresh token and a
 * token cache. A per-user handoff has neither — the handoff is how a refresh token is obtained.
 */
@Injectable()
export class ZohoAccountsOAuthApi {
  private readonly _clientFactory: ZohoAccountsOAuthClientFactory;

  /**
   * Per-host clients, memoized so a repeated datacenter reuses one client rather than rebuilding
   * its fetch stack per callback.
   */
  private readonly _clients = new Map<ZohoAccountsApiUrl, ZohoAccountsOAuthClientContext>();

  /**
   * The accounts host configured for this app.
   */
  readonly apiUrl: ZohoAccountsApiUrl;

  /**
   * The OAuth client id the authorize request is composed with.
   */
  readonly clientId: ZohoOAuthClientId;

  private readonly _clientSecret: ZohoOAuthClientSecret;

  constructor(@Inject(ZohoAccountsOAuthServiceConfig) readonly config: ZohoAccountsOAuthServiceConfig) {
    // asserted here rather than trusted, so a config assembled in code (not through the env factory,
    // which already asserts) cannot reach the consent screen with an undefined client id
    ZohoAccountsOAuthServiceConfig.assertValidConfig(config);

    const { apiUrl, clientId, clientSecret } = config.zohoAccountsOAuth;

    this.apiUrl = zohoAccountsConfigApiUrl(apiUrl ?? 'us');
    this.clientId = clientId as ZohoOAuthClientId;
    this._clientSecret = clientSecret as ZohoOAuthClientSecret;
    this._clientFactory = zohoAccountsOAuthClientFactory(config.factoryConfig ?? {});
  }

  /**
   * The client for the configured datacenter.
   */
  get oauthClientContext(): ZohoAccountsOAuthClientContext {
    return this.oauthClientContextForApiUrl(this.apiUrl);
  }

  /**
   * The client for a specific accounts host, memoized per host.
   *
   * Zoho echoes the issuing datacenter back as `accounts-server` on the callback, and a code issued
   * by one datacenter cannot be exchanged at another. Callers MUST have checked the host against
   * `isKnownZohoAccountsApiUrl` first — this method will happily build a client for any URL, and the
   * client secret travels to whatever host it is given.
   *
   * @param apiUrl - The datacenter key or full accounts URL to build a client for.
   * @returns The memoized client context for that host.
   */
  oauthClientContextForApiUrl(apiUrl: ZohoAccountsConfigApiUrlInput): ZohoAccountsOAuthClientContext {
    const resolvedApiUrl = zohoAccountsConfigApiUrl(apiUrl);
    let context = this._clients.get(resolvedApiUrl);

    if (context == null) {
      context = this._clientFactory({
        clientId: this.clientId,
        clientSecret: this._clientSecret,
        apiUrl: resolvedApiUrl
      }).oauthClientContext;

      this._clients.set(resolvedApiUrl, context);
    }

    return context;
  }

  // MARK: Accessors
  /**
   * Exchanges a single-use authorization code for tokens.
   *
   * @param input - The code, the redirect URI it was issued against, and the optional accounts host.
   * @returns The Zoho token response. `refresh_token` may be absent on a re-consent.
   */
  exchangeAuthorizationCode(input: ZohoAccountsExchangeAuthorizationCodeInput): Promise<ZohoAccountsRefreshTokenFromAuthorizationCodeResponse> {
    const { code, redirectUri, accountsApiUrl } = input;
    const context = this.oauthClientContextForApiUrl(accountsApiUrl ?? this.apiUrl);
    return zohoAccountsRefreshTokenFromAuthorizationCode(context)({ code, redirectUri });
  }

  /**
   * Exchanges a user's refresh token for a new access token.
   *
   * Zoho does not rotate refresh tokens, so the token passed in stays valid and the response carries
   * no replacement — the caller keeps the one it already has. The response DOES carry `api_domain`,
   * which is the host the new access token is usable against, so persist it.
   *
   * @param input - The user's refresh token and the optional accounts host.
   * @returns The Zoho access token response.
   */
  refreshUserAccessToken(input: ZohoAccountsRefreshUserAccessTokenInput): Promise<ZohoAccountsAccessTokenResponse> {
    const { refreshToken, accountsApiUrl } = input;
    const context = this.oauthClientContextForApiUrl(accountsApiUrl ?? this.apiUrl);
    return zohoAccountsUserAccessToken(context)({ refreshToken });
  }

  /**
   * Reads the Zoho identity an access token was issued to.
   *
   * @param input - The access token and the optional accounts host.
   * @returns The user info response.
   */
  userInfo(input: ZohoAccountsUserInfoApiInput): Promise<ZohoAccountsUserInfoResponse> {
    const { accessToken, accountsApiUrl } = input;
    const context = this.oauthClientContextForApiUrl(accountsApiUrl ?? this.apiUrl);
    return zohoAccountsUserInfo(context)({ accessToken });
  }
}
