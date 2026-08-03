import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { type Maybe } from '@dereekb/util';
import { CALCOM_OAUTH_CALLBACK_CONTROLLER_PATH } from './oauth.callback.config';
import { CalcomOAuthCallbackService, type CalcomOAuthState } from './oauth.callback.service';

/**
 * HTTP status used for the handoff redirects.
 *
 * A 302 keeps the redirect non-cacheable, which matters because each authorize URL carries a
 * single-use `state`.
 */
export const CALCOM_OAUTH_REDIRECT_STATUS = 302;

/**
 * Query parameters Cal.com sends to the redirect URI.
 *
 * Snake-cased because these are the wire names — `error_description` is what RFC 6749 4.1.2.1
 * specifies, so it is read as-is rather than renamed at the boundary.
 */
export interface CalcomOAuthCallbackQuery {
  readonly code?: Maybe<string>;
  readonly state?: Maybe<CalcomOAuthState>;
  readonly error?: Maybe<string>;
  readonly error_description?: Maybe<string>;
}

/**
 * Endpoints for the Cal.com authorization-code handoff.
 *
 * Mounted at `/oauth/calcom`, matching the external-connection registry's default authorize path of
 * `/oauth/<providerType>/authorize`. Hosting rewrites do not strip the path, so this prefix is the
 * public path — but an app with a global API route prefix must ALSO exclude these routes from it via
 * {@link CALCOM_OAUTH_CALLBACK_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE}, or they land under that prefix
 * instead and no longer match the redirect URI registered with Cal.com.
 */
@Controller(CALCOM_OAUTH_CALLBACK_CONTROLLER_PATH)
export class CalcomOAuthCallbackController {
  constructor(@Inject(CalcomOAuthCallbackService) readonly calcomOAuthCallbackService: CalcomOAuthCallbackService) {}

  /**
   * Begins the handoff by redirecting the user's browser to the Cal.com consent screen.
   *
   * Carries the `state` resolved for the request; a request without a resolvable state is bounced to
   * the failure URL rather than sent to Cal.com.
   *
   * @param request - The incoming authorize request, which the state is resolved from.
   * @param response - The response to issue the redirect on.
   */
  @Get('authorize')
  async authorize(@Req() request: Request, @Res() response: Response): Promise<void> {
    const authorizeUrl = await this.calcomOAuthCallbackService.authorizeUrlForRequest(request);
    response.redirect(CALCOM_OAUTH_REDIRECT_STATUS, authorizeUrl ?? this.calcomOAuthCallbackService.failureUrl);
  }

  /**
   * Completes the handoff: verifies the returned `state`, exchanges the authorization code, and
   * redirects to the configured success or failure URL.
   *
   * On refusal Cal.com sends `error` / `error_description` in place of a `code` (RFC 6749 4.1.2.1),
   * so both are read and passed through — otherwise a rejected scope or a denied consent is
   * indistinguishable from a missing code.
   *
   * @param query - The callback query parameters: `code` + `state` on approval, or `error` +
   *   `error_description` on refusal.
   * @param response - The response to issue the redirect on.
   */
  @Get('callback')
  async callback(@Query() query: CalcomOAuthCallbackQuery, @Res() response: Response): Promise<void> {
    const { redirectUrl } = await this.calcomOAuthCallbackService.handleCallback({
      code: query.code,
      state: query.state,
      error: query.error,
      errorDescription: query.error_description
    });

    response.redirect(CALCOM_OAUTH_REDIRECT_STATUS, redirectUrl);
  }
}
