import { Body, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { type Maybe } from '@dereekb/util';
import { type AbstractUserExternalConnectionOAuthService, type UserExternalConnectionOAuthCallbackQueryValues, type UserExternalConnectionOAuthState } from './userexternalconnection.oauth.service';

/**
 * HTTP status used for the handoff redirects.
 *
 * A 302 keeps the redirect non-cacheable, which matters because each authorize URL carries a
 * single-use `state`.
 */
export const USER_EXTERNAL_CONNECTION_OAUTH_REDIRECT_STATUS = 302;

/**
 * Query parameters a provider sends to the redirect URI.
 *
 * Snake-cased because these are the wire names — `error_description` is what RFC 6749 4.1.2.1
 * specifies, so it is read as-is rather than renamed at the boundary.
 */
export interface UserExternalConnectionOAuthCallbackQuery extends UserExternalConnectionOAuthCallbackQueryValues {
  readonly code?: Maybe<string>;
  readonly state?: Maybe<UserExternalConnectionOAuthState>;
  readonly error?: Maybe<string>;
  readonly error_description?: Maybe<string>;
}

/**
 * Body of a sign-in ticket exchange.
 */
export interface UserExternalConnectionOAuthTicketExchangeBody {
  readonly ticket?: Maybe<string>;
  /**
   * The PKCE code verifier the browser retained in session storage.
   */
  readonly verifier?: Maybe<string>;
}

/**
 * Response of a successful sign-in ticket exchange.
 */
export interface UserExternalConnectionOAuthTicketExchangeResponse {
  /**
   * The Firebase custom token to pass to `signInWithCustomToken`.
   */
  readonly customToken: string;
}

/**
 * HTTP status returned when a sign-in ticket cannot be redeemed.
 *
 * A single status for every failure — expired, tampered with, wrong verifier, throttled — so the
 * endpoint is not an oracle telling an attacker which part of a forged ticket was wrong.
 */
export const USER_EXTERNAL_CONNECTION_OAUTH_TICKET_REJECTED_STATUS = 401;

/**
 * The two endpoints of an external-connection authorization-code handoff.
 *
 * A provider ships its own controller so it keeps full control of its route surface; extending this
 * means it declares only the mount point and its constructor:
 *
 * ```ts
 * @Controller(CALCOM_USER_EXTERNAL_CONNECTION_OAUTH_CONTROLLER_PATH)
 * export class CalcomUserExternalConnectionOAuthController extends AbstractUserExternalConnectionOAuthController {
 *   constructor(@Inject(CalcomUserExternalConnectionOAuthService) readonly oauthService: CalcomUserExternalConnectionOAuthService) {
 *     super();
 *   }
 * }
 * ```
 *
 * Mount at {@link userExternalConnectionOAuthControllerPath}, and exclude those routes from any
 * global API route prefix with {@link userExternalConnectionOAuthRoutesForGlobalRouteExclude} — the
 * redirect URI registered with a provider must match byte-for-byte, so a prefix silently breaks it.
 */
export abstract class AbstractUserExternalConnectionOAuthController {
  abstract readonly oauthService: AbstractUserExternalConnectionOAuthService;

  /**
   * Begins the handoff by redirecting the user's browser to the provider's consent screen.
   *
   * Carries the `state` resolved for the request; a request without one is bounced to the failure
   * URL rather than sent to the provider.
   *
   * @param request - The incoming authorize request, which the state is read from.
   * @param response - The response to issue the redirect on.
   */
  @Get('authorize')
  authorize(@Req() request: Request, @Res() response: Response): void {
    const authorizeUrl = this.oauthService.authorizeUrlForRequest(request);
    response.redirect(USER_EXTERNAL_CONNECTION_OAUTH_REDIRECT_STATUS, authorizeUrl ?? this.oauthService.failureUrl);
  }

  /**
   * Completes the handoff: verifies the returned `state`, exchanges the authorization code, and
   * redirects to the configured success or failure URL.
   *
   * On refusal a provider sends `error` / `error_description` in place of a `code` (RFC 6749
   * 4.1.2.1), so both are read and passed through — otherwise a rejected scope or a denied consent
   * is indistinguishable from a missing code.
   *
   * @param query - The callback query parameters: `code` + `state` on approval, or `error` +
   *   `error_description` on refusal. Passed through whole, so a provider adapter can read the
   *   extras its exchange needs.
   * @param response - The response to issue the redirect on.
   */
  @Get('callback')
  async callback(@Query() query: UserExternalConnectionOAuthCallbackQuery, @Res() response: Response): Promise<void> {
    const { redirectUrl } = await this.oauthService.handleCallback({
      code: query.code,
      state: query.state,
      error: query.error,
      errorDescription: query.error_description,
      query
    });

    response.redirect(USER_EXTERNAL_CONNECTION_OAUTH_REDIRECT_STATUS, redirectUrl);
  }

  /**
   * Begins a SIGN-IN handoff for an anonymous visitor.
   *
   * Unauthenticated by necessity: a user who is signing in has no credential to present yet. The
   * state is minted here rather than by a prior authenticated call, bound to the `challenge` the
   * browser supplies, and the whole route is refused unless the app's policy enabled sign-in for this
   * provider.
   *
   * @param request - The incoming sign-in request, carrying `challenge` and an optional `returnPath`.
   * @param response - The response to issue the redirect on.
   */
  @Get('signin')
  async signIn(@Req() request: Request, @Res() response: Response): Promise<void> {
    const signInUrl = await this.oauthService.signInUrlForRequest(request);
    response.redirect(USER_EXTERNAL_CONNECTION_OAUTH_REDIRECT_STATUS, signInUrl ?? this.oauthService.failureUrl);
  }

  /**
   * Redeems a sign-in ticket for the Firebase custom token it carries.
   *
   * Unauthenticated for the same reason as `signin`, and safe for the same reason the ticket is: it
   * can only be redeemed by whoever holds the PKCE verifier the flow started with.
   *
   * @param body - The ticket from the redirect and the verifier the browser retained.
   * @param request - The incoming request, read for the client IP the throttle keys on.
   * @param response - The response to write the token or the rejection to.
   */
  @Post('token')
  @HttpCode(200)
  async token(@Body() body: UserExternalConnectionOAuthTicketExchangeBody, @Req() request: Request, @Res() response: Response): Promise<void> {
    const result = await this.oauthService.exchangeSignInTicket({ ticket: body?.ticket, verifier: body?.verifier, clientIp: request.ip });

    if (result == null) {
      response.status(USER_EXTERNAL_CONNECTION_OAUTH_TICKET_REJECTED_STATUS).json({ error: 'invalid_ticket' });
    } else {
      const responseBody: UserExternalConnectionOAuthTicketExchangeResponse = { customToken: result.customToken };
      response.json(responseBody);
    }
  }
}
