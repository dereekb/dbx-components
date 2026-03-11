import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import { type INestApplication } from '@nestjs/common';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { OidcModuleConfig, JwksServiceStorageConfig, type JwksService } from '@dereekb/firebase-server/oidc';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  let app: INestApplication;
  let jwksService: JwksService;
  let oidcModuleConfig: OidcModuleConfig;

  beforeEach(async () => {
    const serverContext = f.instance.apiServerNestContext;
    jwksService = serverContext.jwksService;
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
      it('should return 400 for a nonexistent interaction uid', async () => {
        await request(app.getHttpServer()).post('/interaction/nonexistent-uid/login').send({ idToken: 'fake-token' }).expect(400);
      });
    });

    describe('POST /interaction/:uid/consent', () => {
      it('should return 400 for a nonexistent interaction uid', async () => {
        await request(app.getHttpServer()).post('/interaction/nonexistent-uid/consent').send({ approved: false }).expect(400);
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
      it('should register a new client with valid metadata', async () => {
        const res = await request(app.getHttpServer())
          .post('/oidc/reg')
          .send({
            redirect_uris: ['https://example.com/callback'],
            response_types: ['code'],
            grant_types: ['authorization_code'],
            token_endpoint_auth_method: 'client_secret_post'
          })
          .expect(201);

        expect(res.body.client_id).toBeDefined();
        expect(res.body.client_secret).toBeDefined();
        expect(res.body.redirect_uris).toEqual(['https://example.com/callback']);
      });
    });
  });

  describe('OAuth authorization code flow', () => {
    demoAuthorizedUserContext({ f }, (u) => {
      /**
       * Helper to extract the path from an absolute redirect Location header.
       * oidc-provider uses the configured issuer host (http://localhost:4200) for redirects,
       * but our test server runs on a different port, so we strip the host.
       */
      function extractRedirectPath(res: request.Response): string {
        const location = res.headers['location'] as string;

        // If it's a relative path, return as-is
        if (location.startsWith('/')) {
          return location;
        }

        return new URL(location).pathname + new URL(location).search;
      }

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

        // 1. Register a client
        const regRes = await request(server)
          .post('/oidc/reg')
          .send({
            redirect_uris: ['https://example.com/callback'],
            response_types: ['code'],
            grant_types: ['authorization_code', 'refresh_token'],
            token_endpoint_auth_method: 'client_secret_post'
          })
          .expect(201);

        const { client_id, client_secret } = regRes.body;

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
            scope: 'openid email',
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

        // 4. Complete login - pass the real user UID as the idToken
        const loginRes = await request(server).post(`/interaction/${loginUid}/login`).set('Cookie', cookieHeader()).send({ idToken: u.uid }).redirects(0);
        expect(loginRes.status).toBe(303);
        collectCookies(loginRes);

        // 5. Follow the resume redirect back to the provider
        const resumeAfterLoginPath = extractRedirectPath(loginRes);
        const consentRedirectRes = await request(server).get(resumeAfterLoginPath).set('Cookie', cookieHeader()).redirects(0);

        expect(consentRedirectRes.status).toBe(303);
        collectCookies(consentRedirectRes);
        const consentUid = extractInteractionUid(consentRedirectRes);
        expect(consentUid).toBeDefined();

        // 6. Approve consent
        const consentRes = await request(server).post(`/interaction/${consentUid}/consent`).set('Cookie', cookieHeader()).send({ approved: true }).redirects(0);
        expect(consentRes.status).toBe(303);
        collectCookies(consentRes);

        // 7. Follow the resume redirect - provider should redirect to callback with code
        const resumeAfterConsentPath = extractRedirectPath(consentRes);
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

        // 9. Use the access token to fetch userinfo
        const userinfoRes = await request(server).get('/oidc/me').set('Authorization', `Bearer ${tokenRes.body.access_token}`).expect(200);

        expect(userinfoRes.body.sub).toBe(u.uid);
      });
    });
  });
});
