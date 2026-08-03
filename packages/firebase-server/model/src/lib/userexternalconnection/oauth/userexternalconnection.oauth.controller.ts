import { Get, Query, Req, Res } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { type Maybe } from '@dereekb/util';
import { type AbstractUserExternalConnectionOAuthService, type UserExternalConnectionOAuthState } from './userexternalconnection.oauth.service';

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
export interface UserExternalConnectionOAuthCallbackQuery {
  readonly code?: Maybe<string>;
  readonly state?: Maybe<UserExternalConnectionOAuthState>;
  readonly error?: Maybe<string>;
  readonly error_description?: Maybe<string>;
}

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
   *   `error_description` on refusal.
   * @param response - The response to issue the redirect on.
   */
  @Get('callback')
  async callback(@Query() query: UserExternalConnectionOAuthCallbackQuery, @Res() response: Response): Promise<void> {
    const { redirectUrl } = await this.oauthService.handleCallback({
      code: query.code,
      state: query.state,
      error: query.error,
      errorDescription: query.error_description
    });

    response.redirect(USER_EXTERNAL_CONNECTION_OAUTH_REDIRECT_STATUS, redirectUrl);
  }
}
