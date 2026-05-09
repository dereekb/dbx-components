import { Controller, Get, Post, Param, Req, Res, Inject, HttpException, HttpStatus, HttpCode, Body } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { OidcProviderConfigService } from '../service';
import { type OAuthInteractionConsentRequest, type OAuthInteractionLoginRequest, type OidcInteractionUid, type OidcScope } from '@dereekb/firebase';
import { OidcAccountService } from '../service/oidc.account.service';
import { OidcInteractionService } from '../service/oidc.interaction.service';
import { OidcService } from '../service/oidc.service';
import { DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM } from '../service/oidc.session-ttl';

/**
 * OIDC scopes that the server always grants on consent when they were
 * requested, regardless of whether the frontend included them in
 * `grantedOIDCScopes`. `openid` is required for any OIDC flow, so the
 * UI shows it as non-deselectable and the server enforces it here.
 */
const ALWAYS_GRANTED_OIDC_SCOPES: readonly OidcScope[] = ['openid'];

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
  // eslint-disable-next-line @typescript-eslint/max-params -- NestJS DI requires individual constructor parameters
  constructor(
    @Inject(OidcInteractionService) private readonly oidcInteractionService: OidcInteractionService,
    @Inject(OidcProviderConfigService) private readonly oidcProviderConfigService: OidcProviderConfigService,
    @Inject(OidcAccountService) private readonly accountService: OidcAccountService,
    @Inject(OidcService) private readonly oidcService: OidcService
  ) {}

  /**
   * GET /interaction/:uid
   *
   * Detects the interaction type and redirects to the appropriate frontend page.
   *
   * @param uid - the interaction UID from the URL path
   * @param req - the incoming Express request
   * @param res - the Express response used for redirecting
   * @returns a redirect response to the appropriate frontend page
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
   * @param uid - the interaction UID from the URL path
   * @param body - the login request containing the Firebase ID token
   * @param res - the Express response used for sending JSON
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
   * @param uid - the interaction UID from the URL path
   * @param body - the consent request containing approval decision and Firebase ID token
   * @param res - the Express response used for sending JSON
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
      const clientId = params.client_id as string;

      // Resolve the requested login duration up-front. The configured Grant TTL function (in
      // OidcService.buildProviderConfiguration) only fires when oidc-provider's koa middleware
      // drives `grant.save()`, so its `ctx.oidc.params` lookup of `dbx_session_ttl` returns
      // undefined when the consent submit runs in this controller. We pre-set `expiresIn` on
      // newly-created grants so they persist with the correct TTL.
      const requestedRawTtl = (params as Record<string, unknown>)[DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM];
      const clientPayload = await this.oidcService.findClientPayload(clientId);
      const clientMaxSessionTtl = clientPayload?.dbx_max_session_ttl ?? undefined;
      const expiresInSeconds = this.oidcService.resolveLoginDurationForGrant(requestedRawTtl, { dbx_max_session_ttl: clientMaxSessionTtl });

      const grant = await this.oidcInteractionService.findOrCreateGrant(interaction.grantId, session?.accountId ?? '', clientId, expiresInSeconds);

      const missingOIDCScope = (prompt.details.missingOIDCScope as string[] | undefined) ?? [];

      if (missingOIDCScope.length > 0) {
        const effectiveOIDCScope = resolveEffectiveSubset(missingOIDCScope, body.grantedOIDCScopes, ALWAYS_GRANTED_OIDC_SCOPES);

        if (effectiveOIDCScope.length > 0) {
          grant.addOIDCScope(effectiveOIDCScope.join(' '));
        }
      }

      const missingOIDCClaims = (prompt.details.missingOIDCClaims as string[] | undefined) ?? [];

      if (missingOIDCClaims.length > 0) {
        const effectiveOIDCClaims = resolveEffectiveSubset(missingOIDCClaims, body.grantedOIDCClaims);

        if (effectiveOIDCClaims.length > 0) {
          grant.addOIDCClaims(effectiveOIDCClaims);
        }
      }

      const missingResourceScopes = (prompt.details.missingResourceScopes as Record<string, string[]> | undefined) ?? {};

      for (const [indicator, scopes] of Object.entries(missingResourceScopes)) {
        const requestedSubset = body.grantedResourceScopes?.[indicator];
        const effectiveResourceScopes = resolveEffectiveSubset(scopes, requestedSubset);

        if (effectiveResourceScopes.length > 0) {
          grant.addResourceScope(indicator, effectiveResourceScopes.join(' '));
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
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }

      throw new HttpException('Consent interaction failed', HttpStatus.BAD_REQUEST);
    }
  }

  // MARK: Internal
  /**
   * Verifies a Firebase Auth ID token and returns the user's UID.
   *
   * @param idToken - the Firebase Auth ID token to verify
   * @returns the user's UID extracted from the decoded token
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

/**
 * Resolves the effective set to grant from a missing set, an optional
 * caller-provided subset, and an optional list of always-granted entries.
 *
 * Throws `400 BAD_REQUEST` if the requested subset contains entries that
 * are not in the missing set (no privilege escalation).
 *
 * - When `requestedSubset` is undefined → grants everything in `missing` (back-compat).
 * - When `requestedSubset` is provided → grants exactly that subset.
 * - Always-granted entries are union'd in (clamped to `missing`).
 *
 * @param missing - Entries the OIDC prompt indicated were missing for this consent.
 * @param requestedSubset - Optional subset the caller wants to grant; must be a subset of `missing`.
 * @param alwaysGranted - Entries that must be granted whenever they appear in `missing`, regardless of `requestedSubset`.
 * @returns The effective set of entries to grant.
 */
function resolveEffectiveSubset(missing: readonly string[], requestedSubset: readonly string[] | undefined, alwaysGranted: readonly string[] = []): string[] {
  const missingSet = new Set(missing);
  let baseSelection: readonly string[];

  if (requestedSubset === undefined) {
    baseSelection = missing;
  } else {
    for (const value of requestedSubset) {
      if (!missingSet.has(value)) {
        throw new HttpException(`Granted value "${value}" is not in the requested set.`, HttpStatus.BAD_REQUEST);
      }
    }
    baseSelection = requestedSubset;
  }

  const effectiveSet = new Set<string>(baseSelection);

  for (const value of alwaysGranted) {
    if (missingSet.has(value)) {
      effectiveSet.add(value);
    }
  }

  return Array.from(effectiveSet);
}
