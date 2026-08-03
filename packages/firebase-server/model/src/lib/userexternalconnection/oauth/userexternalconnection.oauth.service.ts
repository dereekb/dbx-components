import { Logger } from '@nestjs/common';
import { type Request } from 'express';
import { type FirebaseAuthUserId, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { cachedGetter, type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type UserExternalConnectionCredentials } from '../userexternalconnection.private';
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
 * Subclasses expose `config`, `stateCoder`, and `userExternalConnectionActions` as injected
 * constructor properties.
 */
export abstract class AbstractUserExternalConnectionOAuthService {
  abstract readonly config: UserExternalConnectionOAuthServiceConfig;
  abstract readonly stateCoder: UserExternalConnectionStateCoder;
  abstract readonly userExternalConnectionActions: UserExternalConnectionServerActions;

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
   * @param input - The authorization code and the redirect URI it was issued against.
   * @returns The credentials to persist.
   */
  protected abstract credentialsForAuthorizationCode(input: UserExternalConnectionOAuthExchangeInput): Promise<UserExternalConnectionCredentials>;

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
    const { code, state, error: errorCode, errorDescription } = input;
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

      const credentials = await this.credentialsForAuthorizationCode({ code, redirectUri });

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
