import { Controller, Get, Post, Param, Req, Res, Inject, HttpException, HttpStatus, Body } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { OidcService } from './service/oidc.service';
import { OidcModuleConfig } from './oidc.config';

// MARK: DTOs
export interface LoginInteractionBody {
  /**
   * Firebase ID token as proof of authentication.
   */
  readonly idToken: string;
}

export interface ConsentInteractionBody {
  /**
   * Whether the user approved the consent.
   */
  readonly approved: boolean;
}

// MARK: Well-Known Controller
/**
 * Controller for OAuth/OIDC discovery and metadata endpoints.
 */
@Controller('.well-known')
export class OidcWellKnownController {
  constructor(@Inject(OidcModuleConfig) private readonly config: OidcModuleConfig) {}

  /**
   * OAuth Protected Resource discovery endpoint.
   * Required by Claude custom connectors (RFC 8707).
   */
  @Get('oauth-protected-resource')
  getProtectedResource() {
    return {
      authorization_servers: [this.config.issuer]
    };
  }
}

// MARK: Interaction Controller
/**
 * Controller for OIDC interaction endpoints (login/consent).
 *
 * These routes must be excluded from AppCheck middleware since they
 * are accessed during the OAuth flow by external clients.
 */
@Controller('interaction')
export class OidcInteractionController {
  constructor(
    @Inject(OidcService) private readonly oidcService: OidcService,
    @Inject(OidcModuleConfig) private readonly config: OidcModuleConfig
  ) {}

  /**
   * GET /interaction/:uid
   *
   * Detects the interaction type and redirects to the appropriate frontend page.
   */
  @Get(':uid')
  async getInteraction(@Param('uid') uid: string, @Req() req: Request, @Res() res: Response) {
    try {
      const interaction = await this.oidcService.getInteractionDetails(req, res);
      const { prompt } = interaction;

      if (prompt.name === 'login') {
        return res.redirect(`${this.config.loginUrl}?uid=${uid}`);
      }

      return res.redirect(`${this.config.consentUrl}?uid=${uid}`);
    } catch {
      throw new HttpException('Interaction not found', HttpStatus.NOT_FOUND);
    }
  }

  /**
   * POST /interaction/:uid/login
   *
   * Receives auth proof from frontend (Firebase ID token) and completes the login interaction.
   */
  @Post(':uid/login')
  async postLogin(@Param('uid') _uid: string, @Body() body: LoginInteractionBody, @Req() req: Request, @Res() res: Response) {
    try {
      // The frontend sends a Firebase ID token as proof of authentication.
      // In a real implementation, we would verify this token and extract the UID.
      // For now, the UID is extracted from the token by the consuming app.
      await this.oidcService.finishInteraction(
        req,
        res,
        {
          login: {
            accountId: body.idToken // Will be replaced with actual UID from verified token
          }
        },
        { mergeWithLastSubmission: false }
      );
    } catch {
      throw new HttpException('Login interaction failed', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /interaction/:uid/consent
   *
   * Receives consent decision from frontend.
   */
  @Post(':uid/consent')
  async postConsent(@Param('uid') _uid: string, @Body() body: ConsentInteractionBody, @Req() req: Request, @Res() res: Response) {
    try {
      if (!body.approved) {
        await this.oidcService.finishInteraction(
          req,
          res,
          {
            error: 'access_denied',
            error_description: 'User denied consent'
          },
          { mergeWithLastSubmission: true }
        );
        return;
      }

      const interaction = await this.oidcService.getInteractionDetails(req, res);
      const { prompt, params, session } = interaction;
      const grant = await this.oidcService.findOrCreateGrant(interaction.grantId, session?.accountId ?? '', params.client_id as string);

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

      await this.oidcService.finishInteraction(
        req,
        res,
        {
          consent: { grantId }
        },
        { mergeWithLastSubmission: true }
      );
    } catch {
      throw new HttpException('Consent interaction failed', HttpStatus.BAD_REQUEST);
    }
  }
}
