import { Inject, Injectable, Logger } from '@nestjs/common';
import { type Request } from 'express';
import { type CalcomAccessToken, type CalcomOAuthAuthorizeUrlFactory, calcomOAuthAuthorizeUrlFactory } from '@dereekb/calcom';
import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { CalcomOAuthApi } from '../oauth.api';
import { CalcomOAuthCallbackServiceConfig, DEFAULT_CALCOM_OAUTH_SCOPES } from './oauth.callback.config';

/**
 * The `state` value carried through the authorization-code handoff.
 *
 * Opaque to this package: only the app that mints it can interpret it.
 */
export type CalcomOAuthState = string;

/**
 * Identifies who a handoff belongs to, as resolved from a verified `state`.
 */
export interface CalcomOAuthCallbackActor {
  /**
   * The acting user, in whatever form the app identifies users by.
   */
  readonly uid: string;
}

export interface CalcomOAuthCallbackConnectedInput {
  readonly actor: CalcomOAuthCallbackActor;
  /**
   * The exchanged token, carrying the refresh token to persist.
   */
  readonly accessToken: CalcomAccessToken;
}

/**
 * An error Cal.com reported on the redirect back, rather than one thrown on our side.
 *
 * Per RFC 6749 4.1.2.1 the authorization server redirects to the `redirect_uri` with these instead
 * of a `code` when it refuses the request.
 */
export interface CalcomOAuthProviderError {
  /**
   * The OAuth error code, e.g. `invalid_request`, `invalid_scope`, `access_denied`.
   */
  readonly error: string;
  /**
   * The provider's human-readable explanation, when it sent one.
   */
  readonly errorDescription?: Maybe<string>;
}

export interface CalcomOAuthCallbackFailureInput {
  readonly actor?: Maybe<CalcomOAuthCallbackActor>;
  readonly error: unknown;
  /**
   * Set when the failure was reported BY Cal.com on the redirect, rather than thrown locally. Lets
   * an app record why the provider refused instead of a generic failure.
   */
  readonly providerError?: Maybe<CalcomOAuthProviderError>;
}

/**
 * The behavior an app supplies to the callback flow.
 *
 * The package owns the OAuth mechanics; the app owns identity (minting and verifying `state`) and
 * persistence, since only it knows how users and credentials are stored.
 */
export interface CalcomOAuthCallbackDelegate {
  /**
   * Resolves the `state` to send on the authorize redirect for an incoming `/authorize` request.
   *
   * A top-level browser navigation carries no credentials, so the state must be minted by a prior
   * authenticated call and arrive here as a signed value (by default the `state` query parameter).
   * Returning null aborts the handoff.
   */
  readonly authorizeStateForRequest?: Maybe<(request: Request) => Promise<Maybe<CalcomOAuthState>>>;
  /**
   * Verifies the `state` returned to `/callback` and resolves who it belongs to.
   *
   * This is the CSRF defense for the handoff and the only way the callback knows whose token it
   * just received. Returning null rejects the callback.
   */
  readonly verifyCallbackState: (state: Maybe<CalcomOAuthState>) => Promise<Maybe<CalcomOAuthCallbackActor>>;
  /**
   * Persists the exchanged token. Cal.com rotates the refresh token on every use, so the token on
   * the result must be stored, not the one the exchange was started with.
   */
  readonly onConnected: (input: CalcomOAuthCallbackConnectedInput) => Promise<void>;
  /**
   * Optional hook invoked when the handoff fails.
   */
  readonly onFailure?: Maybe<(input: CalcomOAuthCallbackFailureInput) => Promise<void>>;
}

export interface CalcomOAuthHandleCallbackInput {
  /**
   * The authorization code, present when Cal.com approved the request.
   */
  readonly code?: Maybe<string>;
  /**
   * The state echoed back, identifying who is connecting.
   */
  readonly state?: Maybe<CalcomOAuthState>;
  /**
   * The OAuth error code, present when Cal.com refused the request instead of issuing a code.
   */
  readonly error?: Maybe<string>;
  /**
   * Cal.com's explanation of the refusal.
   */
  readonly errorDescription?: Maybe<string>;
}

export interface CalcomOAuthCallbackResult {
  readonly success: boolean;
  /**
   * The URL the user should be redirected to.
   */
  readonly redirectUrl: WebsiteUrl;
}

/**
 * Default {@link CalcomOAuthCallbackDelegate.authorizeStateForRequest}: passes the `state` query
 * parameter through untouched.
 *
 * @param request - The incoming authorize request.
 * @returns The `state` query parameter, when present.
 */
export async function defaultCalcomOAuthAuthorizeStateForRequest(request: Request): Promise<Maybe<CalcomOAuthState>> {
  const state = request.query['state'];
  return typeof state === 'string' && state.length > 0 ? state : undefined;
}

/**
 * Service that drives the Cal.com authorization-code handoff.
 *
 * Configured by the app via {@link configure}, mirroring how `CalcomWebhookService.configure` lets
 * an app register its own event handling.
 */
@Injectable()
export class CalcomOAuthCallbackService {
  private readonly logger = new Logger('CalcomOAuthCallbackService');

  private _delegate: Maybe<CalcomOAuthCallbackDelegate>;

  readonly authorizeUrlFactory: CalcomOAuthAuthorizeUrlFactory;

  constructor(
    @Inject(CalcomOAuthCallbackServiceConfig) readonly config: CalcomOAuthCallbackServiceConfig,
    @Inject(CalcomOAuthApi) readonly oauthApi: CalcomOAuthApi
  ) {
    const { redirectUri, scopes } = config.calcomOAuthCallback;

    // read through the api rather than injecting CalcomOAuthServiceConfig directly, which the OAuth
    // module does not export to its dependents
    this.authorizeUrlFactory = calcomOAuthAuthorizeUrlFactory({
      clientId: oauthApi.config.calcomOAuth.clientId as string,
      redirectUri,
      scopes: scopes ?? DEFAULT_CALCOM_OAUTH_SCOPES
    });
  }

  /**
   * Registers the app's behavior for this flow.
   *
   * @param delegate - The app-supplied identity and persistence behavior.
   */
  configure(delegate: CalcomOAuthCallbackDelegate): void {
    this._delegate = delegate;
  }

  get delegate(): CalcomOAuthCallbackDelegate {
    const delegate = this._delegate;

    if (delegate == null) {
      throw new Error('CalcomOAuthCallbackService has not been configured. Call configure() with a CalcomOAuthCallbackDelegate.');
    }

    return delegate;
  }

  get failureUrl(): WebsiteUrl {
    const { failureUrl, successUrl } = this.config.calcomOAuthCallback;
    return failureUrl ?? successUrl;
  }

  /**
   * Builds the Cal.com authorize URL to redirect an incoming `/authorize` request to.
   *
   * @param request - The incoming authorize request.
   * @returns The authorize URL, or null when no state could be resolved.
   */
  async authorizeUrlForRequest(request: Request): Promise<Maybe<WebsiteUrl>> {
    const { authorizeStateForRequest } = this.delegate;
    const state = await (authorizeStateForRequest ?? defaultCalcomOAuthAuthorizeStateForRequest)(request);
    let result: Maybe<WebsiteUrl>;

    if (state == null) {
      this.logger.warn('Rejected a Cal.com authorize request with no resolvable state.');
    } else {
      result = this.authorizeUrlFactory({ state });
    }

    return result;
  }

  /**
   * Verifies the returned state, exchanges the authorization code, and hands the token to the app.
   *
   * A refusal reported by Cal.com (`error` / `error_description`) is surfaced as the failure reason,
   * so a rejected scope or a denied consent is not misreported as a missing code.
   *
   * @param input - The query parameters returned by Cal.com.
   * @returns Where to redirect the user, and whether the handoff succeeded.
   */
  async handleCallback(input: CalcomOAuthHandleCallbackInput): Promise<CalcomOAuthCallbackResult> {
    const { code, state, error: errorCode, errorDescription } = input;
    const { redirectUri, successUrl } = this.config.calcomOAuthCallback;
    const { verifyCallbackState, onConnected, onFailure } = this.delegate;

    const providerError: Maybe<CalcomOAuthProviderError> = errorCode ? { error: errorCode, errorDescription } : undefined;

    let actor: Maybe<CalcomOAuthCallbackActor>;
    let success = false;

    try {
      actor = await verifyCallbackState(state);

      if (actor == null) {
        throw new Error('Cal.com OAuth callback state could not be verified.');
      }

      // check what Cal.com reported BEFORE the missing-code check, otherwise a refusal is reported
      // as an absent code and the provider's actual reason is lost
      if (providerError != null) {
        const description = providerError.errorDescription ? ` — ${providerError.errorDescription}` : '';
        throw new Error(`Cal.com refused the authorization request: ${providerError.error}${description}`);
      }

      if (!code) {
        throw new Error('Cal.com OAuth callback did not include an authorization code.');
      }

      const accessToken = await this.oauthApi.exchangeAuthorizationCodeToAccessToken({ code, redirectUri });

      await onConnected({ actor, accessToken });
      success = true;
    } catch (e) {
      this.logger.error('Failed completing the Cal.com OAuth handoff: ', e);

      if (onFailure != null) {
        await onFailure({ actor, error: e, providerError }).catch((failureError: unknown) => {
          this.logger.error('Cal.com OAuth onFailure handler threw: ', failureError);
        });
      }
    }

    return {
      success,
      redirectUrl: success ? successUrl : this.failureUrl
    };
  }
}
