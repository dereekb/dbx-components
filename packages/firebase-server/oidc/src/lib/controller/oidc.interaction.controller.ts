import { Controller, Get, Post, Param, Req, Res, Inject, HttpException, HttpStatus, HttpCode, Body, Logger, Optional } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { OidcProviderConfigService } from '../service';
import { adminOnlyScopesForOidcProviderProfiles, type FirebaseAuthUserId, type OidcEntryClientId, type OAuthInteractionConsentRequest, type OAuthInteractionLoginRequest, type OidcInteractionUid, type OidcScope, scopesForOidcProviderProfiles } from '@dereekb/firebase';
import { OidcAccountService } from '../service/oidc.account.service';
import { OidcInteractionService } from '../service/oidc.interaction.service';
import { OidcService } from '../service/oidc.service';
import { oidcClientProviderProfileScopes } from '../profile';
import { DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM } from '../service/oidc.session-ttl';
import { OIDC_ANALYTICS_SERVICE, emitOidcAnalyticsEvent, noopOidcAnalyticsService, type OidcAnalyticsService } from '../service/analytics';

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
  private readonly _logger = new Logger(OidcInteractionController.name);
  private readonly _analytics: OidcAnalyticsService;

  // eslint-disable-next-line @typescript-eslint/max-params -- NestJS DI requires individual constructor parameters
  constructor(
    @Inject(OidcInteractionService) private readonly oidcInteractionService: OidcInteractionService,
    @Inject(OidcProviderConfigService) private readonly oidcProviderConfigService: OidcProviderConfigService,
    @Inject(OidcAccountService) private readonly accountService: OidcAccountService,
    @Inject(OidcService) private readonly oidcService: OidcService,
    @Optional() @Inject(OIDC_ANALYTICS_SERVICE) analytics?: OidcAnalyticsService
  ) {
    this._analytics = analytics ?? noopOidcAnalyticsService();
  }

  /**
   * GET /interaction/:uid.
   *
   * Detects the interaction type and redirects to the appropriate frontend page.
   *
   * @param uid - The interaction UID from the URL path.
   * @param req - The incoming Express request.
   * @param res - The Express response used for redirecting.
   * @returns A redirect response to the appropriate frontend page.
   * @throws {HttpException} HTTP 404 when the interaction UID is not found or has expired.
   */
  @Get(':uid')
  async getInteraction(@Param('uid') uid: OidcInteractionUid, @Req() req: Request, @Res() res: Response) {
    try {
      const interaction = await this.oidcInteractionService.getInteractionDetails(req, res);
      const { prompt } = interaction;
      const redirectUrl = prompt.name === 'login' ? `${this.oidcProviderConfigService.appLoginUrl}?uid=${uid}` : `${this.oidcProviderConfigService.appConsentUrl}?uid=${uid}`;

      return res.redirect(redirectUrl);
    } catch {
      throw new HttpException('Interaction not found', HttpStatus.NOT_FOUND);
    }
  }

  /**
   * POST /interaction/:uid/login.
   *
   * Verifies the Firebase Auth ID token sent by the frontend, extracts the
   * user's UID, and completes the oidc-provider login interaction.
   *
   * @param uid - The interaction UID from the URL path.
   * @param body - The login request containing the Firebase ID token.
   * @param res - The Express response used for sending JSON.
   * @throws {HttpException} HTTP 401 when the Firebase ID token is invalid.
   * @throws {HttpException} HTTP 400 when the login interaction cannot be completed.
   */
  @Post(':uid/login')
  @HttpCode(HttpStatus.OK)
  async postLogin(@Param('uid') uid: OidcInteractionUid, @Body() body: OAuthInteractionLoginRequest, @Res() res: Response) {
    const startedAt = Date.now();
    let accountId: string;

    try {
      accountId = await this._verifyIdToken(body.idToken);
    } catch (err) {
      emitOidcAnalyticsEvent(this._analytics, { type: 'login', isSuccessful: false, reason: 'invalid_id_token', error: err, durationMs: Date.now() - startedAt }, this._logger);
      throw err;
    }

    try {
      const interaction = await this.oidcInteractionService.finishInteractionByUid(
        uid,
        {
          login: { accountId }
        },
        { mergeWithLastSubmission: false }
      );

      emitOidcAnalyticsEvent(this._analytics, { type: 'login', isSuccessful: true, uid: accountId, durationMs: Date.now() - startedAt }, this._logger);
      res.json({ redirectTo: interaction.returnTo });
    } catch (err) {
      emitOidcAnalyticsEvent(this._analytics, { type: 'login', isSuccessful: false, uid: accountId, reason: 'login_interaction_failed', error: err, durationMs: Date.now() - startedAt }, this._logger);
      throw new HttpException('Login interaction failed', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /interaction/:uid/consent.
   *
   * Receives consent decision from frontend. Grants missing OIDC scopes and claims
   * when approved, or returns `access_denied` when rejected.
   *
   * @param uid - The interaction UID from the URL path.
   * @param body - The consent request containing approval decision and Firebase ID token.
   * @param res - The Express response used for sending JSON.
   * @throws {HttpException} HTTP 400 when the consent interaction cannot be completed.
   */
  @Post(':uid/consent')
  @HttpCode(HttpStatus.OK)
  async postConsent(@Param('uid') uid: OidcInteractionUid, @Body() body: OAuthInteractionConsentRequest, @Res() res: Response) {
    const startedAt = Date.now();
    await this._verifyIdToken(body.idToken);

    let clientId: OidcEntryClientId | undefined;
    let accountId: FirebaseAuthUserId | undefined;

    try {
      if (!body.approved) {
        const { returnTo: redirectTo } = await this.oidcInteractionService.finishInteractionByUid(
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

      clientId = params['client_id'] as string;
      accountId = session?.accountId ?? '';

      const missingOIDCScope = (prompt.details['missingOIDCScope'] as string[] | undefined) ?? [];

      // When the grant already exists (re-consent), find it up-front so its encountered scopes feed
      // both the admin-only gate below and the silent-no-op handling further down. A new grant is
      // created later with the resolved TTL, since `findOrCreateGrant` only applies `expiresIn` on creation.
      const existingGrant = interaction.grantId ? await this.oidcInteractionService.findOrCreateGrant(interaction.grantId, accountId, clientId) : undefined;

      // Encountered = scopes/claims already granted (or rejected) on the existing Grant. oidc-provider
      // excludes these from `missingOIDCScope` etc. when the consent prompt is re-shown via `prompt=consent`,
      // but the consent UI sources its checkbox list from the auth URL's `scope=` param (the full request set)
      // and re-submits them all. We accept already-encountered values as silent no-ops so a re-consent on a
      // client the user has previously authorized doesn't fail validation.
      const encounteredOIDCScopes = existingGrant ? existingGrant.getOIDCScopeEncountered().split(' ').filter(Boolean) : [];

      // Loaded once here and reused by the provider-profile gate below and the TTL resolution further down.
      const clientPayload = await this.oidcService.findClientPayload(clientId);

      // The requested OIDC scope set is `missingOIDCScope ∪ encounteredOIDCScopes` (a fresh consent has
      // everything in `missing`; a re-consent may carry already-granted scopes in `encountered`). The two
      // provider-profile gates below judge the REQUEST — what this client may ask for at all — so they
      // read this set. The admin-only gate further down judges what the user actually consented to
      // instead, and reads `consentedOIDCScopeSet`.
      const requestedOIDCScopeSet = new Set<string>([...missingOIDCScope, ...encounteredOIDCScopes]);
      const providerProfiles = this.accountService.providerConfig.providerProfiles;

      // Provider-profile scope gate. Any scope referenced by a provider profile is "gated" — available
      // only to clients whose assigned profiles unlock it (a client with NO assigned profiles resolves
      // to the registry's default profiles). Independent of the admin-only gate below; a scope may be
      // subject to both.
      const { unlocked: clientUnlockedScopes, required: clientRequiredScopes } = oidcClientProviderProfileScopes(providerProfiles, clientPayload?.dbx_provider_profiles ?? undefined);
      const profileGatedScopes = scopesForOidcProviderProfiles(providerProfiles ?? []);

      // Unlock gate: reject any requested gated scope this client's profiles do not unlock.
      const disallowedGatedScopes = Array.from(requestedOIDCScopeSet).filter((scope) => profileGatedScopes.has(scope) && !clientUnlockedScopes.has(scope));

      if (disallowedGatedScopes.length > 0) {
        const { returnTo: redirectTo } = await this.oidcInteractionService.finishInteractionByUid(uid, { error: 'access_denied', error_description: `The following scope(s) are not available to this client: ${disallowedGatedScopes.join(', ')}.` }, { mergeWithLastSubmission: true });
        emitOidcAnalyticsEvent(this._analytics, { type: 'consent', isSuccessful: false, uid: accountId, clientId, reason: 'scope_not_unlocked_for_client', durationMs: Date.now() - startedAt }, this._logger);
        res.json({ redirectTo });
        return;
      }

      // Required gate: a scope a client's profiles force-require (`require: 'required'`) must be present
      // in the request. Reject when the client did not request a required scope.
      const missingRequiredScopes = Array.from(clientRequiredScopes).filter((scope) => !requestedOIDCScopeSet.has(scope));

      if (missingRequiredScopes.length > 0) {
        const { returnTo: redirectTo } = await this.oidcInteractionService.finishInteractionByUid(uid, { error: 'access_denied', error_description: `This client must request the required scope(s): ${missingRequiredScopes.join(', ')}.` }, { mergeWithLastSubmission: true });
        emitOidcAnalyticsEvent(this._analytics, { type: 'consent', isSuccessful: false, uid: accountId, clientId, reason: 'required_scope_missing', durationMs: Date.now() - startedAt }, this._logger);
        res.json({ redirectTo });
        return;
      }

      // The scopes this consent actually puts in force. Resolved once here and re-applied to the grant
      // further down, so the admin-only gate below judges exactly the set that will be granted.
      //
      // Force-grants the client's required profile scopes (in addition to `openid`) so they cannot be
      // dropped at consent — the required gate above already guarantees they were requested.
      const effectiveOIDCScopes = resolveEffectiveSubset({ missing: missingOIDCScope, requestedSubset: body.grantedOIDCScopes, alwaysGranted: [...ALWAYS_GRANTED_OIDC_SCOPES, ...clientRequiredScopes], alreadyEncountered: encounteredOIDCScopes });

      // Scopes the existing Grant already holds (granted, minus any it rejected). Nothing here revokes
      // them, so they stay in force through this consent and the gate below has to count them too.
      const heldOIDCScopes = existingGrant ? existingGrant.getOIDCScope().split(' ').filter(Boolean) : [];
      const consentedOIDCScopeSet = new Set<string>([...heldOIDCScopes, ...effectiveOIDCScopes.granted]);

      // Admin-only scope gate. If the consented set intersects the admin-only scopes — the provider's
      // `adminOnlyScopes` unioned with the scopes of every profile marked `adminOnly` — and the resolving
      // user is not an admin, hard-reject with `access_denied` rather than silently dropping the scope.
      //
      // Deliberately gated on what the user CONSENTED to rather than on what the client requested: the
      // consent UI renders a deselectable checkbox for every scope in the auth request, and a client
      // cannot know the caller's admin status when it builds that request. Gating on the request would
      // make an admin-only scope in `scopes_supported` fatal for every non-admin — deselecting it at
      // consent has to be a way through.
      const configAdminOnlyScopes = this.accountService.providerConfig.adminOnlyScopes ?? [];
      const adminOnlyScopes = new Set<string>([...configAdminOnlyScopes, ...adminOnlyScopesForOidcProviderProfiles(providerProfiles ?? [])]);
      const consentedAdminOnlyScopes = Array.from(adminOnlyScopes).filter((scope) => consentedOIDCScopeSet.has(scope));

      // Deliberately sourced from the provider config's `adminOnlyScopes` ALONE, unlike the gate above:
      // this flag also selects the (highest) service-token TTL tier further down, and a profile marked
      // `adminOnly` must gate by admin status WITHOUT widening its grant's lifetime to that tier.
      const requestsServiceToken = configAdminOnlyScopes.some((scope) => consentedOIDCScopeSet.has(scope));
      const isAdmin = accountId ? await (this.accountService.delegate.isAdminUser?.(this.accountService.userContext(accountId).authUserContext) ?? false) : false;

      if (consentedAdminOnlyScopes.length > 0 && !isAdmin) {
        const { returnTo: redirectTo } = await this.oidcInteractionService.finishInteractionByUid(uid, { error: 'access_denied', error_description: `The following scope(s) are restricted to admins: ${consentedAdminOnlyScopes.join(', ')}.` }, { mergeWithLastSubmission: true });
        emitOidcAnalyticsEvent(this._analytics, { type: 'consent', isSuccessful: false, uid: accountId, clientId, serviceToken: requestsServiceToken, isAdmin: false, reason: 'service_token_non_admin', durationMs: Date.now() - startedAt }, this._logger);
        res.json({ redirectTo });
        return;
      }

      // Resolve the requested login duration up-front. The configured Grant TTL function (in
      // OidcService.buildProviderConfiguration) only fires when oidc-provider's koa middleware
      // drives `grant.save()`, so its `ctx.oidc.params` lookup of `dbx_session_ttl` returns
      // undefined when the consent submit runs in this controller. We pre-set `expiresIn` on
      // newly-created grants so they persist with the correct (tiered) TTL.
      const requestedRawTtl = (params as Record<string, unknown>)[DBX_FIREBASE_SERVER_OIDC_SESSION_TTL_PARAM];
      const clientMaxSessionTtl = clientPayload?.dbx_max_session_ttl ?? undefined;
      const expiresInSeconds = this.oidcService.resolveLoginDurationForGrant(requestedRawTtl, { dbx_max_session_ttl: clientMaxSessionTtl }, { isAdmin, hasServiceScope: requestsServiceToken });

      const grant = existingGrant ?? (await this.oidcInteractionService.findOrCreateGrant(interaction.grantId, accountId, clientId, expiresInSeconds));

      if (missingOIDCScope.length > 0) {
        const { granted, rejected } = effectiveOIDCScopes;

        if (granted.length > 0) {
          grant.addOIDCScope(granted.join(' '));
        }

        for (const value of rejected) {
          grant.rejectOIDCScope(value);
        }
      }

      const encounteredOIDCClaims = grant.getOIDCClaimsEncountered();

      const missingOIDCClaims = (prompt.details['missingOIDCClaims'] as string[] | undefined) ?? [];

      if (missingOIDCClaims.length > 0) {
        const { granted, rejected } = resolveEffectiveSubset({ missing: missingOIDCClaims, requestedSubset: body.grantedOIDCClaims, alreadyEncountered: encounteredOIDCClaims });

        if (granted.length > 0) {
          grant.addOIDCClaims(granted);
        }

        if (rejected.length > 0) {
          grant.rejectOIDCClaims(rejected);
        }
      }

      const missingResourceScopes = (prompt.details['missingResourceScopes'] as Record<string, string[]> | undefined) ?? {};

      for (const [indicator, scopes] of Object.entries(missingResourceScopes)) {
        // A submission with no explicit per-resource selection falls back to the OIDC scope selection
        // rather than granting everything the resource server declares. A resource server's scope list
        // is drawn from the same provider scopes the consent UI renders as one checkbox list, so a scope
        // deselected there must not reappear on the resource-bound access token — otherwise deselecting
        // an admin-only scope would clear the gate above while the token still carried it.
        // `grantedOIDCScopes` being absent still means "grant everything requested".
        const requestedSubset = body.grantedResourceScopes?.[indicator] ?? (body.grantedOIDCScopes ? scopes.filter((scope) => consentedOIDCScopeSet.has(scope)) : undefined);
        const encounteredResourceScopes = grant.getResourceScopeEncountered(indicator).split(' ').filter(Boolean);
        const { granted, rejected } = resolveEffectiveSubset({ missing: scopes, requestedSubset, alreadyEncountered: encounteredResourceScopes });

        if (granted.length > 0) {
          grant.addResourceScope(indicator, granted.join(' '));
        }

        for (const value of rejected) {
          grant.rejectResourceScope(indicator, value);
        }
      }

      const grantId = await grant.save();

      const { returnTo: redirectTo } = await this.oidcInteractionService.finishInteractionByUid(
        uid,
        {
          consent: { grantId }
        },
        { mergeWithLastSubmission: true }
      );

      emitOidcAnalyticsEvent(this._analytics, { type: 'consent', isSuccessful: true, uid: accountId, clientId, scopes: Array.from(requestedOIDCScopeSet), serviceToken: requestsServiceToken, isAdmin, durationMs: Date.now() - startedAt }, this._logger);
      res.json({ redirectTo });
    } catch (err) {
      emitOidcAnalyticsEvent(this._analytics, { type: 'consent', isSuccessful: false, uid: accountId, clientId, reason: 'consent_interaction_failed', error: err, durationMs: Date.now() - startedAt }, this._logger);

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
   * @param idToken - The Firebase Auth ID token to verify.
   * @returns The user's UID extracted from the decoded token.
   * @throws {HttpException} HTTP 401 when the token is invalid or expired.
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
 * Inputs for {@link resolveEffectiveSubset}.
 */
export interface ResolveEffectiveSubsetInput {
  /**
   * Entries the OIDC prompt indicated were missing for this consent.
   */
  readonly missing: readonly string[];
  /**
   * Optional subset the caller wants to grant; each value must be in `missing` or `alreadyEncountered`.
   */
  readonly requestedSubset: readonly string[] | undefined;
  /**
   * Entries that must be granted whenever they appear in `missing`, regardless of `requestedSubset`.
   */
  readonly alwaysGranted?: readonly string[];
  /**
   * Entries the existing Grant has previously granted or rejected. Tolerated as no-ops on re-consent.
   */
  readonly alreadyEncountered?: readonly string[];
}

/**
 * Resolves the effective set to grant — and the complementary set to
 * reject — from a missing set, an optional caller-provided subset, an
 * optional list of always-granted entries, and an optional list of
 * already-encountered entries (granted or rejected on the existing Grant).
 *
 * Throws `400 BAD_REQUEST` if the requested subset contains an entry that
 * is in neither the missing set nor the already-encountered set (no
 * privilege escalation).
 *
 * - When `requestedSubset` is undefined → grants everything in `missing` (back-compat); rejects nothing.
 * - When `requestedSubset` is provided → grants the intersection with `missing`; rejects every other missing
 *   entry so oidc-provider does not re-prompt for them. Values in `alreadyEncountered` pass validation but
 *   are not re-applied to the grant (no-op).
 * - Always-granted entries are union'd into `granted` (clamped to `missing`).
 *
 * @param input - Missing entries plus optional subset, always-granted, and already-encountered lists.
 * @returns `granted` to add to the grant and `rejected` to record on the grant.
 * @throws {HttpException} `400 BAD_REQUEST` when `requestedSubset` includes a value that is neither missing nor already-encountered.
 */
export function resolveEffectiveSubset(input: ResolveEffectiveSubsetInput): { granted: string[]; rejected: string[] } {
  const { missing, requestedSubset, alwaysGranted = [], alreadyEncountered = [] } = input;
  const missingSet = new Set(missing);
  const encounteredSet = new Set(alreadyEncountered);
  let baseSelection: readonly string[];

  if (requestedSubset === undefined) {
    baseSelection = missing;
  } else {
    for (const value of requestedSubset) {
      if (!missingSet.has(value) && !encounteredSet.has(value)) {
        throw new HttpException(`Granted value "${value}" is not in the requested set.`, HttpStatus.BAD_REQUEST);
      }
    }
    // Filter to `missing` only — already-encountered values pass validation but
    // do not need to be re-applied (oidc-provider's Grant tracks them already).
    baseSelection = requestedSubset.filter((value) => missingSet.has(value));
  }

  const grantedSet = new Set<string>(baseSelection);

  for (const value of alwaysGranted) {
    if (missingSet.has(value)) {
      grantedSet.add(value);
    }
  }

  const rejected: string[] = [];

  for (const value of missing) {
    if (!grantedSet.has(value)) {
      rejected.push(value);
    }
  }

  return { granted: Array.from(grantedSet), rejected };
}
