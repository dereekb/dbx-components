import { Logger } from '@nestjs/common';
import { type Request } from 'express';
import { type FirebaseAuthUserId, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { cachedGetter, type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type UserExternalConnectionCredentials } from '../userexternalconnection.private';
import { type UserExternalConnectionAccessor } from '../userexternalconnection.accessor.server';
import { type UserExternalConnectionServerActions } from '../userexternalconnection.action.server';
import { type UserExternalConnectionStateCoder } from './userexternalconnection.oauth.state';
import { type UserExternalConnectionOAuthProviderError, userExternalConnectionErrorCodeForOAuthProviderError } from './userexternalconnection.oauth.error';
import { type UserExternalConnectionOAuthServiceConfig } from './userexternalconnection.oauth.config';

/**
 * The `state` value carried through the authorization-code handoff.
 *
 * Opaque to the provider: only {@link UserExternalConnectionStateCoder} can interpret it.
 */
export type UserExternalConnectionOAuthState = string;

/**
 * Identifies who a handoff belongs to, as resolved from a verified `state`.
 */
export interface UserExternalConnectionOAuthActor {
  readonly uid: FirebaseAuthUserId;
}

/**
 * The raw callback query, as the provider sent it.
 *
 * Kept open rather than narrowed to the four RFC 6749 parameters, because providers send more than
 * those and some of the extras are load-bearing: Zoho's `accounts-server` names the datacenter that
 * issued the code, and an exchange sent to the wrong one fails. Nest's keyless `@Query()` already
 * receives every parameter — only the typed view was dropping them.
 *
 * Declared here rather than beside the controller's typed view so the service does not have to
 * import from the controller that imports it.
 */
export type UserExternalConnectionOAuthCallbackQueryValues = Record<string, Maybe<string>>;

export interface UserExternalConnectionOAuthExchangeInput {
  /**
   * The authorization code the provider issued.
   */
  readonly code: string;
  /**
   * The redirect URI the code was issued against. Sent on the exchange because providers require it
   * to match the one used on the authorize request.
   */
  readonly redirectUri: WebsiteUrl;
  /**
   * The raw callback query, for a provider whose exchange needs a parameter beyond `code`.
   *
   * Optional, and most providers ignore it. Anything read from here arrived on a redirect the user's
   * browser followed, so treat it as untrusted input — in particular, never use a value from here as
   * a request target without checking it against an allowlist first.
   */
  readonly query?: Maybe<UserExternalConnectionOAuthCallbackQueryValues>;
}

export interface UserExternalConnectionOAuthHandleCallbackInput {
  /**
   * The authorization code, present when the provider approved the request.
   */
  readonly code?: Maybe<string>;
  /**
   * The state echoed back, identifying who is connecting.
   */
  readonly state?: Maybe<UserExternalConnectionOAuthState>;
  /**
   * The OAuth error code, present when the provider refused instead of issuing a code.
   */
  readonly error?: Maybe<string>;
  /**
   * The provider's explanation of the refusal.
   */
  readonly errorDescription?: Maybe<string>;
  /**
   * The raw callback query, passed through to the exchange unchanged.
   */
  readonly query?: Maybe<UserExternalConnectionOAuthCallbackQueryValues>;
}

/**
 * Input for {@link AbstractUserExternalConnectionOAuthService.credentialsRetainingStoredRefreshToken}.
 */
export interface UserExternalConnectionOAuthRetainRefreshTokenInput {
  readonly uid: FirebaseAuthUserId;
  /**
   * The credentials the exchange produced.
   */
  readonly credentials: UserExternalConnectionCredentials;
}

/**
 * Input for {@link AbstractUserExternalConnectionOAuthService.refreshCredentials}.
 *
 * Carries no `providerType` — the service already knows its own, and taking one would create a
 * parameter that could disagree with it.
 */
export interface UserExternalConnectionOAuthRefreshCredentialsInput {
  readonly uid: FirebaseAuthUserId;
  /**
   * The credentials currently stored for this provider, carrying the refresh token and any
   * provider-specific `extra` the exchange needs.
   */
  readonly credentials: UserExternalConnectionCredentials;
}

export interface UserExternalConnectionOAuthCallbackResult {
  readonly success: boolean;
  /**
   * The URL the user should be redirected to.
   */
  readonly redirectUrl: WebsiteUrl;
}

/**
 * Reads the `state` an authorize request should carry to the provider.
 *
 * A top-level browser navigation carries no credentials, so the state must have been minted by a
 * prior authenticated `read:authorizeState` call and arrive here as the `state` query parameter.
 *
 * @param request - The incoming authorize request.
 * @returns The state, when present.
 */
export function userExternalConnectionOAuthStateForRequest(request: Request): Maybe<UserExternalConnectionOAuthState> {
  const state = request.query['state'];
  return typeof state === 'string' && state.length > 0 ? state : undefined;
}

/**
 * Drives a provider's authorization-code handoff into a user's UserExternalConnection.
 *
 * Everything except the two abstract members is identical for every OAuth 2.0 provider: resolving
 * who is connecting from the signed `state`, surfacing a provider-side refusal, persisting the
 * credentials, recording the failure code, and choosing the redirect. A provider adapter extends
 * this and supplies only the OAuth mechanics its service actually differs on.
 *
 * Subclasses expose `config`, `stateCoder`, `userExternalConnectionActions`, and
 * `userExternalConnectionAccessor` as injected constructor properties.
 */
export abstract class AbstractUserExternalConnectionOAuthService {
  abstract readonly config: UserExternalConnectionOAuthServiceConfig;
  abstract readonly stateCoder: UserExternalConnectionStateCoder;
  abstract readonly userExternalConnectionActions: UserExternalConnectionServerActions;
  /**
   * The read half of the pair.
   *
   * Deliberately the accessor rather than `UserExternalConnectionReader`: the reader can refresh, and
   * it finds its refresh path through the registry these services are registered in — so depending on
   * it here would be a cycle. This service needs only the raw read.
   */
  abstract readonly userExternalConnectionAccessor: UserExternalConnectionAccessor;

  // lazy, because `providerType` reads a subclass constructor property that is not assigned yet
  // while this class's own fields initialize
  private readonly _logger = cachedGetter(() => new Logger(`UserExternalConnectionOAuthService(${this.providerType})`));

  protected get logger(): Logger {
    return this._logger();
  }

  get providerType(): UserExternalConnectionProviderType {
    return this.config.userExternalConnectionOAuth.providerType;
  }

  get redirectUri(): WebsiteUrl {
    return this.config.userExternalConnectionOAuth.redirectUri;
  }

  get successUrl(): WebsiteUrl {
    return this.config.userExternalConnectionOAuth.successUrl;
  }

  get failureUrl(): WebsiteUrl {
    const { failureUrl, successUrl } = this.config.userExternalConnectionOAuth;
    return failureUrl ?? successUrl;
  }

  /**
   * PROVIDER: builds the provider's consent-screen URL carrying the minted state.
   *
   * @param state - The signed state to echo back on the callback.
   * @returns The authorize URL to redirect the user's browser to.
   */
  protected abstract authorizeUrlForState(state: UserExternalConnectionOAuthState): WebsiteUrl;

  /**
   * PROVIDER: exchanges the authorization code and maps the token response to credentials.
   *
   * Both halves are the provider's own: token endpoints differ in body encoding and client
   * authentication, and only the provider knows how its response maps onto
   * {@link UserExternalConnectionCredentials}. When a provider rotates its refresh token, the
   * rotated one must be the one returned here — the token the exchange started with is spent.
   *
   * @param input - The authorization code, the redirect URI it was issued against, and the raw
   *   callback query.
   * @returns The credentials to persist.
   */
  protected abstract credentialsForAuthorizationCode(input: UserExternalConnectionOAuthExchangeInput): Promise<UserExternalConnectionCredentials>;

  /**
   * PROVIDER (optional): exchanges the stored refresh token for new credentials.
   *
   * Optional because not every provider has a refresh path worth wiring — and because a provider that
   * does not implement this stays correct rather than silently broken: `UserExternalConnectionReader`
   * treats its absence as "cannot renew" and makes the user reconnect.
   *
   * PUBLIC, unlike the two abstract members above, because the reader reaches it through the provider
   * registry rather than through a subclass.
   *
   * Implementations return what the provider issued and do NOT need to carry forward values the
   * response omitted — the reader merges every result over the stored credentials.
   *
   * @param input - The acting user and the credentials currently stored.
   * @returns The refreshed credentials.
   */
  refreshCredentials?(input: UserExternalConnectionOAuthRefreshCredentialsInput): Promise<UserExternalConnectionCredentials>;

  /**
   * Carries the stored refresh token forward when a provider's exchange returned none.
   *
   * The paired write replaces a provider's credentials wholesale, so persisting an exchange that
   * omitted `refresh_token` would DESTROY a working one while leaving the entry `connected` — a
   * connection that can never be refreshed again and does not look broken. Providers that do not
   * rotate their refresh token (Zoho, and others that issue one only on first consent) hit this on
   * every reconnect; a rotating provider never reaches the read.
   *
   * A read failure is deliberately allowed to propagate: failing the handoff loudly is strictly
   * better than clobbering the stored token.
   *
   * @param input - The acting user and the credentials the exchange produced.
   * @returns The credentials to persist, with a stored refresh token retained when the exchange
   *   returned none.
   */
  protected async credentialsRetainingStoredRefreshToken(input: UserExternalConnectionOAuthRetainRefreshTokenInput): Promise<UserExternalConnectionCredentials> {
    const { uid, credentials } = input;
    let result = credentials;

    if (!credentials.refreshToken) {
      const providerType = this.providerType;
      const previous = await this.userExternalConnectionAccessor.readUserExternalConnectionCredentials({ uid, providerType });

      if (previous?.refreshToken) {
        this.logger.log(`The "${providerType}" exchange returned no refresh token; retained the stored one.`);
        result = { ...credentials, refreshToken: previous.refreshToken };
      }
    }

    return result;
  }

  /**
   * Builds the authorize URL to redirect an incoming `/authorize` request to.
   *
   * @param request - The incoming authorize request, which the state is read from.
   * @returns The authorize URL, or null when the request carried no state.
   */
  authorizeUrlForRequest(request: Request): Maybe<WebsiteUrl> {
    const state = userExternalConnectionOAuthStateForRequest(request);
    let result: Maybe<WebsiteUrl>;

    if (state == null) {
      this.logger.warn('Rejected an authorize request with no resolvable state.');
    } else {
      result = this.authorizeUrlForState(state);
    }

    return result;
  }

  /**
   * Verifies the returned state, exchanges the authorization code, and persists the credentials.
   *
   * A refusal reported by the provider (`error` / `error_description`) is surfaced as the failure
   * reason, so a rejected scope or a denied consent is not misreported as a missing code.
   *
   * @param input - The query parameters the provider redirected back with.
   * @returns Where to redirect the user, and whether the handoff succeeded.
   */
  async handleCallback(input: UserExternalConnectionOAuthHandleCallbackInput): Promise<UserExternalConnectionOAuthCallbackResult> {
    const { code, state, error: errorCode, errorDescription, query } = input;
    const { providerType, redirectUri, successUrl } = this.config.userExternalConnectionOAuth;

    const providerError: Maybe<UserExternalConnectionOAuthProviderError> = errorCode ? { error: errorCode, errorDescription } : undefined;

    let actor: Maybe<UserExternalConnectionOAuthActor>;
    let success = false;

    try {
      actor = this.stateCoder.verifyState({ state, providerType });

      if (actor == null) {
        throw new Error(`The "${providerType}" OAuth callback state could not be verified.`);
      }

      // check what the provider reported BEFORE the missing-code check, otherwise a refusal is
      // reported as an absent code and the provider's actual reason is lost
      if (providerError != null) {
        const description = providerError.errorDescription ? ` — ${providerError.errorDescription}` : '';
        throw new Error(`"${providerType}" refused the authorization request: ${providerError.error}${description}`);
      }

      if (!code) {
        throw new Error(`The "${providerType}" OAuth callback did not include an authorization code.`);
      }

      const exchanged = await this.credentialsForAuthorizationCode({ code, redirectUri, query });
      const credentials = await this.credentialsRetainingStoredRefreshToken({ uid: actor.uid, credentials: exchanged });

      await this.userExternalConnectionActions.connectUserExternalConnection({ uid: actor.uid, providerType, credentials });
      this.logger.log(`Connected "${providerType}" for uid "${actor.uid}".`);
      success = true;
    } catch (e) {
      this.logger.error(`Failed completing the "${providerType}" OAuth handoff: `, e);

      if (actor != null) {
        await this.userExternalConnectionActions
          .markUserExternalConnectionError({
            uid: actor.uid,
            providerType,
            error: userExternalConnectionErrorCodeForOAuthProviderError(providerError)
          })
          .catch((markError: unknown) => {
            this.logger.error(`Failed marking the "${providerType}" connection error: `, markError);
          });
      }
    }

    return {
      success,
      redirectUrl: success ? successUrl : this.failureUrl
    };
  }
}
