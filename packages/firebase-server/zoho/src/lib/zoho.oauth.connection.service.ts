import { Inject, Injectable } from '@nestjs/common';
import {
  ZOHO_ACCOUNTS_API_URLS,
  zohoAccountsApiUrlKeyForApiUrl,
  zohoAccountsAuthorizeUrlFactory,
  zohoAccountsConfigApiUrl,
  zohoOAuthScopesFromScopeString,
  type ZohoAccountsApiUrl,
  type ZohoAccountsAuthorizeUrlFactory,
  type ZohoAccountsRefreshTokenFromAuthorizationCodeResponse,
  type ZohoAccountsUserInfoResponse
} from '@dereekb/zoho';
import { ZohoAccountsOAuthApi } from '@dereekb/zoho/nestjs';
import {
  AbstractUserExternalConnectionOAuthService,
  UserExternalConnectionAccessor,
  UserExternalConnectionServerActions,
  UserExternalConnectionStateCoder,
  type UserExternalConnectionCredentials,
  type UserExternalConnectionOAuthCallbackQueryValues,
  type UserExternalConnectionOAuthExchangeInput,
  type UserExternalConnectionOAuthRefreshCredentialsInput,
  type UserExternalConnectionOAuthState
} from '@dereekb/firebase-server/model';
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

/**
 * `extra` key holding the api domain a Zoho access token is usable against.
 *
 * Named constants because these keys are written on connect and read back on refresh — a literal in
 * one place and a typo in the other would silently send the refresh to the wrong datacenter.
 */
export const ZOHO_EXTRA_API_DOMAIN_KEY = 'apiDomain';

/**
 * `extra` key holding the accounts host a later refresh must be sent to.
 */
export const ZOHO_EXTRA_ACCOUNTS_SERVER_KEY = 'accountsServer';

/**
 * `extra` key holding Zoho's short location code for the datacenter.
 */
export const ZOHO_EXTRA_LOCATION_KEY = 'location';

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
      [ZOHO_EXTRA_API_DOMAIN_KEY]: api_domain,
      [ZOHO_EXTRA_ACCOUNTS_SERVER_KEY]: accountsApiUrl,
      [ZOHO_EXTRA_LOCATION_KEY]: location
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
    @Inject(UserExternalConnectionAccessor) readonly userExternalConnectionAccessor: UserExternalConnectionAccessor,
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

  override async refreshCredentials(input: UserExternalConnectionOAuthRefreshCredentialsInput): Promise<UserExternalConnectionCredentials> {
    const { credentials } = input;
    const { refreshToken, extra } = credentials;

    if (!refreshToken) {
      throw new Error('ZohoUserExternalConnectionOAuthService.refreshCredentials: the stored credentials carry no refresh token.');
    }

    // the grant lives at ONE datacenter — a refresh token issued by `accounts.zoho.eu` is not honored
    // by `accounts.zoho.com` — so the stored accounts server is what the refresh must be sent to. It is
    // re-resolved through the allowlist rather than used verbatim: the value originally arrived on a
    // browser redirect, and it is the POST target the client secret travels to.
    const storedAccountsServer = extra?.[ZOHO_EXTRA_ACCOUNTS_SERVER_KEY];
    const accountsApiUrl = this.allowlistedAccountsApiUrl(storedAccountsServer == null ? undefined : String(storedAccountsServer)) ?? this.accountsApiUrl;

    const response = await this.oauthApi.refreshUserAccessToken({ refreshToken, accountsApiUrl });

    // `location` is carried forward from the stored credentials rather than re-derived: it only ever
    // arrives on the callback, and the framework's merge would otherwise see an undefined value.
    const location = extra?.[ZOHO_EXTRA_LOCATION_KEY];

    // the response has no `refresh_token`, which the framework's merge retains — and `api_domain` may
    // legitimately differ from the one issued on connect, so it is taken from the response
    return zohoUserExternalConnectionCredentials({ response, accountsApiUrl, location: location == null ? undefined : String(location) });
  }

  /**
   * The accounts host to exchange against, taken from Zoho's `accounts-server` callback parameter.
   *
   * @param query - The raw callback query.
   * @returns The allowlisted accounts host the callback named, if any.
   */
  protected accountsApiUrlForCallbackQuery(query: Maybe<UserExternalConnectionOAuthCallbackQueryValues>): Maybe<ZohoAccountsApiUrl> {
    return this.allowlistedAccountsApiUrl(query?.[ZOHO_OAUTH_CALLBACK_ACCOUNTS_SERVER_PARAM]);
  }

  /**
   * Resolves an untrusted accounts-host string back to one of the canonical Zoho hosts.
   *
   * Only an allowlisted Zoho host is honored. Every value passed here originated on a redirect an
   * attacker can compose — either the live callback query or a value persisted from an earlier one —
   * and it becomes the POST target the CLIENT SECRET is sent to, so an unchecked value would hand out
   * the secret. Resolving through the allowlist rather than comparing to it also guarantees the host
   * used is a canonical constant and never a caller-shaped variant of one. An unrecognized value is
   * dropped (and logged) rather than trusted.
   *
   * @param accountsServer - The untrusted host string, if any.
   * @returns The allowlisted accounts host, or null when there was none or it was not recognized.
   */
  protected allowlistedAccountsApiUrl(accountsServer: Maybe<string>): Maybe<ZohoAccountsApiUrl> {
    let result: Maybe<ZohoAccountsApiUrl>;

    if (accountsServer) {
      const key = zohoAccountsApiUrlKeyForApiUrl(accountsServer);

      if (key == null) {
        this.logger.warn(`Ignored an unrecognized Zoho accounts host of "${accountsServer}"; using the configured host instead.`);
      } else {
        result = ZOHO_ACCOUNTS_API_URLS[key];
      }
    }

    return result;
  }
}
