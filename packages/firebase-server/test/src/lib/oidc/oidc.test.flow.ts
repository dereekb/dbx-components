import request from 'supertest';
import { createHash, randomBytes } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { type Maybe, unixDateTimeSecondsNumberForNow } from '@dereekb/util';
import { adminOnlyScopesForOidcProviderProfiles, assignmentOnlyScopesForOidcProviderProfiles, type OidcProviderProfileKey, type OidcTokenEndpointAuthMethod } from '@dereekb/firebase';
import { OidcClientService, OidcAccountService, JwksService, OidcProviderConfigService } from '@dereekb/firebase-server/oidc';

// MARK: Stage
/**
 * A stage of the OAuth authorization code flow that {@link performOAuthFlow} can stop at.
 *
 * - `'auth'` — stop on the `/oidc/auth` response, before the login interaction.
 * - `'callback'` — stop on the client callback redirect, before the token exchange.
 * - `'token'` — run the whole flow, through the token exchange.
 */
export type OAuthTestFlowStage = 'auth' | 'callback' | 'token';

// MARK: Config
/**
 * Configuration for {@link performOAuthFlow} / {@link performFullOAuthFlow}.
 */
export interface OAuthTestFlowConfig {
  /**
   * Space-separated OAuth scopes to request.
   *
   * If omitted, all registered scopes are resolved from {@link OidcAccountService.allRegisteredScopes}.
   */
  readonly scopes?: string;
  /**
   * OAuth redirect URI. Defaults to `'https://example.com/callback'`.
   */
  readonly redirectUri?: string;
  /**
   * Client name used when creating the test OAuth client. Defaults to `'test-oauth-context'`.
   */
  readonly clientName?: string;
  /**
   * Token endpoint auth method. Defaults to `'client_secret_post'`.
   */
  readonly tokenEndpointAuthMethod?: OidcTokenEndpointAuthMethod;
  /**
   * Provider profile keys to assign to the test client (persisted as its `dbx_provider_profiles`
   * client metadata). Defaults to none.
   *
   * Required to obtain an assignment-only profile-gated scope (e.g. `lms`): the consent unlock gate
   * rejects any gated scope the client's assigned profiles do not unlock. Pair this with an explicit
   * {@link OAuthTestFlowConfig.scopes} string containing the gated scope, since the default
   * "all registered scopes" resolution deliberately drops assignment-only scopes.
   */
  readonly providerProfiles?: readonly OidcProviderProfileKey[];
  /**
   * OAuth `prompt` parameter for the authorization request (e.g. `'consent'` to force the consent screen
   * on a session that has already authorized the client). Omitted by default.
   */
  readonly prompt?: string;
  /**
   * Explicit subset of the requested OIDC scopes to grant at consent (the consent request's
   * `grantedOIDCScopes`). Omitted by default, which grants every requested scope.
   */
  readonly grantedOIDCScopes?: readonly string[];
  /**
   * A prior flow's client and cookies to run this flow against — the same OAuth client, the same
   * provider session, and therefore the same Grant. Omitted by default, which creates a fresh client
   * and starts a fresh session.
   *
   * When the session is still logged in, the provider skips the login prompt and the flow goes straight
   * to consent (or straight to the callback when nothing new needs consenting and `prompt` is unset).
   */
  readonly session?: OAuthTestFlowSession;
  /**
   * RFC 8707 `resource` indicator, sent on both `/oidc/auth` and `/oidc/token`.
   *
   * Must match a key registered on the provider's `resourceServers` config. The issued access
   * token then carries that entry's `audience` and — when the entry sets
   * `accessTokenFormat: 'jwt'` — is an RS256 JWT a remote resource server can verify against the
   * provider's JWKS, rather than the default opaque token only the provider itself can validate.
   */
  readonly resource?: string;
  /**
   * Extra query parameters merged onto the `/oidc/auth` request, for parameters this config does
   * not model explicitly.
   */
  readonly extraAuthParams?: Record<string, string | number>;
  /**
   * The stage to stop the flow at. Defaults to `'token'`, the full flow.
   *
   * - `'auth'` — issue the `/oidc/auth` request and stop, exposing the raw redirect response on
   *   {@link OAuthTestFlowResult.authResponse}. Nothing logs in, so no `uid` is needed.
   * - `'callback'` — drive auth → login → consent → the callback redirect and stop before the token
   *   exchange, exposing {@link OAuthTestFlowResult.callbackUrl} and
   *   {@link OAuthTestFlowResult.consentRedirectUrl}. A callback carrying an `error` instead of a
   *   `code` (e.g. `access_denied`) is not treated as a failure at this stage, so a caller can assert
   *   on it.
   * - `'token'` — the full flow, exchanging the authorization code for tokens.
   *
   * Ignored by {@link performFullOAuthFlow} / {@link setupAndPerformFullOAuthFlow}, whose result type
   * guarantees tokens; stop early with {@link performOAuthFlow} / {@link setupAndPerformOAuthFlow}.
   */
  readonly stopAtStage?: OAuthTestFlowStage;
}

/**
 * The client and cookies a flow ran with, for chaining a second flow onto the same provider session.
 */
export interface OAuthTestFlowSession {
  readonly client: OAuthTestFlowClient;
  readonly cookieJar: OAuthTestFlowCookieJar;
}

/**
 * The OAuth client a flow created (or reused).
 */
export interface OAuthTestFlowClient {
  readonly client_id: string;
  readonly client_secret?: string;
  readonly redirectUri: string;
}

/**
 * Cookie jar helpers for the OAuth flow. See {@link createCookieJar}.
 */
export interface OAuthTestFlowCookieJar {
  readonly collectCookies: (res: request.Response) => void;
  readonly cookieHeader: () => string;
}

// MARK: Result
/**
 * Result of {@link performOAuthFlow}, covering every {@link OAuthTestFlowStage} it can stop at.
 *
 * Every field a stage produced is populated; the fields belonging to later stages are undefined.
 */
export interface OAuthTestFlowResult {
  /**
   * The stage the flow stopped at.
   */
  readonly stage: OAuthTestFlowStage;
  /**
   * The raw `/oidc/auth` response, before any redirect was followed.
   *
   * Always populated. This is what a flow stopped at the `'auth'` stage asserts on — it may be a
   * redirect to the login interaction, or an error callback (e.g. `error=invalid_target`).
   */
  readonly authResponse: request.Response;
  /**
   * The PKCE `code_verifier` the flow's `code_challenge` was derived from.
   *
   * Always populated, for a caller that performs its own `/oidc/token` request after stopping at the
   * `'callback'` stage.
   */
  readonly codeVerifier: string;
  /**
   * The URL of the consent SCREEN the provider redirected to, when the flow reached it.
   *
   * Its `scopes` query parameter is the checkbox list the consent UI renders, so it is what scope
   * withholding (e.g. an admin-only scope kept off a non-admin's screen) acts on.
   *
   * Undefined when the flow stopped at the `'auth'` stage, or when nothing needed consenting.
   */
  readonly consentRedirectUrl?: Maybe<URL>;
  /**
   * The client callback URL the flow ended on, carrying either a `code` or an `error`.
   *
   * Undefined when the flow stopped at the `'auth'` stage.
   */
  readonly callbackUrl?: Maybe<URL>;
  /**
   * The access token the token endpoint issued. Undefined unless the flow ran to the `'token'` stage.
   */
  readonly accessToken?: string;
  /**
   * The ID token the token endpoint issued. Undefined unless the flow ran to the `'token'` stage.
   */
  readonly idToken?: string;
  /**
   * The refresh token the token endpoint issued.
   *
   * Only present when the flow requested `offline_access` — the provider issues a refresh token for
   * no other reason. Undefined unless the flow ran to the `'token'` stage.
   *
   * This is what a revocation test spends: a refresh exchange is the one operation that keeps working
   * against a still-live Grant and fails with `invalid_grant` the instant the Grant is destroyed.
   */
  readonly refreshToken?: string;
  /**
   * The `token_type` the token endpoint reported for the access token.
   */
  readonly tokenType?: string;
  /**
   * The space-separated scope the token endpoint reported for the access token. Undefined unless the
   * flow ran to the `'token'` stage.
   */
  readonly scope?: string;
  /**
   * The client and cookies this flow ran with, for chaining another flow onto the same session via
   * {@link OAuthTestFlowConfig.session} — and for the cookie header a caller's own `/oidc/token`
   * request needs, via `session.cookieJar.cookieHeader()`.
   */
  readonly session: OAuthTestFlowSession;
}

/**
 * Result of {@link performFullOAuthFlow} — an {@link OAuthTestFlowResult} that ran to the `'token'`
 * stage, so the callback and the tokens are guaranteed.
 */
export interface PerformFullOAuthFlowResult extends OAuthTestFlowResult {
  readonly callbackUrl: URL;
  readonly accessToken: string;
  readonly idToken: string;
  readonly scope: string;
}

// MARK: Helpers
/**
 * Creates a Firebase ID token for the given UID that the Auth emulator will accept.
 *
 * The Auth emulator accepts unsigned JWTs (alg: "none") as long as the audience
 * matches the project ID the Admin SDK was initialized with.
 *
 * @param nestApp - Initialized NestJS application used to resolve {@link OidcAccountService} for the project ID.
 * @param uid - Firebase user ID to embed in the token's `sub`/`user_id` claims.
 * @returns An unsigned JWT (`alg: "none"`) string suitable for use against the Firebase Auth emulator.
 */
async function createTestIdToken(nestApp: INestApplication, uid: string): Promise<string> {
  const accountService = nestApp.get(OidcAccountService);
  const projectId = accountService.authService.auth.app.options.projectId!;

  const now = unixDateTimeSecondsNumberForNow();
  const payload = {
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    auth_time: now,
    user_id: uid,
    sub: uid,
    iat: now,
    exp: now + 3600,
    firebase: { identities: {}, sign_in_provider: 'custom' }
  };

  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

/**
 * Extracts the interaction UID from a redirect to the login/consent frontend URL.
 *
 * @param res - Supertest response whose `Location` header points at the login/consent frontend, with `?uid=...` carrying the interaction UID.
 * @returns The `uid` query parameter from the redirect URL (the interaction identifier issued by `oidc-provider`).
 */
function extractInteractionUid(res: request.Response): string {
  const location = res.headers['location'];
  const url = location.startsWith('/') ? new URL(location, 'http://localhost') : new URL(location);
  return url.searchParams.get('uid')!;
}

/**
 * Whether a redirect response points at the given interaction frontend URL (the login or consent screen).
 *
 * @param res - Supertest response to inspect.
 * @param frontendUrl - The frontend URL to match, without its query string.
 * @returns True when the response's `Location` header starts with `frontendUrl`.
 */
function isRedirectTo(res: request.Response, frontendUrl: string): boolean {
  const location = res.headers['location'] as string | undefined;
  return location != null && location.startsWith(frontendUrl);
}

/**
 * Cookie jar helpers for the OAuth flow.
 *
 * oidc-provider scopes cookies to specific paths, so supertest.agent()
 * won't forward them between /oidc/* and /interaction/* controllers.
 *
 * @returns A pair of helpers — `collectCookies(res)` to absorb `Set-Cookie` headers from a response, and `cookieHeader()` to produce a combined `Cookie` header string for subsequent requests.
 */
function createCookieJar(): OAuthTestFlowCookieJar {
  const cookieJar = new Map<string, string>();

  function collectCookies(res: request.Response): void {
    const setCookies = res.headers['set-cookie'];

    if (setCookies) {
      const items = Array.isArray(setCookies) ? setCookies : [setCookies];

      for (const cookie of items) {
        const [nameValue] = cookie.split(';');
        const [name] = nameValue.split('=');
        cookieJar.set(name, nameValue);
      }
    }
  }

  function cookieHeader(): string {
    return Array.from(cookieJar.values()).join('; ');
  }

  return { collectCookies, cookieHeader };
}

/**
 * Resolves the scopes string from config, or falls back to all registered scopes
 * from the provider config — excluding any `adminOnlyScopes` or provider-profile-gated scopes.
 *
 * Admin-only scopes (e.g. `token.service`) are dropped from the default "all scopes" request because
 * the provider hard-rejects them for non-admin users, and this default flow logs in an arbitrary
 * (often non-admin) user. Tests that need an admin-only scope pass it explicitly via `config.scopes`.
 * Both sources of the gate are excluded: the provider config's `adminOnlyScopes` and the scopes of any
 * profile marked `adminOnly`.
 *
 * Assignment-only profile-gated scopes (e.g. `lms`, `reports`) are dropped for the same reason: they
 * are unlocked only for a client an admin has assigned the corresponding profile to, and this flow
 * creates a fresh client with no profiles — so the consent unlock gate hard-rejects them (finishing the
 * interaction with `access_denied` and no `code`). Tests that need a gated scope create a client with
 * the profile and pass the scope explicitly via `config.scopes`. A scope unlocked by a DEFAULT profile
 * is deliberately kept: a client with no profiles assigned resolves to the default profiles, so it can
 * obtain that scope.
 *
 * @param nestApp - Initialized NestJS application used to resolve {@link OidcAccountService} when no scopes override is given.
 * @param config - Optional flow config; when `config.scopes` is set, it is returned verbatim.
 * @returns The space-separated scope string to pass to the `/oidc/auth` endpoint.
 */
async function resolveScopes(nestApp: INestApplication, config?: OAuthTestFlowConfig): Promise<string> {
  let result: string;

  if (config?.scopes) {
    result = config.scopes;
  } else {
    const accountService = nestApp.get(OidcAccountService);
    const providerConfig = accountService.providerConfig;
    const providerProfiles = providerConfig.providerProfiles ?? [];
    const adminOnlyScopes = new Set<string>([...(providerConfig.adminOnlyScopes ?? []), ...Array.from(adminOnlyScopesForOidcProviderProfiles(providerProfiles))]);
    const profileGatedScopes = assignmentOnlyScopesForOidcProviderProfiles(providerProfiles);
    result = Object.keys(providerConfig.claims)
      .filter((scope) => !adminOnlyScopes.has(scope) && !profileGatedScopes.has(scope))
      .join(' ');
  }

  return result;
}

// MARK: Flow
/**
 * Input for {@link performOAuthFlow}.
 */
export interface PerformOAuthFlowInput {
  readonly server: ReturnType<INestApplication['getHttpServer']>;
  readonly oidcClientService: OidcClientService;
  readonly nestApp: INestApplication;
  /**
   * Firebase user ID for whom the test ID token is minted and the flow is authorized.
   *
   * Only optional for a flow that stops at the `'auth'` stage, which never reaches the login
   * interaction. Any later stage throws when it is missing.
   */
  readonly uid?: Maybe<string>;
  readonly config?: OAuthTestFlowConfig;
}

/**
 * Input for {@link performFullOAuthFlow}.
 */
export interface PerformFullOAuthFlowInput extends PerformOAuthFlowInput {
  readonly uid: string;
}

/**
 * Performs the OAuth authorization code flow with PKCE, up to the configured
 * {@link OAuthTestFlowConfig.stopAtStage}.
 *
 * Steps: create client → PKCE → auth redirect → login → consent → code exchange → token
 *
 * Stopping early is how a test asserts on an intermediate the completed flow discards — the raw
 * `/oidc/auth` response, the consent screen's offered `scopes`, or a callback that came back carrying
 * an `error` instead of a `code`. A stage before `'token'` never exchanges the code, so it never
 * throws on such a callback; the caller asserts on {@link OAuthTestFlowResult.callbackUrl} instead,
 * and can run its own `/oidc/token` request with {@link OAuthTestFlowResult.codeVerifier} and the
 * session's cookie header.
 *
 * @param input - Bag of services and overrides needed to drive the flow.
 * @param input.server - HTTP server returned by `nestApp.getHttpServer()` against which all supertest requests are issued.
 * @param input.oidcClientService - Service used to create the OAuth client whose credentials drive the flow.
 * @param input.nestApp - Initialized NestJS application; used to resolve {@link OidcAccountService} for project-id-derived ID tokens and default scopes.
 * @param input.uid - Firebase user ID for whom the test ID token is minted; required for any stage past `'auth'`.
 * @param input.config - Optional flow overrides (scopes, redirect URI, client name, token endpoint auth method, provider profiles, stop stage).
 * @returns The intermediates the flow produced, plus the tokens when it ran to the `'token'` stage.
 * @throws {Error} When a stage past `'auth'` is requested without a `uid`, or when the token exchange step fails (the response body and status are included in the message).
 */
export async function performOAuthFlow(input: PerformOAuthFlowInput): Promise<OAuthTestFlowResult> {
  const { server, oidcClientService, nestApp, uid, config } = input;
  const cookieJar = config?.session?.cookieJar ?? createCookieJar();
  const { collectCookies, cookieHeader } = cookieJar;

  const stage: OAuthTestFlowStage = config?.stopAtStage ?? 'token';
  const redirectUri = config?.session?.client.redirectUri ?? config?.redirectUri ?? 'https://example.com/callback';
  const clientName = config?.clientName ?? 'test-oauth-context';
  const tokenEndpointAuthMethod: OidcTokenEndpointAuthMethod = config?.tokenEndpointAuthMethod ?? 'client_secret_post';
  const providerProfiles = config?.providerProfiles;
  const scopes = await resolveScopes(nestApp, config);

  // 1. Create a client via the service (or reuse the prior flow's)
  let client: OAuthTestFlowClient;

  if (config?.session) {
    client = config.session.client;
  } else {
    const { client_id, client_secret } = await oidcClientService.createClient({
      client_name: clientName,
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: tokenEndpointAuthMethod,
      ...(providerProfiles == null ? {} : { dbx_provider_profiles: [...providerProfiles] })
    });

    client = { client_id, client_secret, redirectUri };
  }

  const { client_id, client_secret } = client;

  // 2. Generate PKCE code_verifier and code_challenge
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  // 3. Start authorization — provider redirects to the login interaction (or, on a live session, straight
  //    to consent / the callback)
  const authRes = await request(server)
    .get('/oidc/auth')
    .query({
      client_id,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: 'test-state',
      nonce: 'test-nonce',
      ...(config?.prompt == null ? {} : { prompt: config.prompt }),
      ...(config?.resource == null ? {} : { resource: config.resource }),
      ...config?.extraAuthParams
    })
    .redirects(0);

  collectCookies(authRes);

  let consentRedirectUrl: Maybe<URL>;
  let callbackUrl: Maybe<URL>;
  let tokenBody: Maybe<{ access_token: string; id_token: string; refresh_token?: string; token_type?: string; scope: string }>;

  if (stage !== 'auth') {
    if (uid == null) {
      throw new Error(`performOAuthFlow requires a uid to reach the "${stage}" stage (only the "auth" stage skips the login interaction).`);
    }

    const idToken = await createTestIdToken(nestApp, uid);
    const providerConfigService = nestApp.get(OidcProviderConfigService);
    let interactionRes: request.Response = authRes;

    // 4. Complete login with a Firebase ID token — unless the session is already logged in, in which case the
    //    provider skipped the login prompt and `authRes` already points at the consent screen (or the callback)
    if (isRedirectTo(authRes, providerConfigService.appLoginUrl)) {
      const loginUid = extractInteractionUid(authRes);
      const loginRes = await request(server).post(`/interaction/${loginUid}/login`).set('Cookie', cookieHeader()).send({ idToken });

      // 5. Resume after login → consent redirect
      const resumeAfterLoginPath = new URL(loginRes.body.redirectTo).pathname + new URL(loginRes.body.redirectTo).search;
      interactionRes = await request(server).get(resumeAfterLoginPath).set('Cookie', cookieHeader()).redirects(0);
      collectCookies(interactionRes);
    }

    // 6. Approve consent — unless nothing needed consenting and the provider went straight to the callback
    let callbackRedirectRes: request.Response = interactionRes;

    if (isRedirectTo(interactionRes, providerConfigService.appConsentUrl)) {
      consentRedirectUrl = new URL(interactionRes.headers['location'], 'http://localhost');

      const consentUid = extractInteractionUid(interactionRes);
      const consentRes = await request(server)
        .post(`/interaction/${consentUid}/consent`)
        .set('Cookie', cookieHeader())
        .send({ idToken, approved: true, ...(config?.grantedOIDCScopes == null ? {} : { grantedOIDCScopes: [...config.grantedOIDCScopes] }) });

      // 7. Follow resume redirect → callback with authorization code
      const resumeAfterConsentPath = new URL(consentRes.body.redirectTo).pathname + new URL(consentRes.body.redirectTo).search;
      callbackRedirectRes = await request(server).get(resumeAfterConsentPath).set('Cookie', cookieHeader()).redirects(0);
      collectCookies(callbackRedirectRes);
    }

    callbackUrl = new URL(callbackRedirectRes.headers['location']);

    if (stage !== 'callback') {
      // 8. Exchange authorization code for tokens
      const authorizationCode = callbackUrl.searchParams.get('code')!;
      const tokenRes = await request(server)
        .post('/oidc/token')
        .set('Cookie', cookieHeader())
        .type('form')
        .send({
          grant_type: 'authorization_code',
          code: authorizationCode,
          redirect_uri: redirectUri,
          client_id,
          client_secret,
          code_verifier: codeVerifier,
          ...(config?.resource == null ? {} : { resource: config.resource })
        });

      if (!tokenRes.body.access_token) {
        throw new Error(`OAuth token exchange failed (status ${tokenRes.status}): ${JSON.stringify(tokenRes.body)}`);
      }

      tokenBody = tokenRes.body;
    }
  }

  return {
    stage,
    authResponse: authRes,
    codeVerifier,
    consentRedirectUrl,
    callbackUrl,
    accessToken: tokenBody?.access_token,
    idToken: tokenBody?.id_token,
    refreshToken: tokenBody?.refresh_token,
    tokenType: tokenBody?.token_type,
    scope: tokenBody?.scope,
    session: { client, cookieJar }
  };
}

/**
 * Performs the full OAuth authorization code flow with PKCE and returns tokens.
 *
 * Steps: create client → PKCE → auth redirect → login → consent → code exchange → token
 *
 * Always runs to the `'token'` stage — {@link OAuthTestFlowConfig.stopAtStage} is ignored here, since
 * this function's result guarantees tokens. Use {@link performOAuthFlow} to stop earlier.
 *
 * @param input - Bag of services and overrides needed to drive the flow end-to-end.
 * @param input.server - HTTP server returned by `nestApp.getHttpServer()` against which all supertest requests are issued.
 * @param input.oidcClientService - Service used to create the OAuth client whose credentials drive the flow.
 * @param input.nestApp - Initialized NestJS application; used to resolve {@link OidcAccountService} for project-id-derived ID tokens and default scopes.
 * @param input.uid - Firebase user ID for whom the test ID token is minted and the OAuth flow is authorized.
 * @param input.config - Optional flow overrides (scopes, redirect URI, client name, token endpoint auth method, provider profiles).
 * @returns The exchanged access token and ID token from the OIDC `/token` endpoint, plus the flow's intermediates.
 * @throws {Error} When the token exchange step fails (the response body and status are included in the message).
 */
export async function performFullOAuthFlow(input: PerformFullOAuthFlowInput): Promise<PerformFullOAuthFlowResult> {
  const result = await performOAuthFlow({ ...input, config: { ...input.config, stopAtStage: 'token' } });
  return result as PerformFullOAuthFlowResult;
}

/**
 * Higher-level helper that resolves OIDC services from the NestJS DI container,
 * rotates JWKS keys, and then performs the OAuth flow up to {@link OAuthTestFlowConfig.stopAtStage}.
 *
 * This avoids callers needing to import from `@dereekb/firebase-server/oidc` directly.
 *
 * @param nestApp - Initialized NestJS application from which {@link JwksService} and {@link OidcClientService} are resolved.
 * @param uid - Firebase user ID for whom the OAuth flow is authorized; only omittable for the `'auth'` stage.
 * @param config - Optional flow overrides (scopes, redirect URI, client name, token endpoint auth method, provider profiles, stop stage).
 * @returns The result of {@link performOAuthFlow}.
 */
export async function setupAndPerformOAuthFlow(nestApp: INestApplication, uid: Maybe<string>, config?: OAuthTestFlowConfig): Promise<OAuthTestFlowResult> {
  // Rotate JWKS keys so JWKS endpoints work
  const jwksService = nestApp.get(JwksService);
  await jwksService.rotateKeys();

  // Resolve OidcClientService from DI
  const oidcClientService = nestApp.get(OidcClientService);

  const server = nestApp.getHttpServer();
  return performOAuthFlow({ server, oidcClientService, nestApp, uid, config });
}

/**
 * Higher-level helper that resolves OIDC services from the NestJS DI container,
 * rotates JWKS keys, and then performs the full OAuth flow.
 *
 * This avoids callers needing to import from `@dereekb/firebase-server/oidc` directly.
 *
 * @param nestApp - Initialized NestJS application from which {@link JwksService} and {@link OidcClientService} are resolved.
 * @param uid - Firebase user ID for whom the OAuth flow is authorized.
 * @param config - Optional flow overrides (scopes, redirect URI, client name, token endpoint auth method, provider profiles).
 * @returns The exchanged access token and ID token from {@link performFullOAuthFlow}.
 */
export async function setupAndPerformFullOAuthFlow(nestApp: INestApplication, uid: string, config?: OAuthTestFlowConfig): Promise<PerformFullOAuthFlowResult> {
  const result = await setupAndPerformOAuthFlow(nestApp, uid, { ...config, stopAtStage: 'token' });
  return result as PerformFullOAuthFlowResult;
}
