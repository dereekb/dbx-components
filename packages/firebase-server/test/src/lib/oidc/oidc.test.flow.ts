import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import { type INestApplication } from '@nestjs/common';
import { unixDateTimeSecondsNumberForNow } from '@dereekb/util';
import type { OidcTokenEndpointAuthMethod } from '@dereekb/firebase';
import { OidcClientService, OidcAccountService, JwksService } from '@dereekb/firebase-server/oidc';

// MARK: Config
/**
 * Configuration for {@link performFullOAuthFlow}.
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
}

// MARK: Result
export interface PerformFullOAuthFlowResult {
  readonly accessToken: string;
  readonly idToken: string;
}

// MARK: Helpers
/**
 * Creates a Firebase ID token for the given UID that the Auth emulator will accept.
 *
 * The Auth emulator accepts unsigned JWTs (alg: "none") as long as the audience
 * matches the project ID the Admin SDK was initialized with.
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
 */
function extractInteractionUid(res: request.Response): string {
  const location = res.headers['location'] as string;
  const url = location.startsWith('/') ? new URL(location, 'http://localhost') : new URL(location);
  return url.searchParams.get('uid')!;
}

/**
 * Cookie jar helpers for the OAuth flow.
 *
 * oidc-provider scopes cookies to specific paths, so supertest.agent()
 * won't forward them between /oidc/* and /interaction/* controllers.
 */
function createCookieJar() {
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
    return [...cookieJar.values()].join('; ');
  }

  return { collectCookies, cookieHeader };
}

/**
 * Resolves the scopes string from config, or falls back to all registered scopes
 * from `OidcAccountService.allRegisteredScopes`.
 */
async function resolveScopes(nestApp: INestApplication, config?: OAuthTestFlowConfig): Promise<string> {
  if (config?.scopes) {
    return config.scopes;
  }

  const accountService = nestApp.get(OidcAccountService);
  return Object.keys(accountService.providerConfig.claims).join(' ');
}

// MARK: Flow
/**
 * Performs the full OAuth authorization code flow with PKCE and returns tokens.
 *
 * Steps: create client → PKCE → auth redirect → login → consent → code exchange → token
 */
export async function performFullOAuthFlow(server: ReturnType<INestApplication['getHttpServer']>, oidcClientService: OidcClientService, nestApp: INestApplication, uid: string, config?: OAuthTestFlowConfig): Promise<PerformFullOAuthFlowResult> {
  const { collectCookies, cookieHeader } = createCookieJar();

  const redirectUri = config?.redirectUri ?? 'https://example.com/callback';
  const clientName = config?.clientName ?? 'test-oauth-context';
  const tokenEndpointAuthMethod: OidcTokenEndpointAuthMethod = config?.tokenEndpointAuthMethod ?? 'client_secret_post';
  const scopes = await resolveScopes(nestApp, config);

  // 1. Create a client via the service
  const { client_id, client_secret } = await oidcClientService.createClient({
    client_name: clientName,
    redirect_uris: [redirectUri],
    token_endpoint_auth_method: tokenEndpointAuthMethod
  });

  // 2. Generate PKCE code_verifier and code_challenge
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  // 3. Start authorization — provider redirects to login interaction
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
      nonce: 'test-nonce'
    })
    .redirects(0);

  collectCookies(authRes);
  const loginUid = extractInteractionUid(authRes);

  // 4. Complete login with a Firebase ID token
  const idToken = await createTestIdToken(nestApp, uid);
  const loginRes = await request(server).post(`/interaction/${loginUid}/login`).set('Cookie', cookieHeader()).send({ idToken });

  // 5. Resume after login → consent redirect
  const resumeAfterLoginPath = new URL(loginRes.body.redirectTo).pathname + new URL(loginRes.body.redirectTo).search;
  const consentRedirectRes = await request(server).get(resumeAfterLoginPath).set('Cookie', cookieHeader()).redirects(0);
  collectCookies(consentRedirectRes);
  const consentUid = extractInteractionUid(consentRedirectRes);

  // 6. Approve consent
  const consentRes = await request(server).post(`/interaction/${consentUid}/consent`).set('Cookie', cookieHeader()).send({ idToken, approved: true });

  // 7. Follow resume redirect → callback with authorization code
  const resumeAfterConsentPath = new URL(consentRes.body.redirectTo).pathname + new URL(consentRes.body.redirectTo).search;
  const callbackRedirectRes = await request(server).get(resumeAfterConsentPath).set('Cookie', cookieHeader()).redirects(0);
  collectCookies(callbackRedirectRes);

  const callbackUrl = new URL(callbackRedirectRes.headers['location']);
  const authorizationCode = callbackUrl.searchParams.get('code')!;

  // 8. Exchange authorization code for tokens
  const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader()).type('form').send({
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: redirectUri,
    client_id,
    client_secret,
    code_verifier: codeVerifier
  });

  if (!tokenRes.body.access_token) {
    throw new Error(`OAuth token exchange failed (status ${tokenRes.status}): ${JSON.stringify(tokenRes.body)}`);
  }

  return {
    accessToken: tokenRes.body.access_token,
    idToken: tokenRes.body.id_token
  };
}

/**
 * Higher-level helper that resolves OIDC services from the NestJS DI container,
 * rotates JWKS keys, and then performs the full OAuth flow.
 *
 * This avoids callers needing to import from `@dereekb/firebase-server/oidc` directly.
 */
export async function setupAndPerformFullOAuthFlow(nestApp: INestApplication, uid: string, config?: OAuthTestFlowConfig): Promise<PerformFullOAuthFlowResult> {
  // Rotate JWKS keys so JWKS endpoints work
  const jwksService = nestApp.get(JwksService);
  await jwksService.rotateKeys();

  // Resolve OidcClientService from DI
  const oidcClientService = nestApp.get(OidcClientService);

  const server = nestApp.getHttpServer();
  return performFullOAuthFlow(server, oidcClientService, nestApp, uid, config);
}
