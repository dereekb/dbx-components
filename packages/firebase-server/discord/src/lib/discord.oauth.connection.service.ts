import { Inject, Injectable, Optional } from '@nestjs/common';
import { DISCORD_OAUTH_SCOPE_DELIMITER, type DiscordAccessToken, type DiscordOAuthAuthorizeUrlFactory, type DiscordOAuthCurrentUser } from '@dereekb/discord';
import { DiscordOAuthApi } from '@dereekb/discord/nestjs';
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
  type UserExternalConnectionOAuthRefreshCredentialsInput,
  type UserExternalConnectionOAuthRevokeCredentialsInput,
  type UserExternalConnectionOAuthSignInIdentityInput,
  type UserExternalConnectionSignInIdentity
} from '@dereekb/firebase-server/model';
import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { DiscordUserExternalConnectionOAuthServiceConfig } from './discord.oauth.connection.config';

export interface DiscordUserExternalConnectionCredentialsInput {
  readonly accessToken: DiscordAccessToken;
  /**
   * The Discord account the token belongs to, when one could be read.
   *
   * Optional because the identity call is best-effort: a connection is fully usable unlabeled.
   */
  readonly currentUser?: Maybe<DiscordOAuthCurrentUser>;
}

/**
 * Maps an exchanged Discord token, plus the identity it belongs to, to the credentials stored on the
 * private connection document.
 *
 * The `refreshToken` written here is the one the exchange returned. Discord's refresh responses carry
 * a refresh token of their own, so persisting whatever came back is correct whether or not it rotated.
 *
 * @param input - The exchanged token and the resolved Discord user, when one could be read.
 * @returns The credentials to store.
 */
export function discordUserExternalConnectionCredentials(input: DiscordUserExternalConnectionCredentialsInput): UserExternalConnectionCredentials {
  const { accessToken, currentUser } = input;
  const { accessToken: token, refreshToken, expiresAt, scope } = accessToken;

  // split on the same delimiter the authorize request joins with, so the round trip stays symmetric
  const scopes = scope ? scope.split(DISCORD_OAUTH_SCOPE_DELIMITER).filter((x) => x.length > 0) : undefined;

  return {
    accessToken: token,
    refreshToken,
    tokenType: 'Bearer',
    issuedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    scopes,
    externalAccountId: currentUser?.id,
    // global_name is the user's chosen display name; username is the fallback for accounts that never
    // migrated off the legacy username#discriminator pair
    label: currentUser ? (currentUser.global_name ?? currentUser.username) : undefined
  };
}

/**
 * Discord's half of the external-connection authorization-code handoff.
 *
 * Everything else — resolving who is connecting, surfacing a refusal, persisting the credentials,
 * choosing the redirect — is the framework's.
 */
@Injectable()
export class DiscordUserExternalConnectionOAuthService extends AbstractUserExternalConnectionOAuthService {
  readonly authorizeUrlFactory: DiscordOAuthAuthorizeUrlFactory;

  constructor(
    @Inject(DiscordUserExternalConnectionOAuthServiceConfig) readonly config: DiscordUserExternalConnectionOAuthServiceConfig,
    @Inject(UserExternalConnectionStateCoder) readonly stateCoder: UserExternalConnectionStateCoder,
    @Inject(UserExternalConnectionServerActions) readonly userExternalConnectionActions: UserExternalConnectionServerActions,
    @Inject(UserExternalConnectionAccessor) readonly userExternalConnectionAccessor: UserExternalConnectionAccessor,
    @Inject(DiscordOAuthApi) readonly oauthApi: DiscordOAuthApi,
    // optional: an app that only CONNECTS Discord registers none of these, and the sign-in routes
    // then refuse every request
    @Optional() @Inject(UserExternalConnectionSignInService) override readonly userExternalConnectionSignInService?: Maybe<UserExternalConnectionSignInService>,
    @Optional() @Inject(UserExternalConnectionProviderPolicyRegistry) override readonly userExternalConnectionProviderPolicyRegistry?: Maybe<UserExternalConnectionProviderPolicyRegistry>,
    @Optional() @Inject(UserExternalConnectionSignInThrottle) override readonly userExternalConnectionSignInThrottle?: Maybe<UserExternalConnectionSignInThrottle>
  ) {
    super();

    const { scopes, userExternalConnectionOAuth } = config;

    // no clientId guard here, unlike the Cal.com equivalent: DiscordOAuthConfig requires both
    // credentials, so DiscordOAuthApi cannot construct without a client id to authorize as
    this.authorizeUrlFactory = oauthApi.authorizeUrlFactory({
      redirectUri: userExternalConnectionOAuth.redirectUri,
      scopes
    });
  }

  protected authorizeUrlForState(input: UserExternalConnectionOAuthAuthorizeUrlInput): WebsiteUrl {
    return this.authorizeUrlFactory({ state: input.state, codeChallenge: input.codeChallenge });
  }

  protected async credentialsForAuthorizationCode(input: UserExternalConnectionOAuthExchangeInput): Promise<UserExternalConnectionCredentials> {
    const accessToken = await this.oauthApi.exchangeAuthorizationCodeToAccessToken({ code: input.code, redirectUri: input.redirectUri, codeVerifier: input.codeVerifier });

    // Best-effort: the connection is fully usable unlabeled, so a failure to read the identity must
    // not fail the handoff. Only the settings row's detail line is lost.
    let currentUser: Maybe<DiscordOAuthCurrentUser>;

    try {
      currentUser = await this.oauthApi.readCurrentUser({ accessToken: accessToken.accessToken });
    } catch (e) {
      this.logger.warn('Connected Discord but could not read the identity to label the connection: ', e);
    }

    return discordUserExternalConnectionCredentials({ accessToken, currentUser });
  }

  /**
   * Reads the Discord account a sign-in is attributed to.
   *
   * MANDATORY, unlike the best-effort read in the exchange above: a sign-in with no snowflake has
   * nothing to key the account on. `email`/`verified` come from the same call and are only populated
   * when the `email` scope was granted — an app whose sign-in delegate provisions users by email must
   * request it.
   *
   * @param input - The credentials the exchange produced.
   * @returns The Discord identity to sign in as.
   */
  protected override async signInIdentityForCredentials(input: UserExternalConnectionOAuthSignInIdentityInput): Promise<UserExternalConnectionSignInIdentity> {
    const currentUser = await this.oauthApi.readCurrentUser({ accessToken: input.credentials.accessToken });

    return {
      // the snowflake, never the username — Discord usernames became mutable in 2023
      externalAccountId: currentUser.id,
      email: currentUser.email,
      emailVerified: currentUser.verified ?? false,
      label: currentUser.global_name ?? currentUser.username
    };
  }

  override async refreshCredentials(input: UserExternalConnectionOAuthRefreshCredentialsInput): Promise<UserExternalConnectionCredentials> {
    const { refreshToken } = input.credentials;

    if (!refreshToken) {
      throw new Error('DiscordUserExternalConnectionOAuthService.refreshCredentials: the stored credentials carry no refresh token.');
    }

    const accessToken = await this.oauthApi.refreshToAccessToken({ refreshToken });

    // deliberately no identity lookup here, unlike the code exchange: the label was resolved on connect
    // and the framework's merge carries it forward, so spending a request to re-read an unchanged
    // display name on every refresh would buy nothing.
    return discordUserExternalConnectionCredentials({ accessToken });
  }

  /**
   * Revokes the Discord grant so a captured token cannot outlive the disconnect.
   *
   * The refresh token is revoked when there is one: Discord invalidates the whole grant, so revoking
   * the longer-lived credential covers the access token issued from it. A failure is logged rather
   * than thrown — the disconnect has already decided to forget these credentials, and failing it
   * would leave the user connected to an account they asked to leave.
   *
   * @param input - The acting user and the credentials being discarded.
   */
  override async revokeCredentials(input: UserExternalConnectionOAuthRevokeCredentialsInput): Promise<void> {
    const { refreshToken, accessToken } = input.credentials;
    const token = refreshToken ?? accessToken;

    try {
      await this.oauthApi.revokeToken({ token, tokenTypeHint: refreshToken ? 'refresh_token' : 'access_token' });
    } catch (e) {
      this.logger.warn('Disconnected Discord but could not revoke the token at Discord: ', e);
    }
  }
}
