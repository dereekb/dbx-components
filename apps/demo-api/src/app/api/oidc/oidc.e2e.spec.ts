import request from 'supertest';
import { createHash, randomBytes } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { SignJWT, exportJWK, generateKeyPair, decodeJwt } from 'jose';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoAuthorizedUserAdminContext } from '../../../test/fixture';
import { OidcModuleConfig, JwksServiceStorageConfig, type JwksService, type OidcService, type OidcClientService } from '@dereekb/firebase-server/oidc';
import { McpModuleConfig } from '@dereekb/firebase-server/mcp';
import { unixDateTimeSecondsNumberForNow } from '@dereekb/util';
import { callableRequestTest } from '@dereekb/firebase-server/test';
import { type DeleteOidcTokenParams, firestoreModelKey, oidcEntriesByUidQuery, oidcEntryIdentity, onCallDeleteModelParams } from '@dereekb/firebase';
import { demoCallModel } from '../../function/model/crud.functions';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

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
  let mcpModuleConfig: McpModuleConfig;

  beforeEach(async () => {
    const serverContext = f.instance.apiServerNestContext;
    jwksService = serverContext.jwksService;
    oidcService = serverContext.oidcService;
    oidcClientService = serverContext.oidcClientService;
    oidcModuleConfig = f.instance.nest.get(OidcModuleConfig);
    mcpModuleConfig = f.instance.nest.get(McpModuleConfig);

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

      it('should never advertise alg=none for id_token signing', async () => {
        const res = await request(app.getHttpServer()).get('/.well-known/openid-configuration').expect(200);

        expect(res.body.id_token_signing_alg_values_supported).toBeDefined();
        expect(res.body.id_token_signing_alg_values_supported).toContain('RS256');
        expect(res.body.id_token_signing_alg_values_supported).not.toContain('none');
      });

      it('should advertise only S256 for code_challenge_methods', async () => {
        const res = await request(app.getHttpServer()).get('/.well-known/openid-configuration').expect(200);

        expect(res.body.code_challenge_methods_supported).toEqual(['S256']);
        expect(res.body.code_challenge_methods_supported).not.toContain('plain');
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
      it('should return authorization_servers with the issuer and resource with the MCP URL', async () => {
        const res = await request(app.getHttpServer()).get('/.well-known/oauth-protected-resource').expect(200);

        expect(res.body.authorization_servers).toEqual([oidcModuleConfig.issuer]);
        expect(res.body.resource).toBe(mcpModuleConfig.mcpUrl);
      });
    });
  });

  // The protected-resource discovery doc advertises `mcpModuleConfig.mcpUrl` as the
  // resource indicator that clients must pass to /authorize and /token. The OIDC
  // provider rejects any unknown resource indicator with `invalid_target`, so the
  // advertised mcpUrl MUST appear as a key in `oidcModuleConfig.resourceServers`
  // or every Claude/mcp-inspector auth attempt will fail before consent.
  describe('MCP resource indicator wiring (RFC 8707 + RFC 9728)', () => {
    it('exposes the advertised mcpUrl as a registered resource server on the OIDC provider', () => {
      expect(mcpModuleConfig.mcpUrl).toBeDefined();
      expect(oidcModuleConfig.resourceServers).toBeDefined();
      expect(oidcModuleConfig.resourceServers![mcpModuleConfig.mcpUrl]).toBeDefined();
    });

    it('derives the protected-resource metadata URL from the same origin as mcpUrl', () => {
      expect(oidcModuleConfig.resourceMetadataUrl).toBeDefined();
      expect(new URL(oidcModuleConfig.resourceMetadataUrl!).origin).toBe(new URL(mcpModuleConfig.mcpUrl).origin);
    });
  });

  describe('POST /mcp (OIDC-protected)', () => {
    it('returns 401 with WWW-Authenticate Bearer challenge when no token is presented', async () => {
      const res = await request(app.getHttpServer()).post('/mcp').send({}).expect(401);

      expect(res.headers['www-authenticate']).toBeDefined();
      expect(res.headers['www-authenticate']).toMatch(/^Bearer\b/);
      expect(res.headers['www-authenticate']).toMatch(/error="invalid_request"/);
    });

    it('returns 401 with WWW-Authenticate including resource_metadata when configured', async () => {
      if (!oidcModuleConfig.resourceMetadataUrl) {
        // resource_metadata is only emitted when oidcModuleConfig.resourceMetadataUrl is set
        // (which requires envService.appMcpUrl). Skip when the test env doesn't configure it.
        return;
      }

      const res = await request(app.getHttpServer()).post('/mcp').send({}).expect(401);
      expect(res.headers['www-authenticate']).toContain(`resource_metadata="${oidcModuleConfig.resourceMetadataUrl}"`);
    });
  });

  // Regression coverage for the exact failure mode reported when the demo's MCP
  // URL was unified on http://localhost:9010/mcp: hitting /oidc/auth with the
  // configured resource parameter returned `server_error` instead of starting
  // the login interaction. The OIDC provider must accept the advertised
  // resource indicator and 303-redirect to /interaction/<uid>/login.
  describe('GET /oidc/auth with `resource` (RFC 8707)', () => {
    async function startAuthRequestWithResource(resource: string, scope: string = 'openid email demo'): Promise<request.Response> {
      const { client_id } = await oidcClientService.createClient({
        client_name: 'mcp-resource-test',
        redirect_uris: ['https://example.com/callback'],
        token_endpoint_auth_method: 'client_secret_post'
      });

      const codeVerifier = randomBytes(32).toString('base64url');
      const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

      return request(app.getHttpServer())
        .get('/oidc/auth')
        .query({
          client_id,
          redirect_uri: 'https://example.com/callback',
          response_type: 'code',
          scope,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          state: 'mcp-resource-state',
          resource
        })
        .redirects(0);
    }

    it('303-redirects to the configured app-side OAuth interaction UI when the resource is a registered resource server', async () => {
      const authRes = await startAuthRequestWithResource(mcpModuleConfig.mcpUrl);

      expect(authRes.status).toBe(303);
      // The demo wires `appOAuthInteractionPath`, so oidc-provider redirects through the
      // app's SPA route (e.g. `/demo/oauth/login`) rather than the default `/interaction/<uid>`.
      // What matters for this regression test is that the response is NOT an error callback
      // and IS a login-step redirect with a `uid` query param.
      const location = authRes.headers['location'];
      expect(location).toBeDefined();
      const locationUrl = new URL(location, 'http://localhost');
      expect(locationUrl.searchParams.get('uid')).toBeDefined();
      expect(locationUrl.searchParams.get('error')).toBeNull();
      // crucially, not a server_error JSON response
      expect(authRes.body?.error).toBeUndefined();
    });

    it('redirects to the callback with error=invalid_target when the resource is unknown', async () => {
      const authRes = await startAuthRequestWithResource('https://attacker.example/mcp', 'openid');

      // oidc-provider sends invalid_target back to the callback URL via 303
      expect(authRes.status).toBe(303);
      const location = authRes.headers['location'];
      const url = new URL(location);
      expect(url.searchParams.get('error')).toBe('invalid_target');
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

      it('should reject an empty Bearer header', async () => {
        const res = await request(app.getHttpServer()).get('/oidc/me').set('Authorization', 'Bearer ');

        // 400 (malformed bearer) or 401 (no credentials) — both prevent issuing userinfo.
        expect([400, 401]).toContain(res.status);
      });

      it('should reject a Basic auth header (Bearer required)', async () => {
        const res = await request(app.getHttpServer())
          .get('/oidc/me')
          .set('Authorization', `Basic ${Buffer.from('user:pass').toString('base64')}`);

        expect([400, 401]).toContain(res.status);
      });

      it('should return 401 with an alg=none JWT bearer token', async () => {
        const now = unixDateTimeSecondsNumberForNow();
        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
        const body = Buffer.from(JSON.stringify({ sub: 'attacker', iss: oidcModuleConfig.issuer, aud: oidcModuleConfig.issuer, scope: 'openid demo', iat: now, exp: now + 3600 })).toString('base64url');
        const fakeToken = `${header}.${body}.`;

        await request(app.getHttpServer()).get('/oidc/me').set('Authorization', `Bearer ${fakeToken}`).expect(401);
      });

      it('should return 401 with a JWT signed by an unrelated RSA key', async () => {
        const { privateKey } = await generateKeyPair('RS256');
        const fakeToken = await new SignJWT({ scope: 'openid demo' }).setProtectedHeader({ alg: 'RS256' }).setIssuer(oidcModuleConfig.issuer).setSubject('attacker').setAudience(oidcModuleConfig.issuer).setIssuedAt().setExpirationTime('1m').sign(privateKey);

        await request(app.getHttpServer()).get('/oidc/me').set('Authorization', `Bearer ${fakeToken}`).expect(401);
      });
    });

    describe('GET /oidc/login/client', () => {
      it('redirects to a well-formed URL when extra query params are forwarded', async () => {
        const res = await request(app.getHttpServer()).get('/oidc/login/client').query({ uid: 'abc-123', extra: 'a&b=c', percent: 'a%26b' }).redirects(0);

        expect([301, 302, 303, 307, 308]).toContain(res.status);

        const location = res.headers['location'];
        expect(location).toBeDefined();
        // No CRLF that would allow header injection.
        expect(location).not.toContain('\r');
        expect(location).not.toContain('\n');
        // At most a single `?` separator (further params use `&`).
        const questionMarks = (location.match(/\?/g) ?? []).length;
        expect(questionMarks).toBeLessThanOrEqual(1);

        const target = new URL(location, 'http://localhost');
        expect(target.searchParams.get('uid')).toBe('abc-123');
      });
    });

    describe('Client storage encryption at rest', () => {
      it('does not store client_secret as plaintext in Firestore', async () => {
        const { client_id, client_secret } = await oidcClientService.createClient({
          client_name: 'encryption-at-rest-test',
          redirect_uris: ['https://example.com/callback'],
          token_endpoint_auth_method: 'client_secret_post'
        });

        expect(client_secret).toBeDefined();
        expect(typeof client_secret).toBe('string');
        expect(client_secret!.length).toBeGreaterThan(0);

        const oidcEntryCollection = f.instance.demoFirestoreCollections.oidcEntryCollection;
        const clientDoc = await oidcEntryCollection.documentAccessor().loadDocumentForId(client_id).accessor.get();
        const clientData = clientDoc.data();

        expect(clientData).toBeDefined();
        expect(clientData!.type).toBe('Client');

        const storedPayload = clientData!.payload as Record<string, unknown>;
        expect(storedPayload.client_id).toBe(client_id);
        // selectiveFieldEncryptor strips the original plaintext key and stores the ciphertext
        // under the `$<field>` prefixed key. So `client_secret` must be absent and
        // `$client_secret` must hold the encrypted value.
        expect(storedPayload).not.toHaveProperty('client_secret');
        expect(storedPayload).toHaveProperty('$client_secret');

        const encrypted = storedPayload['$client_secret'];
        expect(typeof encrypted).toBe('string');
        expect(encrypted).not.toBe(client_secret);
        expect((encrypted as string).length).toBeGreaterThan(0);
      });
    });

    describe('POST /oidc/reg (dynamic client registration)', () => {
      it('should register a public client (PKCE) returning a client_id without a secret', async () => {
        const res = await request(app.getHttpServer())
          .post('/oidc/reg')
          .set('Content-Type', 'application/json')
          .send({
            redirect_uris: ['http://localhost:62676/callback'],
            response_types: ['code'],
            grant_types: ['authorization_code', 'refresh_token'],
            token_endpoint_auth_method: 'none',
            scope: 'openid offline_access profile email'
          });

        expect(res.status).toBe(201);
        expect(res.body.client_id).toBeDefined();
        // public/PKCE clients must not be issued a secret
        expect(res.body.client_secret).toBeUndefined();
        expect(res.body.token_endpoint_auth_method).toBe('none');
      });
    });
  });

  describe('OAuth authorization code flow', () => {
    demoAuthorizedUserContext({ f }, (u) => {
      /**
       * Extract the interaction UID from a redirect to the login/consent frontend URL.
       */
      function extractInteractionUid(res: request.Response): string {
        const location = res.headers['location'];
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
      // eslint-disable-next-line @typescript-eslint/max-params -- positional args are clearer than a config object for this test helper
      async function performAuthCodeFlow(server: ReturnType<INestApplication['getHttpServer']>, clientId: string, scope: string = 'openid email demo', extraAuthParams: Record<string, string | number> = {}): Promise<{ authorizationCode: string; codeVerifier: string; cookieHeader: string }> {
        // Per OIDC core spec, requesting `offline_access` only persists if the auth request also asks
        // for `prompt=consent`; otherwise oidc-provider's check_scope middleware silently strips it.
        // Mirror real-client behavior so refresh-token assertions are meaningful.
        const requiresConsentPrompt = scope.split(' ').includes('offline_access');
        const promptParams: Record<string, string | number> = requiresConsentPrompt && extraAuthParams['prompt'] === undefined ? { prompt: 'consent' } : {};
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
            scope,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            state: 'test-state',
            nonce: 'test-nonce',
            ...promptParams,
            ...extraAuthParams
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

      describe('custom dbx_session_ttl auth-URL param', () => {
        const ONE_HOUR = 60 * 60;
        const ONE_DAY = 24 * 60 * 60;
        const SLACK_SECONDS = 30; // wall-clock slack

        it('returns the configured-default refresh-token expiry when no dbx_session_ttl is provided', async () => {
          const server = app.getHttpServer();
          const { client_id, client_secret } = await oidcClientService.createClient({
            client_name: 'ttl-default-test',
            redirect_uris: ['https://example.com/callback'],
            token_endpoint_auth_method: 'client_secret_post'
          });

          const { authorizationCode, codeVerifier, cookieHeader } = await performAuthCodeFlow(server, client_id, 'openid email demo offline_access');
          const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
            grant_type: 'authorization_code',
            code: authorizationCode,
            redirect_uri: 'https://example.com/callback',
            client_id,
            client_secret,
            code_verifier: codeVerifier
          });

          expect(tokenRes.status).toBe(200);
          expect(tokenRes.body.refresh_token).toBeDefined();

          // Default should be 30 days (post-change), well above the previous 14-day cap.
          const refreshTokenDocs = await f.instance.demoFirestoreCollections.oidcEntryCollection.query(oidcEntriesByUidQuery('RefreshToken', u.uid)).getDocs();
          expect(refreshTokenDocs.empty).toBe(false);
        });

        it('honors a requested dbx_session_ttl by issuing tokens with the requested lifetime', async () => {
          const server = app.getHttpServer();
          const { client_id, client_secret } = await oidcClientService.createClient({
            client_name: 'ttl-honor-test',
            redirect_uris: ['https://example.com/callback'],
            token_endpoint_auth_method: 'client_secret_post'
          });

          const requested = 2 * ONE_DAY;
          const { authorizationCode, codeVerifier, cookieHeader } = await performAuthCodeFlow(server, client_id, 'openid email demo offline_access', { dbx_session_ttl: requested });
          const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
            grant_type: 'authorization_code',
            code: authorizationCode,
            redirect_uri: 'https://example.com/callback',
            client_id,
            client_secret,
            code_verifier: codeVerifier
          });

          expect(tokenRes.status).toBe(200);
          // Refresh-token lifetime is `min(requested, tokenLifetimes.refreshToken)` on initial issuance.
          // tokenLifetimes.refreshToken default is 30d, requested is 2d → expect ~2d.
          // The Grant TTL stored on disk reflects the requested duration.
          const grantDocs = await f.instance.demoFirestoreCollections.oidcEntryCollection.query(oidcEntriesByUidQuery('Grant', u.uid)).getDocs();
          expect(grantDocs.empty).toBe(false);

          const grantPayload = grantDocs.docs[0].data().payload as { exp: number; iat: number };
          const grantTtl = grantPayload.exp - grantPayload.iat;
          expect(grantTtl).toBeGreaterThanOrEqual(requested - SLACK_SECONDS);
          expect(grantTtl).toBeLessThanOrEqual(requested + SLACK_SECONDS);
        });

        it('clamps dbx_session_ttl down to the per-client maximum', async () => {
          const server = app.getHttpServer();
          const clientCap = 4 * ONE_DAY;
          const { client_id, client_secret } = await oidcClientService.createClient({
            client_name: 'ttl-client-cap-test',
            redirect_uris: ['https://example.com/callback'],
            token_endpoint_auth_method: 'client_secret_post',
            dbx_max_session_ttl: clientCap
          });

          const { authorizationCode, codeVerifier, cookieHeader } = await performAuthCodeFlow(server, client_id, 'openid email demo offline_access', { dbx_session_ttl: 60 * ONE_DAY });
          const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
            grant_type: 'authorization_code',
            code: authorizationCode,
            redirect_uri: 'https://example.com/callback',
            client_id,
            client_secret,
            code_verifier: codeVerifier
          });

          expect(tokenRes.status).toBe(200);

          const grantDocs = await f.instance.demoFirestoreCollections.oidcEntryCollection.query(oidcEntriesByUidQuery('Grant', u.uid)).getDocs();
          const grantPayload = grantDocs.docs[0].data().payload as { exp: number; iat: number };
          const grantTtl = grantPayload.exp - grantPayload.iat;
          expect(grantTtl).toBeGreaterThanOrEqual(clientCap - SLACK_SECONDS);
          expect(grantTtl).toBeLessThanOrEqual(clientCap + SLACK_SECONDS);
        });

        it('clamps a sub-floor dbx_session_ttl up to the server minimum (1 hour)', async () => {
          const server = app.getHttpServer();
          const { client_id, client_secret } = await oidcClientService.createClient({
            client_name: 'ttl-floor-test',
            redirect_uris: ['https://example.com/callback'],
            token_endpoint_auth_method: 'client_secret_post'
          });

          const { authorizationCode, codeVerifier, cookieHeader } = await performAuthCodeFlow(server, client_id, 'openid email demo offline_access', { dbx_session_ttl: 60 });
          const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
            grant_type: 'authorization_code',
            code: authorizationCode,
            redirect_uri: 'https://example.com/callback',
            client_id,
            client_secret,
            code_verifier: codeVerifier
          });

          expect(tokenRes.status).toBe(200);

          const grantDocs = await f.instance.demoFirestoreCollections.oidcEntryCollection.query(oidcEntriesByUidQuery('Grant', u.uid)).getDocs();
          const grantPayload = grantDocs.docs[0].data().payload as { exp: number; iat: number };
          const grantTtl = grantPayload.exp - grantPayload.iat;
          expect(grantTtl).toBeGreaterThanOrEqual(ONE_HOUR - SLACK_SECONDS);
          expect(grantTtl).toBeLessThanOrEqual(ONE_HOUR + SLACK_SECONDS);
        });

        it('rejects creating a client with dbx_max_session_ttl above the server max', async () => {
          const aboveServerMax = 365 * ONE_DAY;
          await expect(
            oidcClientService.createClient({
              client_name: 'ttl-too-high',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post',
              dbx_max_session_ttl: aboveServerMax
            })
          ).rejects.toThrow();
        });
      });

      describe('grant revocation through callModel', () => {
        callableRequestTest({ f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
          it('should revoke a Grant via callModel and stop the refresh token from being exchanged', async () => {
            const server = app.getHttpServer();

            // 1. Register a client (defaults to grant_types: ['authorization_code', 'refresh_token']).
            const { client_id, client_secret } = await oidcClientService.createClient({
              client_name: 'revoke-test',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            // 2. Run the auth-code flow with offline_access so a refresh token is issued.
            const { authorizationCode, codeVerifier, cookieHeader } = await performAuthCodeFlow(server, client_id, 'openid email demo offline_access');

            const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
              grant_type: 'authorization_code',
              code: authorizationCode,
              redirect_uri: 'https://example.com/callback',
              client_id,
              client_secret,
              code_verifier: codeVerifier
            });

            expect(tokenRes.status).toBe(200);
            expect(tokenRes.body.access_token).toBeDefined();
            expect(tokenRes.body.refresh_token).toBeDefined();

            const originalAccessToken = tokenRes.body.access_token as string;
            const refreshToken = tokenRes.body.refresh_token as string;

            // Sanity: the access token verifies before revocation.
            const beforeAuthData = await oidcService.verifyAccessToken(originalAccessToken);
            expect(beforeAuthData?.uid).toBe(u.uid);

            // 3. The refresh token can be exchanged for a new access token while the grant exists.
            const firstRefreshRes = await request(server).post('/oidc/token').type('form').send({
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
              client_id,
              client_secret
            });

            expect(firstRefreshRes.status).toBe(200);
            expect(firstRefreshRes.body.access_token).toBeDefined();

            // 4. Find the Grant entry issued to this user.
            const oidcEntryCollection = f.instance.demoFirestoreCollections.oidcEntryCollection;
            const grantDocs = await oidcEntryCollection.query(oidcEntriesByUidQuery('Grant', u.uid)).getDocs();

            expect(grantDocs.empty).toBe(false);
            const grantDoc = grantDocs.docs[0];
            const grantId = grantDoc.id;
            const grantKey = firestoreModelKey(oidcEntryIdentity, grantId);

            // 5. Revoke through the callModel deleteOidcEntry → token specifier.
            const revokeParams: DeleteOidcTokenParams = { key: grantKey };
            await u.callWrappedFunction(demoCallModelWrappedFn, onCallDeleteModelParams(oidcEntryIdentity, revokeParams, 'token'));

            // 6. Grant entry is gone, and the cascade deleted the RefreshToken row tied to it.
            const grantStillExists = await oidcEntryCollection.documentAccessor().loadDocumentForId(grantId).accessor.exists();
            expect(grantStillExists).toBe(false);

            const refreshTokenDocs = await oidcEntryCollection.query(oidcEntriesByUidQuery('RefreshToken', u.uid)).getDocs();
            expect(refreshTokenDocs.empty).toBe(true);

            // 7. Trying to use the refresh token now fails with invalid_grant.
            const secondRefreshRes = await request(server).post('/oidc/token').type('form').send({
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
              client_id,
              client_secret
            });

            expect(secondRefreshRes.status).toBe(400);
            expect(secondRefreshRes.body.error).toBe('invalid_grant');

            // 8. The originally-issued access token can no longer be verified.
            const afterAuthData = await oidcService.verifyAccessToken(originalAccessToken);
            expect(afterAuthData).toBeUndefined();
          });
        });
      });

      describe('security regressions', () => {
        describe('redirect_uri exact-match enforcement', () => {
          let registeredClientId: string;

          beforeEach(async () => {
            const created = await oidcClientService.createClient({
              client_name: 'redirect-uri-test',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            registeredClientId = created.client_id;
          });

          async function expectAuthRedirectUriRejected(redirectUri: string): Promise<void> {
            const codeVerifier = randomBytes(32).toString('base64url');
            const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
            const res = await request(app.getHttpServer())
              .get('/oidc/auth')
              .query({
                client_id: registeredClientId,
                redirect_uri: redirectUri,
                response_type: 'code',
                scope: 'openid email demo',
                code_challenge: codeChallenge,
                code_challenge_method: 'S256',
                state: 'test-state',
                nonce: 'test-nonce'
              })
              .redirects(0);

            // Per RFC 6749, when redirect_uri is invalid the provider MUST NOT redirect to it.
            // oidc-provider returns 400 with an error page rather than amplifying the attack.
            expect(res.status).toBe(400);
            // Defensive: even if a redirect was emitted somehow, it must not point at the attacker URI.
            const location = res.headers['location'] as string | undefined;

            if (location) {
              expect(location.startsWith(redirectUri)).toBe(false);
            }
          }

          it('rejects suffix-extended redirect_uri', async () => {
            await expectAuthRedirectUriRejected('https://example.com/callback/extra');
          });

          it('rejects host-suffix bypass redirect_uri', async () => {
            await expectAuthRedirectUriRejected('https://example.com.evil.com/callback');
          });

          it('rejects redirect_uri with extra query string', async () => {
            await expectAuthRedirectUriRejected('https://example.com/callback?attacker=1');
          });
        });

        describe('PKCE enforcement', () => {
          let pkceClientId: string;
          let pkceClientSecret: string;

          beforeEach(async () => {
            const created = await oidcClientService.createClient({
              client_name: 'pkce-test',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            pkceClientId = created.client_id;
            pkceClientSecret = created.client_secret!;
          });

          it('rejects /oidc/auth without code_challenge', async () => {
            const res = await request(app.getHttpServer())
              .get('/oidc/auth')
              .query({
                client_id: pkceClientId,
                redirect_uri: 'https://example.com/callback',
                response_type: 'code',
                scope: 'openid email demo',
                state: 'test-state',
                nonce: 'test-nonce'
              })
              .redirects(0);

            // oidc-provider redirects to the registered redirect_uri with `error=invalid_request`
            // when PKCE is required. Some configs return 400 instead — accept both shapes.
            if (res.status === 303 || res.status === 302) {
              const location = new URL(res.headers['location']);
              expect(location.searchParams.get('error')).toBe('invalid_request');
            } else {
              expect(res.status).toBe(400);
            }
          });

          it('rejects /oidc/auth with code_challenge_method=plain', async () => {
            const codeVerifier = randomBytes(32).toString('base64url');
            const res = await request(app.getHttpServer())
              .get('/oidc/auth')
              .query({
                client_id: pkceClientId,
                redirect_uri: 'https://example.com/callback',
                response_type: 'code',
                scope: 'openid email demo',
                code_challenge: codeVerifier,
                code_challenge_method: 'plain',
                state: 'test-state',
                nonce: 'test-nonce'
              })
              .redirects(0);

            if (res.status === 303 || res.status === 302) {
              const location = new URL(res.headers['location']);
              expect(location.searchParams.get('error')).toBe('invalid_request');
            } else {
              expect(res.status).toBe(400);
            }
          });

          it('rejects /oidc/token exchange with a wrong code_verifier', async () => {
            const server = app.getHttpServer();
            const { authorizationCode, cookieHeader } = await performAuthCodeFlow(server, pkceClientId);

            const wrongVerifier = randomBytes(32).toString('base64url');
            const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
              grant_type: 'authorization_code',
              code: authorizationCode,
              redirect_uri: 'https://example.com/callback',
              client_id: pkceClientId,
              client_secret: pkceClientSecret,
              code_verifier: wrongVerifier
            });

            expect(tokenRes.status).toBe(400);
            expect(tokenRes.body.error).toBe('invalid_grant');
          });

          it('rejects /oidc/token exchange omitting code_verifier', async () => {
            const server = app.getHttpServer();
            const { authorizationCode, cookieHeader } = await performAuthCodeFlow(server, pkceClientId);

            const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
              grant_type: 'authorization_code',
              code: authorizationCode,
              redirect_uri: 'https://example.com/callback',
              client_id: pkceClientId,
              client_secret: pkceClientSecret
            });

            expect(tokenRes.status).toBe(400);
            expect(tokenRes.body.error).toBe('invalid_grant');
          });
        });

        describe('authorization code reuse / replay', () => {
          it('rejects re-redemption of an authorization code and revokes the issued tokens', async () => {
            const server = app.getHttpServer();
            const { client_id, client_secret } = await oidcClientService.createClient({
              client_name: 'replay-test',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            const { authorizationCode, codeVerifier, cookieHeader } = await performAuthCodeFlow(server, client_id);

            // First exchange succeeds.
            const firstRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
              grant_type: 'authorization_code',
              code: authorizationCode,
              redirect_uri: 'https://example.com/callback',
              client_id,
              client_secret,
              code_verifier: codeVerifier
            });

            expect(firstRes.status).toBe(200);
            expect(firstRes.body.access_token).toBeDefined();
            const issuedAccessToken = firstRes.body.access_token as string;

            // Second exchange with the same code is rejected as invalid_grant.
            const secondRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
              grant_type: 'authorization_code',
              code: authorizationCode,
              redirect_uri: 'https://example.com/callback',
              client_id,
              client_secret,
              code_verifier: codeVerifier
            });

            expect(secondRes.status).toBe(400);
            expect(secondRes.body.error).toBe('invalid_grant');

            // The originally-issued access token must no longer verify (oidc-provider revokes
            // the entire grant on detected code reuse).
            const replayedAuthData = await oidcService.verifyAccessToken(issuedAccessToken);
            expect(replayedAuthData).toBeUndefined();
          });
        });

        describe('cross-client code redemption', () => {
          it('rejects exchange of clientA code presented with clientB credentials', async () => {
            const server = app.getHttpServer();
            const { client_id: clientIdA } = await oidcClientService.createClient({
              client_name: 'cross-client-A',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            const clientB = await oidcClientService.createClient({
              client_name: 'cross-client-B',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            const { authorizationCode, codeVerifier, cookieHeader } = await performAuthCodeFlow(server, clientIdA);

            const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
              grant_type: 'authorization_code',
              code: authorizationCode,
              redirect_uri: 'https://example.com/callback',
              client_id: clientB.client_id,
              client_secret: clientB.client_secret,
              code_verifier: codeVerifier
            });

            expect(tokenRes.status).toBe(400);
            expect(['invalid_grant', 'invalid_client']).toContain(tokenRes.body.error);
          });
        });

        describe('partial consent (scope deselection)', () => {
          /**
           * Runs the auth code flow through to the consent submit, posts a
           * caller-provided consent body, and returns the response so tests
           * can inspect or continue the flow as needed.
           */
          // eslint-disable-next-line @typescript-eslint/max-params -- mirrors performAuthCodeFlow shape
          async function performAuthCodeFlowToConsent(server: ReturnType<INestApplication['getHttpServer']>, clientId: string, consentBody: Record<string, unknown>, scope = 'openid email demo', extraAuthParams: Record<string, string | number> = {}, initialCookieHeader = ''): Promise<{ consentResponse: request.Response; cookieHeader: string; codeVerifier: string; idToken: string }> {
            const cookieJar = new Map<string, string>();

            // Pre-seed cookies so a follow-up flow can reuse the prior flow's session (carrying
            // `session.grantIdFor(clientId)` to oidc-provider's loadExistingGrant).
            if (initialCookieHeader) {
              for (const cookie of initialCookieHeader.split('; ')) {
                if (cookie) {
                  const [name] = cookie.split('=');
                  cookieJar.set(name, cookie);
                }
              }
            }

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

            const authRes = await request(server)
              .get('/oidc/auth')
              .query({
                client_id: clientId,
                redirect_uri: 'https://example.com/callback',
                response_type: 'code',
                scope,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256',
                state: 'test-state',
                nonce: 'test-nonce',
                ...extraAuthParams
              })
              .redirects(0);

            expect(authRes.status).toBe(303);
            collectCookies(authRes);
            const loginUid = extractInteractionUid(authRes);

            const idToken = await createTestIdToken(app, u.uid);
            const loginRes = await request(server).post(`/interaction/${loginUid}/login`).set('Cookie', getCookieHeader()).send({ idToken });
            expect(loginRes.status).toBe(200);

            const resumeAfterLoginPath = new URL(loginRes.body.redirectTo).pathname + new URL(loginRes.body.redirectTo).search;
            const consentRedirectRes = await request(server).get(resumeAfterLoginPath).set('Cookie', getCookieHeader()).redirects(0);
            expect(consentRedirectRes.status).toBe(303);
            collectCookies(consentRedirectRes);
            const consentUid = extractInteractionUid(consentRedirectRes);

            const consentResponse = await request(server)
              .post(`/interaction/${consentUid}/consent`)
              .set('Cookie', getCookieHeader())
              .send({ idToken, ...consentBody });

            collectCookies(consentResponse);

            return { consentResponse, cookieHeader: getCookieHeader(), codeVerifier, idToken };
          }

          /**
           * Continues from a successful consent response through the OAuth
           * callback redirect to extract an authorization code.
           */
          async function exchangeConsentForAuthorizationCode(server: ReturnType<INestApplication['getHttpServer']>, consentResponse: request.Response, cookieHeader: string): Promise<string> {
            expect(consentResponse.status).toBe(200);
            expect(consentResponse.body.redirectTo).toBeDefined();

            const resumeAfterConsentPath = new URL(consentResponse.body.redirectTo).pathname + new URL(consentResponse.body.redirectTo).search;
            const callbackRedirectRes = await request(server).get(resumeAfterConsentPath).set('Cookie', cookieHeader).redirects(0);
            expect(callbackRedirectRes.status).toBe(303);

            const callbackUrl = new URL(callbackRedirectRes.headers['location']);
            const authorizationCode = callbackUrl.searchParams.get('code')!;
            expect(authorizationCode).toBeDefined();
            return authorizationCode;
          }

          it('grants only the subset of scopes the user selected', async () => {
            const server = app.getHttpServer();
            const { client_id, client_secret } = await oidcClientService.createClient({
              client_name: 'partial-consent-subset',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            const { consentResponse, cookieHeader, codeVerifier } = await performAuthCodeFlowToConsent(server, client_id, { approved: true, grantedOIDCScopes: ['openid', 'email'] });

            const authorizationCode = await exchangeConsentForAuthorizationCode(server, consentResponse, cookieHeader);

            const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
              grant_type: 'authorization_code',
              code: authorizationCode,
              redirect_uri: 'https://example.com/callback',
              client_id,
              client_secret,
              code_verifier: codeVerifier
            });

            expect(tokenRes.status).toBe(200);
            const grantedScopes = (tokenRes.body.scope as string | undefined)?.split(' ') ?? [];
            expect(grantedScopes).toContain('openid');
            expect(grantedScopes).toContain('email');
            expect(grantedScopes).not.toContain('demo');
          });

          it('rejects a granted scope that was not in the original request', async () => {
            const server = app.getHttpServer();
            const { client_id } = await oidcClientService.createClient({
              client_name: 'partial-consent-extra-scope',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            const { consentResponse } = await performAuthCodeFlowToConsent(server, client_id, { approved: true, grantedOIDCScopes: ['openid', 'email', 'unrequested-scope'] });

            expect(consentResponse.status).toBe(400);
          });

          it('always grants `openid` even when the client omits it from grantedOIDCScopes', async () => {
            const server = app.getHttpServer();
            const { client_id, client_secret } = await oidcClientService.createClient({
              client_name: 'partial-consent-implicit-openid',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            const { consentResponse, cookieHeader, codeVerifier } = await performAuthCodeFlowToConsent(server, client_id, { approved: true, grantedOIDCScopes: ['email'] });

            const authorizationCode = await exchangeConsentForAuthorizationCode(server, consentResponse, cookieHeader);

            const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
              grant_type: 'authorization_code',
              code: authorizationCode,
              redirect_uri: 'https://example.com/callback',
              client_id,
              client_secret,
              code_verifier: codeVerifier
            });

            expect(tokenRes.status).toBe(200);
            const grantedScopes = (tokenRes.body.scope as string | undefined)?.split(' ') ?? [];
            expect(grantedScopes).toContain('openid');
            expect(grantedScopes).toContain('email');
            expect(grantedScopes).not.toContain('demo');
          });

          it('still grants `openid` when grantedOIDCScopes is an empty array', async () => {
            const server = app.getHttpServer();
            const { client_id, client_secret } = await oidcClientService.createClient({
              client_name: 'partial-consent-empty-array',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            const { consentResponse, cookieHeader, codeVerifier } = await performAuthCodeFlowToConsent(server, client_id, { approved: true, grantedOIDCScopes: [] });

            const authorizationCode = await exchangeConsentForAuthorizationCode(server, consentResponse, cookieHeader);

            const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
              grant_type: 'authorization_code',
              code: authorizationCode,
              redirect_uri: 'https://example.com/callback',
              client_id,
              client_secret,
              code_verifier: codeVerifier
            });

            expect(tokenRes.status).toBe(200);
            const grantedScopes = (tokenRes.body.scope as string | undefined)?.split(' ') ?? [];
            expect(grantedScopes).toContain('openid');
            expect(grantedScopes).not.toContain('email');
            expect(grantedScopes).not.toContain('demo');
          });

          it('preserves the existing all-or-nothing behavior when grantedOIDCScopes is omitted', async () => {
            const server = app.getHttpServer();
            const { client_id, client_secret } = await oidcClientService.createClient({
              client_name: 'partial-consent-back-compat',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            const { consentResponse, cookieHeader, codeVerifier } = await performAuthCodeFlowToConsent(server, client_id, { approved: true });

            const authorizationCode = await exchangeConsentForAuthorizationCode(server, consentResponse, cookieHeader);

            const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
              grant_type: 'authorization_code',
              code: authorizationCode,
              redirect_uri: 'https://example.com/callback',
              client_id,
              client_secret,
              code_verifier: codeVerifier
            });

            expect(tokenRes.status).toBe(200);
            const grantedScopes = (tokenRes.body.scope as string | undefined)?.split(' ') ?? [];
            expect(grantedScopes).toContain('openid');
            expect(grantedScopes).toContain('email');
            expect(grantedScopes).toContain('demo');
          });

          it('tolerates already-granted scopes on a prompt=consent re-display', async () => {
            // Regression: when a user has previously consented to a client and a new auth request uses
            // `prompt=consent` (forcing the consent UI to re-display), oidc-provider's
            // `prompt.details.missingOIDCScope` only contains scopes NOT yet on the existing Grant. The
            // dbx-firebase consent UI, however, sources its checkbox list from the auth URL's `scope=`
            // param and re-submits the full set. The server must silently no-op already-granted values
            // instead of returning 400, or returning users get locked out of the consent flow.
            const server = app.getHttpServer();
            const { client_id, client_secret } = await oidcClientService.createClient({
              client_name: 'partial-consent-prompt-consent-no-op',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            // First flow: seed an existing Grant with all requested scopes.
            const first = await performAuthCodeFlowToConsent(server, client_id, { approved: true, grantedOIDCScopes: ['openid', 'email', 'demo'] });
            await exchangeConsentForAuthorizationCode(server, first.consentResponse, first.cookieHeader);

            // Second flow with prompt=consent and the same scope set re-submitted on consent. The session
            // cookie from the first flow is carried so oidc-provider's loadExistingGrant finds the prior
            // Grant via `session.grantIdFor(clientId)`. Pre-fix this returned 400 "Granted value
            // '<scope>' is not in the requested set." for every already-granted value (since
            // missingOIDCScope was empty). Post-fix it should silently no-op.
            const second = await performAuthCodeFlowToConsent(server, client_id, { approved: true, grantedOIDCScopes: ['openid', 'email', 'demo'] }, 'openid email demo', { prompt: 'consent' }, first.cookieHeader);

            expect(second.consentResponse.status).toBe(200);
            expect(second.consentResponse.body.redirectTo).toBeDefined();

            const authorizationCode = await exchangeConsentForAuthorizationCode(server, second.consentResponse, second.cookieHeader);

            const tokenRes = await request(server).post('/oidc/token').set('Cookie', second.cookieHeader).type('form').send({
              grant_type: 'authorization_code',
              code: authorizationCode,
              redirect_uri: 'https://example.com/callback',
              client_id,
              client_secret,
              code_verifier: second.codeVerifier
            });

            expect(tokenRes.status).toBe(200);
            const grantedScopes = (tokenRes.body.scope as string | undefined)?.split(' ') ?? [];
            expect(grantedScopes).toContain('openid');
            expect(grantedScopes).toContain('email');
            expect(grantedScopes).toContain('demo');
          });

          it('still rejects an unrequested scope on a prompt=consent re-display', async () => {
            // The tolerance for already-granted scopes must not weaken the unrequested-scope check.
            const server = app.getHttpServer();
            const { client_id } = await oidcClientService.createClient({
              client_name: 'partial-consent-prompt-consent-still-rejects-unrequested',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            const first = await performAuthCodeFlowToConsent(server, client_id, { approved: true, grantedOIDCScopes: ['openid', 'email', 'demo'] });
            await exchangeConsentForAuthorizationCode(server, first.consentResponse, first.cookieHeader);

            const second = await performAuthCodeFlowToConsent(server, client_id, { approved: true, grantedOIDCScopes: ['openid', 'email', 'demo', 'unrequested-scope'] }, 'openid email demo', { prompt: 'consent' }, first.cookieHeader);

            expect(second.consentResponse.status).toBe(400);
          });
        });

        describe('scope handling at refresh', () => {
          it('rejects a refresh-token request that asks for an unconsented scope', async () => {
            const server = app.getHttpServer();
            const { client_id, client_secret } = await oidcClientService.createClient({
              client_name: 'scope-upgrade-test',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            const { authorizationCode, codeVerifier, cookieHeader } = await performAuthCodeFlow(server, client_id, 'openid email offline_access');

            const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
              grant_type: 'authorization_code',
              code: authorizationCode,
              redirect_uri: 'https://example.com/callback',
              client_id,
              client_secret,
              code_verifier: codeVerifier
            });

            expect(tokenRes.status).toBe(200);
            expect(tokenRes.body.refresh_token).toBeDefined();
            expect(tokenRes.body.scope).not.toContain('demo');
            const refreshToken = tokenRes.body.refresh_token as string;

            // Try to upgrade scope at refresh — must NOT grant `demo` since it was not consented.
            const refreshRes = await request(server).post('/oidc/token').type('form').send({
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
              client_id,
              client_secret,
              scope: 'openid email offline_access demo'
            });

            // Acceptable behaviors per OAuth/OIDC: reject with invalid_scope, OR succeed but
            // strip `demo`. Both are safe; never grant unconsented scopes.
            if (refreshRes.status === 200) {
              const grantedScope = (refreshRes.body.scope as string | undefined) ?? '';
              expect(grantedScope.split(' ')).not.toContain('demo');
            } else {
              expect(refreshRes.status).toBe(400);
              expect(['invalid_scope', 'invalid_grant']).toContain(refreshRes.body.error);
            }
          });
        });

        describe('client_assertion (private_key_jwt) audience binding', () => {
          async function setupPrivateKeyJwtClient(): Promise<{ clientId: string; kid: string; privateKey: CryptoKey }> {
            const { publicKey, privateKey } = await generateKeyPair('RS256');
            const publicJwk = await exportJWK(publicKey);
            const kid = randomBytes(8).toString('hex');
            publicJwk.kid = kid;
            publicJwk.use = 'sig';

            const created = await oidcClientService.createClient(
              {
                client_name: 'assertion-binding-test',
                redirect_uris: ['https://example.com/callback'],
                token_endpoint_auth_method: 'private_key_jwt'
              },
              { jwks: { keys: [publicJwk] } }
            );

            return { clientId: created.client_id, kid, privateKey };
          }

          it('rejects a client_assertion with a foreign audience', async () => {
            const server = app.getHttpServer();
            const { clientId, kid, privateKey } = await setupPrivateKeyJwtClient();
            const { authorizationCode, codeVerifier, cookieHeader } = await performAuthCodeFlow(server, clientId);

            const wrongAudienceAssertion = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid }).setIssuer(clientId).setSubject(clientId).setAudience('https://attacker.example/oauth/token').setJti(randomBytes(16).toString('hex')).setIssuedAt().setExpirationTime('1m').sign(privateKey);

            const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
              grant_type: 'authorization_code',
              code: authorizationCode,
              redirect_uri: 'https://example.com/callback',
              client_id: clientId,
              code_verifier: codeVerifier,
              client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
              client_assertion: wrongAudienceAssertion
            });

            // oidc-provider returns 401 invalid_client for a bad assertion (per RFC 6749 §5.2).
            // Some configurations may return 400 — accept either provided no token is issued.
            expect([400, 401]).toContain(tokenRes.status);
            expect(['invalid_client', 'invalid_request']).toContain(tokenRes.body.error);
            expect(tokenRes.body.access_token).toBeUndefined();
          });

          it('rejects a client_assertion where iss != sub', async () => {
            const server = app.getHttpServer();
            const { clientId, kid, privateKey } = await setupPrivateKeyJwtClient();
            const { authorizationCode, codeVerifier, cookieHeader } = await performAuthCodeFlow(server, clientId);

            const mismatchedAssertion = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid }).setIssuer('https://attacker.example').setSubject(clientId).setAudience(oidcModuleConfig.issuer).setJti(randomBytes(16).toString('hex')).setIssuedAt().setExpirationTime('1m').sign(privateKey);

            const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
              grant_type: 'authorization_code',
              code: authorizationCode,
              redirect_uri: 'https://example.com/callback',
              client_id: clientId,
              code_verifier: codeVerifier,
              client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
              client_assertion: mismatchedAssertion
            });

            expect([400, 401]).toContain(tokenRes.status);
            expect(['invalid_client', 'invalid_request']).toContain(tokenRes.body.error);
            expect(tokenRes.body.access_token).toBeUndefined();
          });
        });

        describe('state and nonce binding', () => {
          it('echoes the request state on the callback and binds the nonce into the id_token', async () => {
            const server = app.getHttpServer();
            const { client_id, client_secret } = await oidcClientService.createClient({
              client_name: 'state-nonce-test',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            const requestNonce = `nonce-${randomBytes(8).toString('hex')}`;
            const { authorizationCode, codeVerifier, cookieHeader } = await performAuthCodeFlow(server, client_id, 'openid email demo', { state: 'state-nonce-state', nonce: requestNonce });

            const tokenRes = await request(server).post('/oidc/token').set('Cookie', cookieHeader).type('form').send({
              grant_type: 'authorization_code',
              code: authorizationCode,
              redirect_uri: 'https://example.com/callback',
              client_id,
              client_secret,
              code_verifier: codeVerifier
            });

            expect(tokenRes.status).toBe(200);
            expect(tokenRes.body.id_token).toBeDefined();

            const idTokenClaims = decodeJwt(tokenRes.body.id_token as string);
            expect(idTokenClaims.nonce).toBe(requestNonce);
          });
        });

        describe('interaction identity binding', () => {
          it('does not bind a Grant to the consent idToken when called before login completes', async () => {
            const server = app.getHttpServer();
            const { client_id } = await oidcClientService.createClient({
              client_name: 'consent-before-login-test',
              redirect_uris: ['https://example.com/callback'],
              token_endpoint_auth_method: 'client_secret_post'
            });

            const codeVerifier = randomBytes(32).toString('base64url');
            const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
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
            const loginUid = extractInteractionUid(authRes);

            // Submit consent on the login-prompt interaction WITHOUT completing login first.
            // The interaction has no session, so the controller falls back to
            // `session?.accountId ?? ''`. The security property that must hold:
            // any Grant created here is NOT bound to the supplied idToken's uid — i.e. an
            // attacker holding their own valid Firebase token cannot mint a Grant against
            // their own account on a session they never established.
            const idToken = await createTestIdToken(app, u.uid);
            await request(server).post(`/interaction/${loginUid}/consent`).send({ idToken, approved: true });

            // No Grant must be persisted under the requesting user's uid.
            const grantsForRequester = await f.instance.demoFirestoreCollections.oidcEntryCollection.query(oidcEntriesByUidQuery('Grant', u.uid)).getDocs();
            expect(grantsForRequester.empty).toBe(true);
          });
        });

        demoAuthorizedUserAdminContext({ f }, (admin) => {
          describe('cross-user consent identity binding', () => {
            it('binds the issued grant to the LOGIN session accountId regardless of the consent idToken', async () => {
              const server = app.getHttpServer();
              const { client_id } = await oidcClientService.createClient({
                client_name: 'cross-user-consent-test',
                redirect_uris: ['https://example.com/callback'],
                token_endpoint_auth_method: 'client_secret_post'
              });

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

              // 1. User A logs in with their own idToken.
              const userAIdToken = await createTestIdToken(app, u.uid);
              const loginRes = await request(server).post(`/interaction/${loginUid}/login`).set('Cookie', getCookieHeader()).send({ idToken: userAIdToken });
              expect(loginRes.status).toBe(200);

              const resumeAfterLoginPath = new URL(loginRes.body.redirectTo).pathname + new URL(loginRes.body.redirectTo).search;
              const consentRedirectRes = await request(server).get(resumeAfterLoginPath).set('Cookie', getCookieHeader()).redirects(0);
              expect(consentRedirectRes.status).toBe(303);
              collectCookies(consentRedirectRes);
              const consentUid = extractInteractionUid(consentRedirectRes);

              // 2. User B (admin, a different real user) submits consent. The current implementation
              //    only verifies that the supplied idToken is valid Firebase auth, then writes the
              //    grant against `session?.accountId` (which was set by user A's login). Document
              //    this binding so any future regression — e.g. switching to using the consent
              //    idToken's uid — is caught.
              const userBIdToken = await createTestIdToken(app, admin.uid);
              expect(admin.uid).not.toBe(u.uid);

              const consentRes = await request(server).post(`/interaction/${consentUid}/consent`).set('Cookie', getCookieHeader()).send({ idToken: userBIdToken, approved: true });
              expect(consentRes.status).toBe(200);
              collectCookies(consentRes);

              const resumeAfterConsentPath = new URL(consentRes.body.redirectTo).pathname + new URL(consentRes.body.redirectTo).search;
              const callbackRes = await request(server).get(resumeAfterConsentPath).set('Cookie', getCookieHeader()).redirects(0);
              expect(callbackRes.status).toBe(303);

              // Grant must be bound to user A (login session accountId), not user B (consent idToken uid).
              const grantsForUserA = await f.instance.demoFirestoreCollections.oidcEntryCollection.query(oidcEntriesByUidQuery('Grant', u.uid)).getDocs();
              expect(grantsForUserA.empty).toBe(false);

              const grantsForUserB = await f.instance.demoFirestoreCollections.oidcEntryCollection.query(oidcEntriesByUidQuery('Grant', admin.uid)).getDocs();
              expect(grantsForUserB.empty).toBe(true);
            });
          });
        });
      });
    });
  });
});
