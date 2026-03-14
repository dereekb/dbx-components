import { Controller, Get, Post, Param, Req, Res, Inject, HttpException, HttpStatus, HttpCode, Body } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { OidcService } from '../service/oidc.service';
import { OidcProviderConfigService } from '../service';
import { type OAuthInteractionConsentRequest, type OAuthInteractionLoginRequest, type OidcInteractionUid } from '@dereekb/firebase';
import { OidcAccountService } from '../service/oidc.account.service';
import { OidcInteractionService } from '../service/oidc.interaction.service';

// MARK: Interaction Controller
/**
 * Controller for OIDC interaction endpoints (login/consent).
 *
 * The GET endpoint is accessed via browser redirect from the oidc-provider
 * and must be excluded from AppCheck middleware.
 *
 * The POST endpoints are called by the frontend app. They verify the user's
 * Firebase Auth ID token and bypass the oidc-provider interaction cookie
 * (which is scoped to the frontend path set by `interactions.url`).
 */
@Controller('interaction')
export class OidcInteractionController {
  constructor(
    @Inject(OidcInteractionService) private readonly oidcInteractionService: OidcInteractionService,
    @Inject(OidcProviderConfigService) private readonly oidcProviderConfigService: OidcProviderConfigService,
    @Inject(OidcAccountService) private readonly accountService: OidcAccountService
  ) {}

  /**
   * GET /interaction/:uid
   *
   * Detects the interaction type and redirects to the appropriate frontend page.
   *
   * @throws {HttpException} 404 when the interaction UID is not found or has expired.
   */
  @Get(':uid')
  async getInteraction(@Param('uid') uid: OidcInteractionUid, @Req() req: Request, @Res() res: Response) {
    try {
      const interaction = await this.oidcInteractionService.getInteractionDetails(req, res);
      const { prompt } = interaction;

      if (prompt.name === 'login') {
        return res.redirect(`${this.oidcProviderConfigService.appLoginUrl}?uid=${uid}`);
      }

      return res.redirect(`${this.oidcProviderConfigService.appConsentUrl}?uid=${uid}`);
    } catch {
      throw new HttpException('Interaction not found', HttpStatus.NOT_FOUND);
    }
  }

  /**
   * POST /interaction/:uid/login
   *
   * Verifies the Firebase Auth ID token sent by the frontend, extracts the
   * user's UID, and completes the oidc-provider login interaction.
   *
   * @throws {HttpException} 401 when the Firebase ID token is invalid.
   * @throws {HttpException} 400 when the login interaction cannot be completed.
   */
  @Post(':uid/login')
  @HttpCode(HttpStatus.OK)
  async postLogin(@Param('uid') uid: OidcInteractionUid, @Body() body: OAuthInteractionLoginRequest, @Res() res: Response) {
    const accountId = await this._verifyIdToken(body.idToken);

    try {
      const redirectTo = await this.oidcInteractionService.finishInteractionByUid(
        uid,
        {
          login: { accountId }
        },
        { mergeWithLastSubmission: false }
      );

      res.json({ redirectTo });
    } catch {
      throw new HttpException('Login interaction failed', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /interaction/:uid/consent
   *
   * Receives consent decision from frontend. Grants missing OIDC scopes and claims
   * when approved, or returns `access_denied` when rejected.
   *
   * @throws {HttpException} 400 when the consent interaction cannot be completed.
   */
  @Post(':uid/consent')
  @HttpCode(HttpStatus.OK)
  async postConsent(@Param('uid') uid: OidcInteractionUid, @Body() body: OAuthInteractionConsentRequest, @Res() res: Response) {
    await this._verifyIdToken(body.idToken);

    try {
      if (!body.approved) {
        const redirectTo = await this.oidcInteractionService.finishInteractionByUid(
          uid,
          {
            error: 'access_denied',
            error_description: 'User denied consent'
          },
          { mergeWithLastSubmission: true }
        );

        res.json({ redirectTo });
        return;
      }

      const interaction = await this.oidcInteractionService.findInteractionByUid(uid);
      const { prompt, params, session } = interaction;
      const grant = await this.oidcInteractionService.findOrCreateGrant(interaction.grantId, session?.accountId ?? '', params.client_id as string);

      if (prompt.details?.missingOIDCScope) {
        grant.addOIDCScope((prompt.details.missingOIDCScope as string[]).join(' '));
      }

      if (prompt.details?.missingOIDCClaims) {
        grant.addOIDCClaims(prompt.details.missingOIDCClaims as string[]);
      }

      if (prompt.details?.missingResourceScopes) {
        for (const [indicator, scopes] of Object.entries(prompt.details.missingResourceScopes as Record<string, string[]>)) {
          grant.addResourceScope(indicator, scopes.join(' '));
        }
      }

      const grantId = await grant.save();

      const redirectTo = await this.oidcInteractionService.finishInteractionByUid(
        uid,
        {
          consent: { grantId }
        },
        { mergeWithLastSubmission: true }
      );

      res.json({ redirectTo });
    } catch {
      throw new HttpException('Consent interaction failed', HttpStatus.BAD_REQUEST);
    }
  }

  // MARK: Internal
  /**
   * Verifies a Firebase Auth ID token and returns the user's UID.
   *
   * @throws {HttpException} 401 when the token is invalid or expired.
   */
  private async _verifyIdToken(idToken: string): Promise<string> {
    try {
      const decodedToken = await this.accountService.authService.auth.verifyIdToken(idToken);
      return decodedToken.uid;
    } catch {
      throw new HttpException('Invalid Firebase ID token', HttpStatus.UNAUTHORIZED);
    }
  }
}
