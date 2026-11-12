import { Inject, Injectable, Optional } from '@nestjs/common';
import { isMicrosoftOAuthInvalidGrantError, type MicrosoftOAuthAccessToken, type MicrosoftOAuthAuthorizeUrlFactory, type MicrosoftOAuthCurrentUser, normalizeMicrosoftGraphScopes } from '@dereekb/microsoft';
import { MicrosoftOAuthApi } from '@dereekb/microsoft/nestjs';
import { type UserExternalConnectionCapability } from '@dereekb/firebase';
import {
  AbstractUserExternalConnectionOAuthService,
  UserExternalConnectionAccessor,
  UserExternalConnectionProviderPolicyRegistry,
  UserExternalConnectionServerActions,
  UserExternalConnectionSignInService,
  UserExternalConnectionSignInThrottle,
  UserExternalConnectionStateCoder,
  userExternalConnectionCredentialsExpiredError,
  type UserExternalConnectionCredentials,
  type UserExternalConnectionOAuthAuthorizeUrlInput,
  type UserExternalConnectionOAuthExchangeInput,
  type UserExternalConnectionOAuthNarrowAccessTokenInput,
  type UserExternalConnectionOAuthNarrowedAccessToken,
  type UserExternalConnectionOAuthRefreshCredentialsInput
} from '@dereekb/firebase-server/model';
import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { decodeJwtClaims } from '@dereekb/util/oidc';
import { MicrosoftUserExternalConnectionOAuthServiceConfig } from './microsoft.oauth.connection.config';

/**
 * The `extra` key holding the Entra tenant id (`tid`) the connected account belongs to. Exported on a
 * token mint, so a client knows which tenant the token is for.
 */
export const MICROSOFT_EXTRA_TENANT_ID_KEY = 'tenantId';

/**
 * The identity read from a code exchange: the id token's claims, or the Graph `/me` fallback.
 */
export interface MicrosoftUserExternalConnectionIdentity {
  /**
   * The user's object id (`oid`) within the tenant. Stable; the external account id.
   */
  readonly oid: string;
  /**
   * The tenant id (`tid`).
   */
  readonly tid?: Maybe<string>;
  /**
   * The user principal name or mail, used as the connection label.
   */
  readonly username?: Maybe<string>;
}

/**
 * Reads the {@link MicrosoftUserExternalConnectionIdentity} out of an id token's claims.
 *
 * @param idToken - The id token from the code exchange.
 * @returns The identity, or undefined when the token is absent or carries no `oid`.
 */
export function microsoftUserExternalConnectionIdentityFromIdToken(idToken: Maybe<string>): Maybe<MicrosoftUserExternalConnectionIdentity> {
  const claims = decodeJwtClaims(idToken);
  const oid = claims?.['oid'];
  let result: Maybe<MicrosoftUserExternalConnectionIdentity>;

  if (typeof oid === 'string' && oid) {
    const tid = claims?.['tid'];
    const username = claims?.['preferred_username'] ?? claims?.['email'];
    result = { oid, tid: typeof tid === 'string' ? tid : undefined, username: typeof username === 'string' ? username : undefined };
  }

  return result;
}

export interface MicrosoftUserExternalConnectionCredentialsInput {
  readonly accessToken: MicrosoftOAuthAccessToken;
  /**
   * The identity the token belongs to. Read on connect only, so absent on a refresh — the framework's
   * merge carries the connect-time label, ids and `extra` forward.
   */
  readonly identity?: Maybe<MicrosoftUserExternalConnectionIdentity>;
}

/**
 * Maps an exchanged or refreshed Microsoft token to the credentials stored on the private connection
 * document. The `refreshToken` written is the ROTATED one the response carried.
 *
 * @param input - The token and, on connect, the identity.
 * @returns The credentials to store.
 */
export function microsoftUserExternalConnectionCredentials(input: MicrosoftUserExternalConnectionCredentialsInput): UserExternalConnectionCredentials {
  const { accessToken, identity } = input;
  const extra: Record<string, string> = {};

  if (identity?.tid) {
    extra[MICROSOFT_EXTRA_TENANT_ID_KEY] = identity.tid;
  }

  return {
    accessToken: accessToken.accessToken,
    refreshToken: accessToken.refreshToken ?? undefined,
    tokenType: 'Bearer',
    issuedAt: new Date().toISOString(),
    expiresAt: accessToken.expiresAt.toISOString(),
    scopes: accessToken.scopes,
    externalAccountId: identity?.oid,
    label: identity?.username ?? undefined,
    extra: Object.keys(extra).length > 0 ? extra : undefined
  };
}

/**
 * Microsoft's half of the external-connection authorization-code handoff, through a single-tenant
 * Entra ID app registration (identity platform v2).
 *
 * - `requirePkce`: every connect carries an S256 challenge.
 * - The connect's scope preset decides the requested Graph scopes; the stored `scopes` are what
 *   Microsoft actually granted, normalised.
 * - The identity comes from the id token (`oid`, `tid`, `preferred_username`), falling back to Graph
 *   `/me` when the token carries no `oid`.
 * - `refreshCredentials` returns the ROTATED refresh token, which the reader persists under its lease.
 * - `narrowAccessToken` redeems the stored refresh token for a token carrying a SUBSET of the granted
 *   scopes, and DISCARDS the rotated refresh token it returns: Microsoft does not revoke a redeemed
 *   refresh token, and persisting from the mint would race the reader's refresh lease.
 * - There is NO `revokeCredentials`: Entra has no per-grant revoke, so a disconnect forgets the stored
 *   credentials and the access token lapses within its hour.
 */
@Injectable()
export class MicrosoftUserExternalConnectionOAuthService extends AbstractUserExternalConnectionOAuthService {
  override readonly requirePkce = true;
  /**
   * The tenant id goes out with a minted token.
   */
  override readonly exportedCredentialExtraKeys: readonly string[] = [MICROSOFT_EXTRA_TENANT_ID_KEY];

  readonly authorizeUrlFactory: MicrosoftOAuthAuthorizeUrlFactory;

  constructor(
    @Inject(MicrosoftUserExternalConnectionOAuthServiceConfig) readonly config: MicrosoftUserExternalConnectionOAuthServiceConfig,
    @Inject(UserExternalConnectionStateCoder) readonly stateCoder: UserExternalConnectionStateCoder,
    @Inject(UserExternalConnectionServerActions) readonly userExternalConnectionActions: UserExternalConnectionServerActions,
    @Inject(UserExternalConnectionAccessor) readonly userExternalConnectionAccessor: UserExternalConnectionAccessor,
    @Inject(MicrosoftOAuthApi) readonly oauthApi: MicrosoftOAuthApi,
    @Optional() @Inject(UserExternalConnectionSignInService) override readonly userExternalConnectionSignInService?: Maybe<UserExternalConnectionSignInService>,
    @Optional() @Inject(UserExternalConnectionProviderPolicyRegistry) override readonly userExternalConnectionProviderPolicyRegistry?: Maybe<UserExternalConnectionProviderPolicyRegistry>,
    @Optional() @Inject(UserExternalConnectionSignInThrottle) override readonly userExternalConnectionSignInThrottle?: Maybe<UserExternalConnectionSignInThrottle>
  ) {
    super();
    this.authorizeUrlFactory = oauthApi.authorizeUrlFactory({ redirectUri: config.userExternalConnectionOAuth.redirectUri });
  }

  protected authorizeUrlForState(input: UserExternalConnectionOAuthAuthorizeUrlInput): WebsiteUrl {
    // the framework resolves the preset (requested, else the config default); with no presets at all the
    // request still carries User.Read so the identity fallback works
    const scopes = input.scopePreset?.scopes ?? ['User.Read'];
    return this.authorizeUrlFactory({ state: input.state, codeChallenge: input.codeChallenge, scopes });
  }

  protected async credentialsForAuthorizationCode(input: UserExternalConnectionOAuthExchangeInput): Promise<UserExternalConnectionCredentials> {
    const { code, redirectUri, codeVerifier } = input;

    if (!codeVerifier) {
      throw new Error(`The "${this.providerType}" exchange requires a PKCE code verifier, but the state carried none.`);
    }

    const accessToken = await this.oauthApi.exchangeAuthorizationCodeToAccessToken({ code, redirectUri, codeVerifier });
    let identity = microsoftUserExternalConnectionIdentityFromIdToken(accessToken.idToken);

    if (!identity) {
      const user: MicrosoftOAuthCurrentUser = await this.oauthApi.readCurrentUser({ accessToken: accessToken.accessToken });
      identity = { oid: user.id, tid: this.oauthApi.tenantId, username: user.userPrincipalName ?? user.mail };
    }

    return microsoftUserExternalConnectionCredentials({ accessToken, identity });
  }

  override async refreshCredentials(input: UserExternalConnectionOAuthRefreshCredentialsInput): Promise<UserExternalConnectionCredentials> {
    const accessToken = await this.oauthApi.refreshToAccessToken({ refreshToken: this._requireRefreshToken(input.credentials, 'refreshCredentials') });
    return microsoftUserExternalConnectionCredentials({ accessToken });
  }

  override normalizeScopes(scopes: readonly UserExternalConnectionCapability[]): UserExternalConnectionCapability[] {
    return normalizeMicrosoftGraphScopes(scopes);
  }

  override async narrowAccessToken(input: UserExternalConnectionOAuthNarrowAccessTokenInput): Promise<UserExternalConnectionOAuthNarrowedAccessToken> {
    const refreshToken = this._requireRefreshToken(input.credentials, 'narrowAccessToken');
    let accessToken: MicrosoftOAuthAccessToken;

    try {
      accessToken = await this.oauthApi.refreshToAccessToken({ refreshToken, scopes: input.scopes });
    } catch (e) {
      if (isMicrosoftOAuthInvalidGrantError(e)) {
        throw userExternalConnectionCredentialsExpiredError(this.providerType);
      }

      throw e;
    }

    // the rotated refresh token is deliberately dropped here; see the class doc
    return {
      accessToken: accessToken.accessToken,
      tokenType: 'Bearer',
      scopes: accessToken.scopes,
      expiresAt: accessToken.expiresAt.toISOString()
    };
  }

  private _requireRefreshToken(credentials: UserExternalConnectionCredentials, method: string): string {
    const { refreshToken } = credentials;

    if (!refreshToken) {
      throw new Error(`MicrosoftUserExternalConnectionOAuthService.${method}: the stored credentials carry no refresh token.`);
    }

    return refreshToken;
  }
}
