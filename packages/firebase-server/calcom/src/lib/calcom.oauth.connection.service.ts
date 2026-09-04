import { Inject, Injectable } from '@nestjs/common';
import { CALCOM_OAUTH_SCOPE_DELIMITER, type CalcomAccessToken, type CalcomOAuthAuthorizeUrlFactory, calcomAccessTokenFromTokenResponse, calcomOAuthAuthorizeUrlFactory, refreshAccessToken } from '@dereekb/calcom';
import { CalcomOAuthApi } from '@dereekb/calcom/nestjs';
import {
  AbstractUserExternalConnectionOAuthService,
  UserExternalConnectionAccessor,
  UserExternalConnectionServerActions,
  UserExternalConnectionStateCoder,
  type UserExternalConnectionCredentials,
  type UserExternalConnectionOAuthExchangeInput,
  type UserExternalConnectionOAuthRefreshCredentialsInput,
  type UserExternalConnectionOAuthState
} from '@dereekb/firebase-server/model';
import { type WebsiteUrl } from '@dereekb/util';
import { CalcomUserExternalConnectionOAuthServiceConfig } from './calcom.oauth.connection.config';

/**
 * Maps an exchanged Cal.com token to the credentials stored on the private connection document.
 *
 * The `refreshToken` written here is the rotated one from the exchange — Cal.com invalidates the
 * token each use, so persisting the one we sent would break the next refresh.
 *
 * @param accessToken - The exchanged Cal.com access token.
 * @returns The credentials to store.
 */
export function calcomUserExternalConnectionCredentials(accessToken: CalcomAccessToken): UserExternalConnectionCredentials {
  const { accessToken: token, refreshToken, expiresAt, scope } = accessToken;
  // split on the same delimiter the authorize request joins with, so the round trip stays symmetric
  const scopes = scope ? scope.split(CALCOM_OAUTH_SCOPE_DELIMITER).filter((x) => x.length > 0) : undefined;

  return {
    accessToken: token,
    refreshToken,
    tokenType: 'Bearer',
    issuedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    scopes
  };
}

/**
 * Cal.com's half of the external-connection authorization-code handoff.
 *
 * Everything else — resolving who is connecting, surfacing a refusal, persisting the credentials,
 * choosing the redirect — is the framework's.
 */
@Injectable()
export class CalcomUserExternalConnectionOAuthService extends AbstractUserExternalConnectionOAuthService {
  readonly authorizeUrlFactory: CalcomOAuthAuthorizeUrlFactory;

  constructor(
    @Inject(CalcomUserExternalConnectionOAuthServiceConfig) readonly config: CalcomUserExternalConnectionOAuthServiceConfig,
    @Inject(UserExternalConnectionStateCoder) readonly stateCoder: UserExternalConnectionStateCoder,
    @Inject(UserExternalConnectionServerActions) readonly userExternalConnectionActions: UserExternalConnectionServerActions,
    @Inject(UserExternalConnectionAccessor) readonly userExternalConnectionAccessor: UserExternalConnectionAccessor,
    @Inject(CalcomOAuthApi) readonly oauthApi: CalcomOAuthApi
  ) {
    super();

    const { scopes, userExternalConnectionOAuth } = config;
    // read through the api rather than injecting CalcomOAuthServiceConfig directly, which the OAuth
    // module does not export to its dependents
    const { clientId } = oauthApi.config.calcomOAuth;

    // CalcomOAuthServiceConfig accepts an api-key-only configuration, which has no client id — that
    // would otherwise compose an authorize URL carrying `client_id=undefined` and fail at the
    // consent screen rather than at startup
    if (!clientId) {
      throw new Error('CalcomUserExternalConnectionOAuthService requires a Cal.com OAuth clientId (CALCOM_CLIENT_ID). An api-key-only Cal.com configuration cannot run the per-user connect flow.');
    }

    this.authorizeUrlFactory = calcomOAuthAuthorizeUrlFactory({
      clientId,
      redirectUri: userExternalConnectionOAuth.redirectUri,
      scopes
    });
  }

  protected authorizeUrlForState(state: UserExternalConnectionOAuthState): WebsiteUrl {
    return this.authorizeUrlFactory({ state });
  }

  protected async credentialsForAuthorizationCode(input: UserExternalConnectionOAuthExchangeInput): Promise<UserExternalConnectionCredentials> {
    const accessToken = await this.oauthApi.exchangeAuthorizationCodeToAccessToken({ code: input.code, redirectUri: input.redirectUri });
    return calcomUserExternalConnectionCredentials(accessToken);
  }

  override async refreshCredentials(input: UserExternalConnectionOAuthRefreshCredentialsInput): Promise<UserExternalConnectionCredentials> {
    const { refreshToken } = input.credentials;

    if (!refreshToken) {
      throw new Error('CalcomUserExternalConnectionOAuthService.refreshCredentials: the stored credentials carry no refresh token.');
    }

    // the low-level exchange rather than `oauthApi.userAccessToken()`: that path layers an in-memory
    // tier and a token cache on top, and here the connection pair IS the cache. Going through it would
    // mean two stores deciding independently which token is current.
    const response = await refreshAccessToken(this.oauthApi.oauthContext)({ refreshToken });
    return calcomUserExternalConnectionCredentials(calcomAccessTokenFromTokenResponse(response));
  }
}
