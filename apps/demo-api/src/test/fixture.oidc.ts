import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import { type INestApplication } from '@nestjs/common';
import { AbstractTestContextFixture, useTestContextFixture } from '@dereekb/util/test';
import { unixDateTimeSecondsNumberForNow } from '@dereekb/util';
import { type OidcClientService } from '@dereekb/firebase-server/oidc';
import { type DemoApiFunctionContextFixture, type DemoApiAuthorizedUserTestContextFixture } from './fixture';

// MARK: Test Helpers
/**
 * Creates a Firebase ID token for the given UID that the Auth emulator will accept.
 *
 * The Auth emulator accepts unsigned JWTs (alg: "none") as long as the audience
 * matches the project ID the Admin SDK was initialized with.
 */
async function createTestIdToken(nestApp: INestApplication, uid: string): Promise<string> {
  const { OidcAccountService } = await import('@dereekb/firebase-server/oidc');
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

export interface PerformFullOAuthFlowResult {
  readonly accessToken: string;
  readonly idToken: string;
}

/**
 * Performs the full OAuth authorization code flow and returns an access token.
 *
 * Steps: create client → PKCE → auth redirect → login → consent → code exchange → token
 */
async function performFullOAuthFlow(server: ReturnType<INestApplication['getHttpServer']>, oidcClientService: OidcClientService, nestApp: INestApplication, uid: string): Promise<PerformFullOAuthFlowResult> {
  const { collectCookies, cookieHeader } = createCookieJar();

  // 1. Create a client via the service
  const { client_id, client_secret } = await oidcClientService.createClient({
    client_name: 'test-oauth-context',
    redirect_uris: ['https://example.com/callback'],
    token_endpoint_auth_method: 'client_secret_post'
  });

  // 2. Generate PKCE code_verifier and code_challenge
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  // 3. Start authorization — provider redirects to login interaction
  const authRes = await request(server)
    .get('/oidc/auth')
    .query({
      client_id,
      redirect_uri: 'https://example.com/callback',
      response_type: 'code',
      scope: 'openid email demo',
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
    redirect_uri: 'https://example.com/callback',
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

// MARK: OAuth Test Context
export interface DemoOAuthAuthorizedSuperTestContextParams {
  readonly f: DemoApiFunctionContextFixture;
  readonly u: DemoApiAuthorizedUserTestContextFixture;
}

/**
 * Instance holding authenticated OAuth state for a single test.
 */
export class DemoOAuthAuthorizedSuperTestInstance {
  constructor(
    readonly server: ReturnType<INestApplication['getHttpServer']>,
    readonly accessToken: string
  ) {}

  /**
   * Apply Bearer auth to a supertest request.
   *
   * @example
   * ```typescript
   * await oauth.withAuth(request(oauth.server).get('/oidc/me')).expect(200);
   * await oauth.withAuth(request(oauth.server).post('/api/model/call')).send(body).expect(200);
   * ```
   */
  withAuth(test: request.Test): request.Test {
    return test.set('Authorization', `Bearer ${this.accessToken}`);
  }

  /**
   * Shorthand: create a supertest request with auth already applied.
   *
   * @example
   * ```typescript
   * await oauth.authRequest('get', '/oidc/me').expect(200);
   * await oauth.authRequest('post', '/api/model/call').send(body).expect(200);
   * ```
   */
  authRequest(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string): request.Test {
    return request(this.server)[method](path).set('Authorization', `Bearer ${this.accessToken}`);
  }
}

/**
 * Fixture that wraps {@link DemoOAuthAuthorizedSuperTestInstance} and delegates to it.
 */
export class DemoOAuthAuthorizedSuperTestFixture extends AbstractTestContextFixture<DemoOAuthAuthorizedSuperTestInstance> {
  get server() {
    return this.instance.server;
  }

  get accessToken() {
    return this.instance.accessToken;
  }

  /**
   * Apply Bearer auth to a supertest request.
   *
   * @example
   * ```typescript
   * await oauth.withAuth(request(oauth.server).get('/oidc/me')).expect(200);
   * ```
   */
  withAuth(test: request.Test): request.Test {
    return this.instance.withAuth(test);
  }

  /**
   * Shorthand: create a supertest request with auth already applied.
   *
   * @example
   * ```typescript
   * await oauth.authRequest('get', '/oidc/me').expect(200);
   * await oauth.authRequest('post', '/api/model/call').send(body).expect(200);
   * ```
   */
  authRequest(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string): request.Test {
    return this.instance.authRequest(method, path);
  }
}

/**
 * Creates a test context that performs a full OAuth authorization code flow
 * and provides an authenticated supertest agent and helper methods.
 *
 * @example
 * ```typescript
 * demoApiFunctionContextFactory((f) => {
 *   demoAuthorizedUserContext({ f }, (u) => {
 *     demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
 *       it('should fetch userinfo', async () => {
 *         const res = await oauth.agent.get('/oidc/me').expect(200);
 *         expect(res.body.sub).toBe(u.uid);
 *       });
 *     });
 *   });
 * });
 * ```
 */
/**
 * Default hook/test timeout for OAuth-authenticated test contexts.
 *
 * The full OAuth authorization code flow involves multiple HTTP round trips
 * (auth → login → consent → code exchange), so the default 10s timeout is too short.
 */
const OAUTH_TEST_TIMEOUT = 30_000;

export function demoOAuthAuthorizedSuperTestContext(params: DemoOAuthAuthorizedSuperTestContextParams, buildTests: (oauth: DemoOAuthAuthorizedSuperTestFixture) => void): void {
  const { f, u } = params;

  describe('(oauth)', () => {
    // Increase timeouts for the OAuth flow
    beforeAll(() => {
      vi.setConfig({ hookTimeout: OAUTH_TEST_TIMEOUT, testTimeout: OAUTH_TEST_TIMEOUT });
    });

    useTestContextFixture<DemoOAuthAuthorizedSuperTestFixture, DemoOAuthAuthorizedSuperTestInstance>({
      fixture: new DemoOAuthAuthorizedSuperTestFixture(),
      buildTests,
      initInstance: async () => {
        const serverContext = f.instance.apiServerNestContext;

        // Rotate JWKS keys so JWKS endpoints work
        await serverContext.jwksService.rotateKeys();

        // Load the cached NestApplication for HTTP testing
        const app = await f.loadInitializedNestApplication();
        const server = app.getHttpServer();

        // Perform the full OAuth flow to get an access token for this test's user
        const { accessToken } = await performFullOAuthFlow(server, serverContext.oidcClientService, app, u.uid);

        return new DemoOAuthAuthorizedSuperTestInstance(server, accessToken);
      }
    });
  });
}
