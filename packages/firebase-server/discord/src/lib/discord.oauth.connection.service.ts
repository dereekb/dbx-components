import { Inject, Injectable } from '@nestjs/common';
import { DISCORD_OAUTH_SCOPE_DELIMITER, type DiscordAccessToken, type DiscordOAuthAuthorizeUrlFactory, type DiscordOAuthCurrentUser } from '@dereekb/discord';
import { DiscordOAuthApi } from '@dereekb/discord/nestjs';
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
    @Inject(DiscordOAuthApi) readonly oauthApi: DiscordOAuthApi
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

  protected authorizeUrlForState(state: UserExternalConnectionOAuthState): WebsiteUrl {
    return this.authorizeUrlFactory({ state });
  }

  protected async credentialsForAuthorizationCode(input: UserExternalConnectionOAuthExchangeInput): Promise<UserExternalConnectionCredentials> {
    const accessToken = await this.oauthApi.exchangeAuthorizationCodeToAccessToken({ code: input.code, redirectUri: input.redirectUri });

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
}
