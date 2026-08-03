import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { type Maybe } from '@dereekb/util';
import { CalcomOAuthCallbackService, type CalcomOAuthState } from './oauth.callback.service';

/**
 * HTTP status used for the handoff redirects.
 *
 * A 302 keeps the redirect non-cacheable, which matters because each authorize URL carries a
 * single-use `state`.
 */
export const CALCOM_OAUTH_REDIRECT_STATUS = 302;

/**
 * Endpoints for the Cal.com authorization-code handoff.
 *
 * Mounted at `/oauth/calcom`, matching the external-connection registry's default authorize path of
 * `/oauth/<providerType>/authorize`. Hosting rewrites do not strip the path, so the controller
 * prefix is the full public path.
 */
@Controller('oauth/calcom')
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
   * @param code - The authorization code Cal.com issued.
   * @param state - The state Cal.com echoed back, identifying who is connecting.
   * @param response - The response to issue the redirect on.
   */
  @Get('callback')
  async callback(@Query('code') code: Maybe<string>, @Query('state') state: Maybe<CalcomOAuthState>, @Res() response: Response): Promise<void> {
    const { redirectUrl } = await this.calcomOAuthCallbackService.handleCallback({ code, state });
    response.redirect(CALCOM_OAUTH_REDIRECT_STATUS, redirectUrl);
  }
}
