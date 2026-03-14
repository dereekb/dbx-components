import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import { type INestApplication } from '@nestjs/common';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { OidcModuleConfig, JwksServiceStorageConfig, type JwksService, type OidcService, type OidcClientService } from '@dereekb/firebase-server/oidc';
import { unixDateTimeSecondsNumberForNow } from '@dereekb/util';

/**
 * Creates a Firebase ID token for the given UID that the Auth emulator will accept.
 *
 * The Auth emulator accepts unsigned JWTs (alg: "none") as long as the audience
 * matches the project ID the Admin SDK was initialized with. We craft the token
 * directly to ensure the audience matches the dynamic test project ID.
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

  // The emulator accepts unsigned JWTs (alg: "none")
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  let app: INestApplication;
  let jwksService: JwksService;
  let oidcService: OidcService;
  let oidcClientService: OidcClientService;
  let oidcModuleConfig: OidcModuleConfig;

  beforeEach(async () => {
    const serverContext = f.instance.apiServerNestContext;
    jwksService = serverContext.jwksService;
    oidcService = serverContext.oidcService;
    oidcClientService = serverContext.oidcClientService;
    oidcModuleConfig = f.instance.nest.get(OidcModuleConfig);

    // Generate keys so JWKS endpoints work
    await jwksService.rotateKeys();

    // Create a full NestApplication from the TestingModule for HTTP testing
    app = await f.loadInitializedNestApplication();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/.well-known', () => {
    describe('GET /.well-known/openid-configuration', () => {
      it('should return discovery metadata', async () => {
        const res = await request(app.getHttpServer()).get('/.well-known/openid-configuration').expect(200);

        expect(res.body.issuer).toBe(oidcModuleConfig.issuer);
        expect(res.body.authorization_endpoint).toBeDefined();
        expect(res.body.token_endpoint).toBeDefined();
        expect(res.body.jwks_uri).toBeDefined();
        expect(res.body.scopes_supported).toContain('openid');
        expect(res.body.scopes_supported).toContain('demo');
        expect(res.body.response_types_supported).toContain('code');
      });

      it('should have jwks_uri pointing to the configured storage public path', async () => {
        const storageConfig = f.instance.nest.get(JwksServiceStorageConfig);
        const expectedUrl = await storageConfig.jwksStorageAccessorFile!.getDownloadUrl();

        const res = await request(app.getHttpServer()).get('/.well-known/openid-configuration').expect(200);

        expect(expectedUrl).toBeDefined();
        expect(res.body.jwks_uri).toBe(expectedUrl);
      });
    });

    describe('GET /.well-known/jwks.json', () => {
      it('should return JWKS with at least one key', async () => {
        const res = await request(app.getHttpServer()).get('/.well-known/jwks.json').expect(200);

        expect(res.body.keys).toBeDefined();
        expect(res.body.keys.length).toBeGreaterThanOrEqual(1);
        expect(res.body.keys[0].kty).toBe('RSA');
        expect(res.body.keys[0].kid).toBeDefined();
      });
    });

    describe('GET /.well-known/oauth-protected-resource', () => {
      it('should return authorization_servers with the issuer', async () => {
        const res = await request(app.getHttpServer()).get('/.well-known/oauth-protected-resource').expect(200);

        expect(res.body.authorization_servers).toEqual([oidcModuleConfig.issuer]);
      });
    });
  });

  describe('/interaction', () => {
    describe('GET /interaction/:uid', () => {
      it('should return 404 for a nonexistent interaction uid', async () => {
        await request(app.getHttpServer()).get('/interaction/nonexistent-uid').expect(404);
      });
    });

    describe('POST /interaction/:uid/login', () => {
      it('should return 401 for an invalid Firebase ID token', async () => {
        await request(app.getHttpServer()).post('/interaction/nonexistent-uid/login').send({ idToken: 'fake-token' }).expect(401);
      });
    });

    describe('POST /interaction/:uid/consent', () => {
      it('should return 401 for an invalid Firebase ID token', async () => {
        await request(app.getHttpServer()).post('/interaction/nonexistent-uid/consent').send({ idToken: 'fake-token', approved: false }).expect(401);
      });
    });
  });

  describe('/oidc (provider controller)', () => {
    describe('GET /oidc/auth', () => {
      it('should return an error when called without required params', async () => {
        const res = await request(app.getHttpServer()).get('/oidc/auth');

        // oidc-provider returns a 400 or redirects with error for missing required params
        expect([302, 400]).toContain(res.status);
      });
    });

    describe('POST /oidc/token', () => {
      it('should return 400 when called without a grant', async () => {
        await request(app.getHttpServer()).post('/oidc/token').send({ grant_type: 'authorization_code', code: 'invalid' }).expect(400);
      });
    });

    describe('GET /oidc/me (userinfo)', () => {
      it('should return 401 without a bearer token', async () => {
        await request(app.getHttpServer()).get('/oidc/me').expect(401);
      });
    });

    describe('POST /oidc/reg (dynamic client registration)', () => {
      it('should reject registration when registrationEnabled is false (default)', async () => {
        const res = await request(app.getHttpServer())
          .post('/oidc/reg')
          .send({
            redirect_uris: ['https://example.com/callback'],
            response_types: ['code'],
            grant_types: ['authorization_code'],
            token_endpoint_auth_method: 'client_secret_post'
          });

        // Registration endpoint is disabled, so the provider should return 404
        expect(res.status).toBe(404);
      });
    });
  });

  describe('OAuth authorization code flow', () => {
    demoAuthorizedUserContext({ f }, (u) => {
      /**
       * Extract the interaction UID from a redirect to the login/consent frontend URL.
       */
      function extractInteractionUid(res: request.Response): string {
        const location = res.headers['location'] as string;
        const url = location.startsWith('/') ? new URL(location, 'http://localhost') : new URL(location);
        return url.searchParams.get('uid')!;
      }

      it('should complete a full authorization code flow', async () => {
        const server = app.getHttpServer();

        // Cookie jar that accumulates Set-Cookie headers across responses.
        // oidc-provider scopes cookies to specific paths, so supertest.agent()
        // won't forward them between /oidc/* and /interaction/* controllers.
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

        // 1. Create a client via the service (dynamic registration is disabled)
        const { client_id, client_secret } = await oidcClientService.createClient({
          client_name: 'test',
          redirect_uris: ['https://example.com/callback'],
          token_endpoint_auth_method: 'client_secret_post'
        });

        // 2. Generate PKCE code_verifier and code_challenge
        const codeVerifier = randomBytes(32).toString('base64url');
        const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

        // 3. Start authorization - provider should redirect to login interaction
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

        expect(authRes.status).toBe(303);
        collectCookies(authRes);
        const loginUid = extractInteractionUid(authRes);
        expect(loginUid).toBeDefined();

        // 4. Complete login - send a real Firebase ID token
        const idToken = await createTestIdToken(app, u.uid);
        const loginRes = await request(server).post(`/interaction/${loginUid}/login`).set('Cookie', cookieHeader()).send({ idToken });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body.redirectTo).toBeDefined();

        // 5. Follow the resume redirect back to the provider
        const resumeAfterLoginPath = new URL(loginRes.body.redirectTo).pathname + new URL(loginRes.body.redirectTo).search;
        const consentRedirectRes = await request(server).get(resumeAfterLoginPath).set('Cookie', cookieHeader()).redirects(0);

        expect(consentRedirectRes.status).toBe(303);
        collectCookies(consentRedirectRes);

        // Verify the consent redirect URL contains the expected query params
        const consentRedirectUrl = new URL(consentRedirectRes.headers['location'], 'http://localhost');
        const consentUid = consentRedirectUrl.searchParams.get('uid');
        expect(consentUid).toBeDefined();
        expect(consentRedirectUrl.searchParams.get('client_id')).toBe(client_id);
        expect(consentRedirectUrl.searchParams.get('client_name')).toBe('test');
        expect(consentRedirectUrl.searchParams.get('scopes')).toBe('openid email demo');

        // 6. Approve consent
        const consentRes = await request(server).post(`/interaction/${consentUid}/consent`).set('Cookie', cookieHeader()).send({ idToken, approved: true });
        expect(consentRes.status).toBe(200);
        expect(consentRes.body.redirectTo).toBeDefined();

        // 7. Follow the resume redirect - provider should redirect to callback with code
        const resumeAfterConsentPath = new URL(consentRes.body.redirectTo).pathname + new URL(consentRes.body.redirectTo).search;
        const callbackRedirectRes = await request(server).get(resumeAfterConsentPath).set('Cookie', cookieHeader()).redirects(0);

        expect(callbackRedirectRes.status).toBe(303);
        collectCookies(callbackRedirectRes);
        const callbackUrl = new URL(callbackRedirectRes.headers['location']);
        expect(callbackUrl.origin).toBe('https://example.com');

        const authorizationCode = callbackUrl.searchParams.get('code');
        const returnedState = callbackUrl.searchParams.get('state');
        expect(authorizationCode).toBeDefined();
        expect(returnedState).toBe('test-state');

        // 8. Exchange authorization code for tokens
        const tokenRes = await request(server)
          .post('/oidc/token')
          .set('Cookie', cookieHeader())
          .type('form')
          .send({
            grant_type: 'authorization_code',
            code: authorizationCode,
            redirect_uri: 'https://example.com/callback',
            client_id,
            client_secret,
            code_verifier: codeVerifier
          })
          .expect(200);

        expect(tokenRes.body.access_token).toBeDefined();
        expect(tokenRes.body.id_token).toBeDefined();
        expect(tokenRes.body.token_type).toBe('Bearer');
        expect(tokenRes.body.scope).toContain('demo');

        // 9. Use the access token to fetch userinfo
        const userinfoRes = await request(server).get('/oidc/me').set('Authorization', `Bearer ${tokenRes.body.access_token}`).expect(200);

        expect(userinfoRes.body.sub).toBe(u.uid);
      });

      it('should return demo auth claims in userinfo when demo scope is requested', async () => {
        const server = app.getHttpServer();

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

        // 1. Create a client via the service (dynamic registration is disabled)
        const { client_id, client_secret } = await oidcClientService.createClient({
          client_name: 'test',
          redirect_uris: ['https://example.com/callback'],
          token_endpoint_auth_method: 'client_secret_post'
        });

        // 2. Generate PKCE
        const codeVerifier = randomBytes(32).toString('base64url');
        const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

        // 3. Start authorization with demo scope
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

        expect(authRes.status).toBe(303);
        collectCookies(authRes);
        const loginUid = extractInteractionUid(authRes);

        // 4. Login
        const idToken = await createTestIdToken(app, u.uid);
        const loginRes = await request(server).post(`/interaction/${loginUid}/login`).set('Cookie', cookieHeader()).send({ idToken });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body.redirectTo).toBeDefined();

        // 5. Resume after login
        const resumeAfterLoginPath = new URL(loginRes.body.redirectTo).pathname + new URL(loginRes.body.redirectTo).search;
        const consentRedirectRes = await request(server).get(resumeAfterLoginPath).set('Cookie', cookieHeader()).redirects(0);
        expect(consentRedirectRes.status).toBe(303);
        collectCookies(consentRedirectRes);
        const consentUid = extractInteractionUid(consentRedirectRes);

        // 6. Approve consent
        const consentRes = await request(server).post(`/interaction/${consentUid}/consent`).set('Cookie', cookieHeader()).send({ idToken, approved: true });
        expect(consentRes.status).toBe(200);
        expect(consentRes.body.redirectTo).toBeDefined();

        // 7. Follow resume redirect to get authorization code
        const resumeAfterConsentPath = new URL(consentRes.body.redirectTo).pathname + new URL(consentRes.body.redirectTo).search;
        const callbackRedirectRes = await request(server).get(resumeAfterConsentPath).set('Cookie', cookieHeader()).redirects(0);
        expect(callbackRedirectRes.status).toBe(303);
        collectCookies(callbackRedirectRes);

        const callbackUrl = new URL(callbackRedirectRes.headers['location']);
        const authorizationCode = callbackUrl.searchParams.get('code');

        // 8. Exchange code for tokens
        const tokenRes = await request(server)
          .post('/oidc/token')
          .set('Cookie', cookieHeader())
          .type('form')
          .send({
            grant_type: 'authorization_code',
            code: authorizationCode,
            redirect_uri: 'https://example.com/callback',
            client_id,
            client_secret,
            code_verifier: codeVerifier
          })
          .expect(200);

        expect(tokenRes.body.scope).toContain('demo');

        // 9. Fetch userinfo and verify demo auth claims
        const userinfoRes = await request(server).get('/oidc/me').set('Authorization', `Bearer ${tokenRes.body.access_token}`).expect(200);

        expect(userinfoRes.body.sub).toBe(u.uid);

        // Verify demo auth claims match DemoApiAuthClaims fields
        expect(userinfoRes.body.o).toBe(1); // default user is onboarded
        expect(userinfoRes.body.a).toBe(0); // default user is not admin

        // 10. Verify verifyAccessToken returns valid OidcAuthData
        const oidcAuthData = await oidcService.verifyAccessToken(tokenRes.body.access_token);
        expect(oidcAuthData).toBeDefined();
        expect(oidcAuthData!.uid).toBe(u.uid);
        expect(oidcAuthData!.oidcValidatedToken.sub).toBe(u.uid);
        expect(oidcAuthData!.oidcValidatedToken.scope).toContain('demo');
      });

      /**
       * Performs the full authorization code flow (auth → login → consent → code)
       * and returns the authorization code along with cookie state.
       */
      async function performAuthCodeFlow(server: ReturnType<INestApplication['getHttpServer']>, clientId: string): Promise<{ authorizationCode: string; codeVerifier: string; cookieHeader: string }> {
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

        function getCookieHeader(): string {
          return [...cookieJar.values()].join('; ');
        }

        const codeVerifier = randomBytes(32).toString('base64url');
        const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

        // Start authorization
        const authRes = await request(server)
          .get('/oidc/auth')
          .query({
            client_id: clientId,
            redirect_uri: 'https://example.com/callback',
            response_type: 'code',
            scope: 'openid email demo',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            state: 'test-state',
            nonce: 'test-nonce'
          })
          .redirects(0);

        expect(authRes.status).toBe(303);
        collectCookies(authRes);
        const loginUid = extractInteractionUid(authRes);

        // Login
        const idToken = await createTestIdToken(app, u.uid);
        const loginRes = await request(server).post(`/interaction/${loginUid}/login`).set('Cookie', getCookieHeader()).send({ idToken });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body.redirectTo).toBeDefined();

        // Resume after login → consent redirect
        const resumeAfterLoginPath = new URL(loginRes.body.redirectTo).pathname + new URL(loginRes.body.redirectTo).search;
        const consentRedirectRes = await request(server).get(resumeAfterLoginPath).set('Cookie', getCookieHeader()).redirects(0);
        expect(consentRedirectRes.status).toBe(303);
        collectCookies(consentRedirectRes);
        const consentUid = extractInteractionUid(consentRedirectRes);

        // Approve consent
        const consentRes = await request(server).post(`/interaction/${consentUid}/consent`).set('Cookie', getCookieHeader()).send({ idToken, approved: true });
        expect(consentRes.status).toBe(200);
        expect(consentRes.body.redirectTo).toBeDefined();

        // Follow resume redirect → callback with code
        const resumeAfterConsentPath = new URL(consentRes.body.redirectTo).pathname + new URL(consentRes.body.redirectTo).search;
        const callbackRedirectRes = await request(server).get(resumeAfterConsentPath).set('Cookie', getCookieHeader()).redirects(0);
        expect(callbackRedirectRes.status).toBe(303);
        collectCookies(callbackRedirectRes);

        const callbackUrl = new URL(callbackRedirectRes.headers['location']);
        const authorizationCode = callbackUrl.searchParams.get('code')!;
        expect(authorizationCode).toBeDefined();

        return { authorizationCode, codeVerifier, cookieHeader: getCookieHeader() };
      }

      it('should complete authorization code flow with client_secret_jwt authentication', async () => {
        const server = app.getHttpServer();

        // 1. Create a client with client_secret_jwt auth method
        const { client_id, client_secret } = await oidcClientService.createClient({
          client_name: 'test-secret-jwt',
          redirect_uris: ['https://example.com/callback'],
          token_endpoint_auth_method: 'client_secret_jwt'
        });

        expect(client_secret).toBeDefined();

        // 2. Perform the auth code flow to get an authorization code
        const { authorizationCode, codeVerifier, cookieHeader } = await performAuthCodeFlow(server, client_id);

        // 3. Build a client_assertion JWT signed with the client_secret (HS256)
        const secretKey = new TextEncoder().encode(client_secret);
        const clientAssertion = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setIssuer(client_id).setSubject(client_id).setAudience(oidcModuleConfig.issuer).setJti(randomBytes(16).toString('hex')).setIssuedAt().setExpirationTime('1m').sign(secretKey);

        // 4. Exchange code for tokens using client_assertion
        const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
          grant_type: 'authorization_code',
          code: authorizationCode,
          redirect_uri: 'https://example.com/callback',
          client_id,
          code_verifier: codeVerifier,
          client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          client_assertion: clientAssertion
        });

        expect(tokenRes.status).toBe(200);

        expect(tokenRes.body.access_token).toBeDefined();
        expect(tokenRes.body.id_token).toBeDefined();
        expect(tokenRes.body.token_type).toBe('Bearer');

        // 5. Verify userinfo
        const userinfoRes = await request(server).get('/oidc/me').set('Authorization', `Bearer ${tokenRes.body.access_token}`).expect(200);
        expect(userinfoRes.body.sub).toBe(u.uid);
      });

      it('should complete authorization code flow with private_key_jwt authentication', async () => {
        const server = app.getHttpServer();

        // 1. Generate an RSA key pair for the client
        const { publicKey, privateKey } = await generateKeyPair('RS256');
        const publicJwk = await exportJWK(publicKey);
        const kid = randomBytes(8).toString('hex');
        publicJwk.kid = kid;
        publicJwk.use = 'sig';

        // 2. Register a client with private_key_jwt via the service, passing jwks as validatedMetadata
        const createResult = await oidcClientService.createClient(
          {
            client_name: 'test-private-key-jwt',
            redirect_uris: ['https://example.com/callback'],
            token_endpoint_auth_method: 'private_key_jwt'
          },
          { jwks: { keys: [publicJwk] } }
        );

        const clientId = createResult.client_id;
        expect(clientId).toBeDefined();
        // private_key_jwt clients should not receive a client_secret
        expect(createResult.client_secret).toBeUndefined();

        // 3. Perform the auth code flow to get an authorization code
        const { authorizationCode, codeVerifier, cookieHeader } = await performAuthCodeFlow(server, clientId);

        // 4. Build a client_assertion JWT signed with the private key (RS256)
        const clientAssertion = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid }).setIssuer(clientId).setSubject(clientId).setAudience(oidcModuleConfig.issuer).setJti(randomBytes(16).toString('hex')).setIssuedAt().setExpirationTime('1m').sign(privateKey);

        // 5. Exchange code for tokens using client_assertion
        const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
          grant_type: 'authorization_code',
          code: authorizationCode,
          redirect_uri: 'https://example.com/callback',
          client_id: clientId,
          code_verifier: codeVerifier,
          client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          client_assertion: clientAssertion
        });

        expect(tokenRes.status).toBe(200);

        expect(tokenRes.body.access_token).toBeDefined();
        expect(tokenRes.body.id_token).toBeDefined();
        expect(tokenRes.body.token_type).toBe('Bearer');

        // 6. Verify userinfo
        const userinfoRes = await request(server).get('/oidc/me').set('Authorization', `Bearer ${tokenRes.body.access_token}`).expect(200);
        expect(userinfoRes.body.sub).toBe(u.uid);
      });
    });
  });
});
