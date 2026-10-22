import { Inject, Injectable, Optional } from '@nestjs/common';
import { TRELLO_OAUTH_REFRESH_TOKEN_EXPIRATION_MODE, TRELLO_OAUTH_SCOPE_DELIMITER, type TrelloOAuthAccessToken, type TrelloOAuthAuthorizeUrlFactory, type TrelloOAuthCurrentMember, type TrelloOAuthRefreshTokenExpirationMode } from '@dereekb/trello';
import { TrelloOAuthApi } from '@dereekb/trello/nestjs';
import {
  AbstractUserExternalConnectionOAuthService,
  UserExternalConnectionAccessor,
  UserExternalConnectionProviderPolicyRegistry,
  UserExternalConnectionServerActions,
  UserExternalConnectionSignInService,
  UserExternalConnectionSignInThrottle,
  UserExternalConnectionStateCoder,
  type UserExternalConnectionCredentials,
  type UserExternalConnectionOAuthAuthorizeUrlInput,
  type UserExternalConnectionOAuthExchangeInput,
  type UserExternalConnectionOAuthRefreshCredentialsInput
} from '@dereekb/firebase-server/model';
import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { TrelloUserExternalConnectionOAuthServiceConfig } from './trello.oauth.connection.config';

/**
 * The `extra` key holding the Trello member id the connection belongs to. Exported on a token mint.
 */
export const TRELLO_EXTRA_MEMBER_ID_KEY = 'memberId';

/**
 * The `extra` key holding the member's username at connect time. Exported on a token mint.
 *
 * Usernames are mutable: this is the value as of the last connect, never an identity.
 */
export const TRELLO_EXTRA_USERNAME_KEY = 'username';

/**
 * The `extra` key holding when the refresh token expires, as an ISO 8601 string. Server-side only —
 * never exported — and read by an expiry notice that tells the user to reconnect before it lapses.
 */
export const TRELLO_EXTRA_REFRESH_EXPIRES_AT_KEY = 'refreshExpiresAt';

export interface TrelloUserExternalConnectionCredentialsInput {
  readonly accessToken: TrelloOAuthAccessToken;
  /**
   * The member the token belongs to. Read on connect only, so absent on a refresh — the framework's
   * merge carries the connect-time label and ids forward.
   */
  readonly member?: Maybe<TrelloOAuthCurrentMember>;
  /**
   * Whether the token came from a refresh rather than the code exchange. Defaults to false.
   */
  readonly refreshed?: Maybe<boolean>;
  /**
   * How the refresh token's lifetime is counted. Defaults to `TRELLO_OAUTH_REFRESH_TOKEN_EXPIRATION_MODE`.
   *
   * `sliding` writes `refreshExpiresAt` on every exchange and refresh; `absolute` writes it on the
   * exchange only, so a refresh omits the key and the merge keeps the connect-time value.
   */
  readonly refreshTokenExpirationMode?: Maybe<TrelloOAuthRefreshTokenExpirationMode>;
}

/**
 * Maps an exchanged or refreshed Trello token, plus the member it belongs to, to the credentials
 * stored on the private connection document.
 *
 * The `refreshToken` written here is the ROTATED one the response carried: Trello's refresh tokens are
 * single-use, so the one sent is spent.
 *
 * @param input - The token, the member when one was read, and whether this was a refresh.
 * @returns The credentials to store.
 */
export function trelloUserExternalConnectionCredentials(input: TrelloUserExternalConnectionCredentialsInput): UserExternalConnectionCredentials {
  const { accessToken, member, refreshed } = input;
  const { accessToken: token, refreshToken, expiresAt, scope, refreshExpiresAt } = accessToken;
  const refreshTokenExpirationMode = input.refreshTokenExpirationMode ?? TRELLO_OAUTH_REFRESH_TOKEN_EXPIRATION_MODE;

  // split on the same delimiter the authorize request joins with, so the round trip stays symmetric
  const scopes = scope ? scope.split(TRELLO_OAUTH_SCOPE_DELIMITER).filter((x) => x.length > 0) : undefined;
  const writeRefreshExpiresAt = refreshExpiresAt != null && (!refreshed || refreshTokenExpirationMode === 'sliding');

  const extra: Record<string, string> = {};

  if (member) {
    extra[TRELLO_EXTRA_MEMBER_ID_KEY] = member.id;
    extra[TRELLO_EXTRA_USERNAME_KEY] = member.username;
  }

  if (writeRefreshExpiresAt) {
    extra[TRELLO_EXTRA_REFRESH_EXPIRES_AT_KEY] = (refreshExpiresAt as Date).toISOString();
  }

  return {
    accessToken: token,
    refreshToken,
    tokenType: 'Bearer',
    issuedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    scopes,
    // the 24-hex member id is stable; the username is not
    externalAccountId: member?.id,
    label: member ? member.fullName || member.username : undefined,
    extra: Object.keys(extra).length > 0 ? extra : undefined
  };
}

/**
 * Trello's half of the external-connection authorization-code handoff, through Trello's OAuth 2.0
 * (3LO) on Atlassian's authorization server.
 *
 * - `requirePkce`: Trello requires an S256 challenge on every code grant, so the framework re-mints each
 *   connect state with a sealed verifier.
 * - The identity read is MANDATORY on connect, unlike Discord's best-effort one: a `unique` connection
 *   needs the external account id, and the token mint exports `memberId`. `prompt=consent` means a
 *   retry re-issues tokens, so failing the handoff loses nothing.
 * - Refresh tokens are single-use and rotate; the reader's cross-instance refresh lease keeps two
 *   instances from spending one.
 * - There is NO `revokeCredentials`: Trello documents no OAuth 2.0 revoke endpoint, so a disconnect
 *   forgets the credentials (as with Zoho) and the access token lapses within its hour.
 */
@Injectable()
export class TrelloUserExternalConnectionOAuthService extends AbstractUserExternalConnectionOAuthService {
  override readonly requirePkce = true;
  /**
   * The member id and username go out with a minted token, so a client knows which account it acts as.
   * `refreshExpiresAt` stays on the server.
   */
  override readonly exportedCredentialExtraKeys: readonly string[] = [TRELLO_EXTRA_MEMBER_ID_KEY, TRELLO_EXTRA_USERNAME_KEY];

  readonly authorizeUrlFactory: TrelloOAuthAuthorizeUrlFactory;

  constructor(
    @Inject(TrelloUserExternalConnectionOAuthServiceConfig) readonly config: TrelloUserExternalConnectionOAuthServiceConfig,
    @Inject(UserExternalConnectionStateCoder) readonly stateCoder: UserExternalConnectionStateCoder,
    @Inject(UserExternalConnectionServerActions) readonly userExternalConnectionActions: UserExternalConnectionServerActions,
    @Inject(UserExternalConnectionAccessor) readonly userExternalConnectionAccessor: UserExternalConnectionAccessor,
    @Inject(TrelloOAuthApi) readonly oauthApi: TrelloOAuthApi,
    // optional: an app that only CONNECTS Trello registers none of these, and the sign-in routes then
    // refuse every request
    @Optional() @Inject(UserExternalConnectionSignInService) override readonly userExternalConnectionSignInService?: Maybe<UserExternalConnectionSignInService>,
    @Optional() @Inject(UserExternalConnectionProviderPolicyRegistry) override readonly userExternalConnectionProviderPolicyRegistry?: Maybe<UserExternalConnectionProviderPolicyRegistry>,
    @Optional() @Inject(UserExternalConnectionSignInThrottle) override readonly userExternalConnectionSignInThrottle?: Maybe<UserExternalConnectionSignInThrottle>
  ) {
    super();

    this.authorizeUrlFactory = oauthApi.authorizeUrlFactory({
      redirectUri: config.userExternalConnectionOAuth.redirectUri,
      scopes: config.scopes
    });
  }

  protected authorizeUrlForState(input: UserExternalConnectionOAuthAuthorizeUrlInput): WebsiteUrl {
    return this.authorizeUrlFactory({ state: input.state, codeChallenge: input.codeChallenge });
  }

  protected async credentialsForAuthorizationCode(input: UserExternalConnectionOAuthExchangeInput): Promise<UserExternalConnectionCredentials> {
    const { code, redirectUri, codeVerifier } = input;

    // with requirePkce every state reaching the provider carries a verifier, so its absence means a
    // state skipped the re-mint — Trello would refuse the exchange anyway
    if (!codeVerifier) {
      throw new Error(`The "${this.providerType}" exchange requires a PKCE code verifier, but the state carried none.`);
    }

    const accessToken = await this.oauthApi.exchangeAuthorizationCodeToAccessToken({ code, redirectUri, codeVerifier });
    const member = await this.oauthApi.readCurrentMember({ accessToken: accessToken.accessToken });

    return trelloUserExternalConnectionCredentials({ accessToken, member });
  }

  override async refreshCredentials(input: UserExternalConnectionOAuthRefreshCredentialsInput): Promise<UserExternalConnectionCredentials> {
    const { refreshToken } = input.credentials;

    if (!refreshToken) {
      throw new Error('TrelloUserExternalConnectionOAuthService.refreshCredentials: the stored credentials carry no refresh token.');
    }

    const accessToken = await this.oauthApi.refreshToAccessToken({ refreshToken });

    // deliberately no member read here: `/1/members/` is rate-limited to 100 requests per 900 seconds,
    // and the framework's merge carries the connect-time label and ids forward
    return trelloUserExternalConnectionCredentials({ accessToken, refreshed: true });
  }
}
