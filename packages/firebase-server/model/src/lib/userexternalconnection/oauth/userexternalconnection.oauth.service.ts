import { Logger } from '@nestjs/common';
import { type Request } from 'express';
import { type FirebaseAuthUserId, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { cachedGetter, generatePkceMaterial, type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type UserExternalConnectionCredentials } from '../userexternalconnection.private';
import { type UserExternalConnectionAccessor } from '../userexternalconnection.accessor.service';
import { type UserExternalConnectionServerActions } from '../userexternalconnection.action.server';
import { type UserExternalConnectionSignInIdentity, type UserExternalConnectionSignInService } from '../userexternalconnection.signin';
import { type UserExternalConnectionProviderPolicyRegistry, userExternalConnectionPolicyForProviderType } from '../userexternalconnection.policy';
import { userExternalConnectionSignInIdentityUnavailableError, userExternalConnectionSignInNotEnabledError } from '../userexternalconnection.error';
import { type UserExternalConnectionSignInStateActor, type UserExternalConnectionStateActor, type UserExternalConnectionStateCoder, isUserExternalConnectionSignInStateActor } from './userexternalconnection.oauth.state';
import { type UserExternalConnectionOAuthProviderError, userExternalConnectionErrorCodeForOAuthProviderError } from './userexternalconnection.oauth.error';
import { type UserExternalConnectionOAuthServiceConfig, isAllowedUserExternalConnectionReturnPath } from './userexternalconnection.oauth.config';
import { memoryUserExternalConnectionSignInThrottle, type UserExternalConnectionSignInThrottle } from './userexternalconnection.oauth.throttle';

/**
 * The `state` value carried through the authorization-code handoff.
 *
 * Opaque to the provider: only {@link UserExternalConnectionStateCoder} can interpret it.
 */
export type UserExternalConnectionOAuthState = string;

/**
 * Identifies who (or what) a handoff belongs to, as resolved from a verified `state`.
 *
 * An alias of the state coder's own union rather than a second shape: the two would otherwise drift
 * the moment a mode carried a new field.
 */
export type UserExternalConnectionOAuthActor = UserExternalConnectionStateActor;

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
  /**
   * The PKCE code verifier whose challenge the authorize request carried, when it carried one.
   *
   * Present only for a sign-in, whose state is minted by this server and can therefore hold the
   * verifier. A connect state is minted by the authenticated `read:authorizeState` call, which sends
   * no challenge, so its exchange sends no verifier either.
   */
  readonly codeVerifier?: Maybe<string>;
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

/**
 * Input for {@link AbstractUserExternalConnectionOAuthService.revokeCredentials}.
 */
export interface UserExternalConnectionOAuthRevokeCredentialsInput {
  readonly uid: FirebaseAuthUserId;
  /**
   * The credentials being discarded.
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
 * Input for {@link AbstractUserExternalConnectionOAuthService.authorizeUrlForState}.
 */
export interface UserExternalConnectionOAuthAuthorizeUrlInput {
  readonly state: UserExternalConnectionOAuthState;
  /**
   * The PKCE code challenge to send to the provider, when the flow has one.
   *
   * Set for a sign-in, absent for a connect — see {@link UserExternalConnectionOAuthExchangeInput.codeVerifier}.
   */
  readonly codeChallenge?: Maybe<string>;
}

/**
 * Input for {@link AbstractUserExternalConnectionOAuthService.signInIdentityForCredentials}.
 */
export interface UserExternalConnectionOAuthSignInIdentityInput {
  readonly credentials: UserExternalConnectionCredentials;
}

/**
 * The values a `/signin` request carries.
 */
export interface UserExternalConnectionOAuthSignInRequestValues {
  /**
   * The browser's PKCE challenge, which the eventual ticket is bound to.
   */
  readonly challenge?: Maybe<string>;
  /**
   * Where in the app to return to. Validated against the config's allowlist before it is minted into
   * the state — an unvalidated one is an open redirect.
   */
  readonly returnPath?: Maybe<string>;
  /**
   * The caller's IP, for the throttle.
   */
  readonly clientIp?: Maybe<string>;
}

/**
 * Input for {@link AbstractUserExternalConnectionOAuthService.exchangeSignInTicket}.
 */
export interface UserExternalConnectionOAuthTicketExchangeInput {
  readonly ticket?: Maybe<string>;
  readonly verifier?: Maybe<string>;
  readonly clientIp?: Maybe<string>;
}

/**
 * The custom token a redeemed ticket yields.
 */
export interface UserExternalConnectionOAuthTicketExchangeResult {
  readonly customToken: string;
}

/**
 * Reads the `/signin` request's values.
 *
 * @param request - The incoming sign-in request.
 * @returns The challenge, return path, and client IP the request carried.
 */
/**
 * The query parameter the sign-in ticket is returned on.
 */
export const USER_EXTERNAL_CONNECTION_SIGN_IN_TICKET_PARAM = 'ticket';

export interface UserExternalConnectionSignInRedirectUrlInput {
  /**
   * The configured sign-in success URL.
   */
  readonly baseUrl: WebsiteUrl;
  /**
   * The allowlisted return path, when the request named one.
   */
  readonly returnPath?: Maybe<string>;
  readonly ticket: string;
}

/**
 * Builds the URL a completed sign-in redirects to.
 *
 * `returnPath` REPLACES the base URL's path rather than being appended to it, and has already been
 * checked against the app's allowlist by the time it gets here — so the origin is always the
 * configured one and this cannot become an open redirect.
 *
 * @param input - The base URL, the validated return path, and the ticket.
 * @returns The redirect URL carrying the ticket.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionSignInRedirectUrl(input: UserExternalConnectionSignInRedirectUrlInput): WebsiteUrl {
  const url = new URL(input.baseUrl);

  if (input.returnPath) {
    url.pathname = input.returnPath;
  }

  url.searchParams.set(USER_EXTERNAL_CONNECTION_SIGN_IN_TICKET_PARAM, input.ticket);
  return url.toString();
}

/**
 * Reads the values a `/signin` request carries.
 *
 * @param request - The incoming sign-in request.
 * @returns The challenge, return path, and client IP the request carried.
 */
export function userExternalConnectionOAuthSignInValuesForRequest(request: Request): UserExternalConnectionOAuthSignInRequestValues {
  const challenge = request.query['challenge'];
  const returnPath = request.query['returnPath'];

  return {
    challenge: typeof challenge === 'string' && challenge.length > 0 ? challenge : undefined,
    returnPath: typeof returnPath === 'string' && returnPath.length > 0 ? returnPath : undefined,
    clientIp: request.ip
  };
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
  /**
   * OPTIONAL: resolves a third-party identity to a Firebase uid and mints its custom token.
   *
   * Absent for an app that only ever CONNECTS providers — the sign-in routes then refuse every
   * request, which is the correct behavior for an app that never asked for them. A provider adapter
   * makes this available by taking it as an `@Optional()` injected constructor property.
   */
  readonly userExternalConnectionSignInService?: Maybe<UserExternalConnectionSignInService>;
  /**
   * OPTIONAL: the app's per-provider policies. A missing registry means every provider takes the
   * default policy, whose `signIn` is false.
   */
  readonly userExternalConnectionProviderPolicyRegistry?: Maybe<UserExternalConnectionProviderPolicyRegistry>;
  /**
   * OPTIONAL: the rate limiter applied to the unauthenticated sign-in routes.
   *
   * When an app provides none, {@link memoryUserExternalConnectionSignInThrottle} is installed
   * instead — an unthrottled account-creation endpoint is not an acceptable default, even though a
   * per-process limiter is a weaker guarantee than a shared one.
   */
  readonly userExternalConnectionSignInThrottle?: Maybe<UserExternalConnectionSignInThrottle>;

  // lazy, because `providerType` reads a subclass constructor property that is not assigned yet
  // while this class's own fields initialize
  private readonly _logger = cachedGetter(() => new Logger(`UserExternalConnectionOAuthService(${this.providerType})`));
  private readonly _fallbackSignInThrottle = cachedGetter(() => memoryUserExternalConnectionSignInThrottle());

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
   * @param input - The signed state to echo back on the callback, plus the PKCE challenge when the
   *   flow has one.
   * @returns The authorize URL to redirect the user's browser to.
   */
  protected abstract authorizeUrlForState(input: UserExternalConnectionOAuthAuthorizeUrlInput): WebsiteUrl;

  /**
   * PROVIDER (optional): reads the identity a SIGN-IN is attributed to.
   *
   * Optional because a connect needs no identity to succeed — an unlabeled connection is fully
   * usable, which is why `credentialsForAuthorizationCode` treats the identity read as best-effort.
   * A sign-in is the opposite: with no stable external id there is nothing to key the account on, so
   * the default below fails hard rather than falling back to a mutable username or an email.
   *
   * Override it on a provider whose identity carries more than the exchange already captured — an
   * email and its verified flag, which the account-linking rules depend on.
   *
   * @param input - The credentials the exchange produced.
   * @returns The identity to sign in as.
   */
  protected async signInIdentityForCredentials(input: UserExternalConnectionOAuthSignInIdentityInput): Promise<UserExternalConnectionSignInIdentity> {
    const externalAccountId = input.credentials.externalAccountId;

    if (!externalAccountId) {
      throw userExternalConnectionSignInIdentityUnavailableError(this.providerType);
    }

    return { externalAccountId, label: input.credentials.label };
  }

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
   * PROVIDER (optional): revokes the stored credentials at the provider.
   *
   * Deleting the stored credentials ends OUR ability to act as the user; it does not end the
   * provider's grant, so a token captured before the disconnect stays usable until it expires — which
   * for Discord is seven days. A provider implementing this closes that window.
   *
   * Optional and PUBLIC for the same reasons as `refreshCredentials`: not every provider exposes a
   * revocation endpoint, and the caller reaches it through the registry rather than through a
   * subclass. Implementations should not throw on an already-invalid token — a disconnect must
   * succeed regardless of what the provider says about a credential it is about to forget.
   *
   * @param input - The acting user and the credentials being discarded.
   */
  revokeCredentials?(input: UserExternalConnectionOAuthRevokeCredentialsInput): Promise<void>;

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
      const previous = await this.userExternalConnectionAccessor.accessorForUser({ uid })(providerType).readUserExternalConnectionCredentials();

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
      result = this.authorizeUrlForState({ state });
    }

    return result;
  }

  /**
   * The provider's resolved policy.
   *
   * @returns The policy, with every optional field defaulted.
   */
  get policy() {
    return userExternalConnectionPolicyForProviderType(this.userExternalConnectionProviderPolicyRegistry, this.providerType);
  }

  /**
   * Whether this provider may be used to sign in.
   *
   * Requires BOTH the app's policy opt-in and a registered sign-in service: a policy that says yes
   * with nothing able to resolve a uid would fail at the callback instead of at the front door.
   *
   * @returns True when a sign-in request for this provider may proceed.
   */
  get signInEnabled(): boolean {
    return this.policy.signIn && this.userExternalConnectionSignInService != null;
  }

  /**
   * Where a sign-in returns to on success, before the ticket is appended.
   *
   * @returns The configured sign-in success url, falling back to the connect success url.
   */
  get signInSuccessUrl(): WebsiteUrl {
    const { signInSuccessUrl, successUrl } = this.config.userExternalConnectionOAuth;
    return signInSuccessUrl ?? successUrl;
  }

  /**
   * Builds the authorize URL for an unauthenticated SIGN-IN request.
   *
   * Unlike the connect direction, the state is minted HERE: there is no prior authenticated call to
   * mint it, so the browser's PKCE challenge is what binds the flow instead of a uid. A provider PKCE
   * verifier is generated at the same time and sealed into the same state, which is the only reason
   * the exchange can answer a challenge without a server-side store.
   *
   * @param request - The incoming sign-in request.
   * @returns The authorize URL, or null when the request must be bounced to the failure URL.
   */
  async signInUrlForRequest(request: Request): Promise<Maybe<WebsiteUrl>> {
    const { challenge, returnPath, clientIp } = userExternalConnectionOAuthSignInValuesForRequest(request);
    const providerType = this.providerType;
    let result: Maybe<WebsiteUrl>;

    if (!this.signInEnabled) {
      this.logger.warn(`Rejected a sign-in request: "${providerType}" is not enabled for sign-in.`);
    } else if (!challenge) {
      this.logger.warn(`Rejected a sign-in request for "${providerType}" with no PKCE challenge.`);
    } else if (await this.throttleSignInAttempt(clientIp)) {
      this.logger.warn(`Throttled a sign-in request for "${providerType}".`);
    } else {
      // an unvalidated returnPath is an open redirect, so a rejected one is DROPPED rather than
      // failing the sign-in — the user still lands on the configured default
      const allowedReturnPath = isAllowedUserExternalConnectionReturnPath(this.config.userExternalConnectionOAuth, returnPath) ? returnPath : undefined;

      if (returnPath != null && allowedReturnPath == null) {
        this.logger.warn(`Ignored a "${providerType}" sign-in returnPath that is not on the allowlist.`);
      }

      const { codeVerifier, codeChallenge } = await generatePkceMaterial();
      const state = this.stateCoder.mintState({ mode: 'signin', providerType, challenge, returnPath: allowedReturnPath, codeVerifier });

      result = this.authorizeUrlForState({ state, codeChallenge });
    }

    return result;
  }

  /**
   * Redeems a sign-in ticket for the custom token it carries.
   *
   * The token is handed back on a POST rather than in the redirect's query string: a URL-borne
   * credential lands in browser history, the `Referer` header, and every proxy log on the way.
   *
   * @param input - The ticket and the verifier the browser retained.
   * @returns The custom token, or null when the ticket cannot be redeemed.
   */
  async exchangeSignInTicket(input: UserExternalConnectionOAuthTicketExchangeInput): Promise<Maybe<UserExternalConnectionOAuthTicketExchangeResult>> {
    let result: Maybe<UserExternalConnectionOAuthTicketExchangeResult>;

    if (!this.signInEnabled) {
      this.logger.warn(`Rejected a ticket exchange: "${this.providerType}" is not enabled for sign-in.`);
    } else if (await this.throttleSignInAttempt(input.clientIp)) {
      this.logger.warn(`Throttled a ticket exchange for "${this.providerType}".`);
    } else {
      const redeemed = await this.stateCoder.verifyTicket({ ticket: input.ticket, verifier: input.verifier });

      if (redeemed == null) {
        this.logger.warn(`Rejected an unredeemable "${this.providerType}" sign-in ticket.`);
      } else {
        this.logger.log(`Redeemed a "${this.providerType}" sign-in ticket for uid "${redeemed.uid}".`);
        result = { customToken: redeemed.customToken };
      }
    }

    return result;
  }

  /**
   * Records a sign-in attempt against the throttle and returns whether it should be rejected.
   *
   * @param clientIp - The caller's IP, when one could be resolved.
   * @returns True when the attempt is throttled.
   */
  protected throttleSignInAttempt(clientIp: Maybe<string>): Promise<boolean> {
    const throttle = this.userExternalConnectionSignInThrottle ?? this._fallbackSignInThrottle();
    return throttle.throttleSignInAttempt({ providerType: this.providerType, clientIp });
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
    let successUrlForActor: Maybe<WebsiteUrl>;

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

      const exchanged = await this.credentialsForAuthorizationCode({ code, redirectUri, query, codeVerifier: actor.codeVerifier });

      if (isUserExternalConnectionSignInStateActor(actor)) {
        successUrlForActor = await this.completeSignInCallback(actor, exchanged);
      } else {
        const credentials = await this.credentialsRetainingStoredRefreshToken({ uid: actor.uid, credentials: exchanged });

        await this.userExternalConnectionActions.connectUserExternalConnection({ uid: actor.uid, providerType, credentials });
        this.logger.log(`Connected "${providerType}" for uid "${actor.uid}".`);
        successUrlForActor = successUrl;
      }
    } catch (e) {
      this.logger.error(`Failed completing the "${providerType}" OAuth handoff: `, e);

      // a DENIED sign-in has no uid at all, and a connect whose state failed to verify has no actor —
      // there is nothing to mark in either case
      if (actor != null && !isUserExternalConnectionSignInStateActor(actor)) {
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
      success: successUrlForActor != null,
      redirectUrl: successUrlForActor ?? this.failureUrl
    };
  }

  /**
   * Completes the SIGN-IN half of a callback: identity, uid, connection, custom token, ticket.
   *
   * The connection is written with the same paired write a connect uses, so a user who signed in
   * through a provider is connected to it in exactly the same way — there is no second
   * representation of "this user's Discord account" to keep in sync.
   *
   * @param actor - The verified sign-in state.
   * @param exchanged - The credentials the code exchange produced.
   * @returns The success URL, carrying the sign-in ticket.
   */
  protected async completeSignInCallback(actor: UserExternalConnectionSignInStateActor, exchanged: UserExternalConnectionCredentials): Promise<WebsiteUrl> {
    const providerType = this.providerType;
    const signInService = this.userExternalConnectionSignInService;

    if (!this.policy.signIn || signInService == null) {
      throw userExternalConnectionSignInNotEnabledError(providerType);
    }

    // MANDATORY here, unlike on a connect: with no stable external id there is nothing to key the
    // account on, and the lookup that recognizes a returning user would never match
    const identity = await this.signInIdentityForCredentials({ credentials: exchanged });

    if (!identity.externalAccountId) {
      throw userExternalConnectionSignInIdentityUnavailableError(providerType);
    }

    const { uid, created } = await signInService.resolveSignIn({ providerType, identity });

    // force the credentials to describe the identity the sign-in resolved against, so the derived
    // `ec` key the NEXT sign-in looks up cannot disagree with the account that just signed in
    const identifiedCredentials: UserExternalConnectionCredentials = { ...exchanged, externalAccountId: identity.externalAccountId, label: exchanged.label ?? identity.label };
    const credentials = await this.credentialsRetainingStoredRefreshToken({ uid, credentials: identifiedCredentials });

    await this.userExternalConnectionActions.connectUserExternalConnection({ uid, providerType, credentials });

    const customToken = await signInService.mintCustomTokenForUser({ uid });
    const ticket = this.stateCoder.mintTicket({ customToken, challenge: actor.challenge, uid });

    this.logger.log(`Signed in "${providerType}" as uid "${uid}"${created ? ' (new user)' : ''}.`);
    return userExternalConnectionSignInRedirectUrl({ baseUrl: this.signInSuccessUrl, returnPath: actor.returnPath, ticket });
  }
}
