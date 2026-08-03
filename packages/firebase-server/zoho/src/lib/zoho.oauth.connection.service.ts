import { Inject, Injectable } from '@nestjs/common';
import { ZOHO_ACCOUNTS_API_URLS, zohoAccountsApiUrlKeyForApiUrl, zohoAccountsAuthorizeUrlFactory, zohoAccountsConfigApiUrl, zohoOAuthScopesFromScopeString, type ZohoAccountsApiUrl, type ZohoAccountsAuthorizeUrlFactory, type ZohoAccountsRefreshTokenFromAuthorizationCodeResponse, type ZohoAccountsUserInfoResponse } from '@dereekb/zoho';
import { ZohoAccountsOAuthApi } from '@dereekb/zoho/nestjs';
import { AbstractUserExternalConnectionOAuthService, UserExternalConnectionServerActions, UserExternalConnectionStateCoder, type UserExternalConnectionCredentials, type UserExternalConnectionOAuthCallbackQueryValues, type UserExternalConnectionOAuthExchangeInput, type UserExternalConnectionOAuthState } from '@dereekb/firebase-server/model';
import { MS_IN_SECOND, type Maybe, type WebsiteUrl } from '@dereekb/util';
import { ZohoUserExternalConnectionOAuthServiceConfig } from './zoho.oauth.connection.config';

/**
 * The callback parameter naming the datacenter whose accounts server issued the code.
 */
export const ZOHO_OAUTH_CALLBACK_ACCOUNTS_SERVER_PARAM = 'accounts-server';

/**
 * The callback parameter naming the datacenter's short location code, e.g. `us`.
 */
export const ZOHO_OAUTH_CALLBACK_LOCATION_PARAM = 'location';

export interface ZohoUserExternalConnectionCredentialsInput {
  /**
   * The token response the exchange returned.
   */
  readonly response: ZohoAccountsRefreshTokenFromAuthorizationCodeResponse;
  /**
   * The accounts host the code was exchanged against.
   */
  readonly accountsApiUrl: ZohoAccountsApiUrl;
  /**
   * Zoho's short location code for that datacenter, when the callback carried one.
   */
  readonly location?: Maybe<string>;
  /**
   * The Zoho account the token belongs to, when one could be read.
   *
   * Optional because the identity call is best-effort: a connection is fully usable unlabeled.
   */
  readonly userInfo?: Maybe<ZohoAccountsUserInfoResponse>;
}

/**
 * Maps an exchanged Zoho token response to the credentials stored on the private connection document.
 *
 * Two things differ from Cal.com's mapper. Zoho does not rotate its refresh token, so there is
 * nothing to prefer over the token we already hold — and `refresh_token` can be ABSENT entirely on a
 * re-consent, which is why it is passed through as `Maybe` rather than asserted (the framework's
 * `credentialsRetainingStoredRefreshToken` is what keeps that from destroying a working token). And
 * `api_domain` / `accountsServer` / `location` are retained in `extra`: a Zoho access token is only
 * usable against the api domain it was issued for, and a later refresh must go back to the same
 * datacenter's accounts server, so dropping them would leave the stored credentials unusable.
 *
 * @param input - The token response, the host it came from, and the identity when one was read.
 * @returns The credentials to store.
 */
export function zohoUserExternalConnectionCredentials(input: ZohoUserExternalConnectionCredentialsInput): UserExternalConnectionCredentials {
  const { response, accountsApiUrl, location, userInfo } = input;
  const { access_token, refresh_token, expires_in, scope, api_domain } = response;

  const now = Date.now();
  const zuid = userInfo?.ZUID;

  return {
    accessToken: access_token,
    // Maybe on purpose — absent on a re-consent that did not force the consent screen
    refreshToken: refresh_token,
    tokenType: 'Bearer',
    issuedAt: new Date(now).toISOString(),
    expiresAt: expires_in == null ? undefined : new Date(now + expires_in * MS_IN_SECOND).toISOString(),
    scopes: zohoOAuthScopesFromScopeString(scope),
    externalAccountId: zuid == null ? undefined : String(zuid),
    label: userInfo?.Email ?? userInfo?.Display_Name ?? undefined,
    extra: {
      apiDomain: api_domain,
      accountsServer: accountsApiUrl,
      location
    }
  };
}

/**
 * Zoho's half of the external-connection authorization-code handoff.
 *
 * Everything else — resolving who is connecting, surfacing a refusal, retaining a refresh token the
 * exchange did not return, persisting the credentials, choosing the redirect — is the framework's.
 */
@Injectable()
export class ZohoUserExternalConnectionOAuthService extends AbstractUserExternalConnectionOAuthService {
  readonly authorizeUrlFactory: ZohoAccountsAuthorizeUrlFactory;

  /**
   * The accounts host this app authorizes against, and the fallback for an exchange whose callback
   * named no usable one.
   */
  readonly accountsApiUrl: ZohoAccountsApiUrl;

  constructor(
    @Inject(ZohoUserExternalConnectionOAuthServiceConfig) readonly config: ZohoUserExternalConnectionOAuthServiceConfig,
    @Inject(UserExternalConnectionStateCoder) readonly stateCoder: UserExternalConnectionStateCoder,
    @Inject(UserExternalConnectionServerActions) readonly userExternalConnectionActions: UserExternalConnectionServerActions,
    @Inject(ZohoAccountsOAuthApi) readonly oauthApi: ZohoAccountsOAuthApi
  ) {
    super();

    const { scopes, accountsApiUrl, userExternalConnectionOAuth } = config;

    // read through the api rather than injecting ZohoAccountsOAuthServiceConfig directly, which the
    // OAuth module does not export to its dependents
    this.accountsApiUrl = accountsApiUrl == null ? oauthApi.apiUrl : zohoAccountsConfigApiUrl(accountsApiUrl);

    this.authorizeUrlFactory = zohoAccountsAuthorizeUrlFactory({
      clientId: oauthApi.clientId,
      redirectUri: userExternalConnectionOAuth.redirectUri,
      scopes,
      accountsApiUrl: this.accountsApiUrl
    });
  }

  protected authorizeUrlForState(state: UserExternalConnectionOAuthState): WebsiteUrl {
    return this.authorizeUrlFactory({ state });
  }

  protected async credentialsForAuthorizationCode(input: UserExternalConnectionOAuthExchangeInput): Promise<UserExternalConnectionCredentials> {
    const { code, redirectUri, query } = input;
    const accountsApiUrl = this.accountsApiUrlForCallbackQuery(query) ?? this.accountsApiUrl;

    const response = await this.oauthApi.exchangeAuthorizationCode({ code, redirectUri, accountsApiUrl });

    // Best-effort: the connection is fully usable unlabeled, and Zoho re-issues a refresh token only
    // on a forced re-consent — so letting a label lookup abort a successful exchange would throw away
    // the token it just issued. Only the settings row's detail line is lost.
    let userInfo: Maybe<ZohoAccountsUserInfoResponse>;

    try {
      userInfo = await this.oauthApi.userInfo({ accessToken: response.access_token, accountsApiUrl });
    } catch (e) {
      this.logger.warn('Connected Zoho but could not read the identity to label the connection: ', e);
    }

    return zohoUserExternalConnectionCredentials({ response, accountsApiUrl, location: query?.[ZOHO_OAUTH_CALLBACK_LOCATION_PARAM], userInfo });
  }

  /**
   * The accounts host to exchange against, taken from Zoho's `accounts-server` callback parameter.
   *
   * Only an allowlisted Zoho host is honored. The value arrives on a redirect an attacker can
   * compose, and it is used as the POST target the CLIENT SECRET is sent to, so an unchecked value
   * here would hand out the secret. An unrecognized value is dropped (and logged) rather than
   * trusted.
   *
   * @param query - The raw callback query.
   * @returns The allowlisted accounts host the callback named, if any.
   */
  protected accountsApiUrlForCallbackQuery(query: Maybe<UserExternalConnectionOAuthCallbackQueryValues>): Maybe<ZohoAccountsApiUrl> {
    const accountsServer = query?.[ZOHO_OAUTH_CALLBACK_ACCOUNTS_SERVER_PARAM];
    let result: Maybe<ZohoAccountsApiUrl>;

    if (accountsServer) {
      // resolved back through the allowlist rather than used verbatim, so the exchanged host is
      // always one of the canonical constants and never a caller-shaped variant of one
      const key = zohoAccountsApiUrlKeyForApiUrl(accountsServer);

      if (key == null) {
        this.logger.warn(`Ignored an unrecognized Zoho "${ZOHO_OAUTH_CALLBACK_ACCOUNTS_SERVER_PARAM}" callback value of "${accountsServer}"; exchanging against the configured host instead.`);
      } else {
        result = ZOHO_ACCOUNTS_API_URLS[key];
      }
    }

    return result;
  }
}
