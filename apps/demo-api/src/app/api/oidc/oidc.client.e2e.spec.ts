import request from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { unixDateTimeSecondsNumberForNow, buildAuthorizationUrl, generateOAuthState, generatePkceMaterial } from '@dereekb/util';
import { discoverOidcMetadata, exchangeAuthorizationCode, refreshAccessToken, revokeToken } from '@dereekb/util/oidc';
import { type CreateGuestbookParams, guestbookIdentity } from 'demo-firebase';
import { onCallCreateModelParams } from '@dereekb/firebase';
import { type JwksService, OidcAccountService, type OidcClientService, type OidcService } from '@dereekb/firebase-server/oidc';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext } from '../../../test/fixture';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

const REDIRECT_URI = 'https://example.com/callback';

/**
 * Mints an unsigned Firebase ID token (`alg: "none"`) the Auth emulator accepts, with the audience
 * set to the dynamic test project id. Used to satisfy the OIDC login interaction.
 */
async function createTestIdToken(nestApp: INestApplication, uid: string): Promise<string> {
  const accountService = nestApp.get(OidcAccountService);
  const projectId = accountService.authService.auth.app.options.projectId as string;
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

function pathWithQuery(url: string): string {
  const parsed = new URL(url);
  return parsed.pathname + parsed.search;
}

function extractInteractionUid(res: request.Response): string {
  const location = res.headers['location'] as string;
  const url = location.startsWith('/') ? new URL(location, 'http://localhost') : new URL(location);
  return url.searchParams.get('uid') as string;
}

/**
 * The interaction leg a pure relying party cannot automate (user login + consent), driven over
 * supertest against the in-process server: `/oidc/auth` → login → consent → callback. Returns the
 * authorization `code` for the relying party to exchange via `@dereekb/util/oidc`.
 */
async function obtainAuthorizationCode(input: { readonly app: INestApplication; readonly uid: string; readonly authorizationUrl: string }): Promise<string> {
  const server = input.app.getHttpServer();
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

  // Drive `/oidc/auth` with the exact query the relying party built.
  const authQuery = Object.fromEntries(new URL(input.authorizationUrl).searchParams);
  const authRes = await request(server).get('/oidc/auth').query(authQuery).redirects(0);
  expect(authRes.status).toBe(303);
  collectCookies(authRes);

  const loginUid = extractInteractionUid(authRes);
  const idToken = await createTestIdToken(input.app, input.uid);
  const loginRes = await request(server).post(`/interaction/${loginUid}/login`).set('Cookie', cookieHeader()).send({ idToken });
  expect(loginRes.status).toBe(200);

  const consentRedirectRes = await request(server).get(pathWithQuery(loginRes.body.redirectTo)).set('Cookie', cookieHeader()).redirects(0);
  expect(consentRedirectRes.status).toBe(303);
  collectCookies(consentRedirectRes);

  const consentUid = extractInteractionUid(consentRedirectRes);
  const consentRes = await request(server).post(`/interaction/${consentUid}/consent`).set('Cookie', cookieHeader()).send({ idToken, approved: true });
  expect(consentRes.status).toBe(200);

  const callbackRedirectRes = await request(server).get(pathWithQuery(consentRes.body.redirectTo)).set('Cookie', cookieHeader()).redirects(0);
  expect(callbackRedirectRes.status).toBe(303);

  const callbackUrl = new URL(callbackRedirectRes.headers['location'] as string);
  return callbackUrl.searchParams.get('code') as string;
}

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  // Guestbook reads are admin-only, so the relying party's subject must be an admin to exercise the
  // protected `/api/model` document-access routes end-to-end.
  demoAuthorizedUserAdminContext({ f }, (u) => {
    let app: INestApplication;
    let baseUrl: string;
    let jwksService: JwksService;
    let oidcService: OidcService;
    let oidcClientService: OidcClientService;

    beforeEach(async () => {
      const serverContext = f.instance.apiServerNestContext;
      jwksService = serverContext.jwksService;
      oidcService = serverContext.oidcService;
      oidcClientService = serverContext.oidcClientService;

      await jwksService.rotateKeys();
      app = await f.loadInitializedNestApplication();

      // Bind a real ephemeral port so the global `fetch` injected into `@dereekb/util/oidc` reaches
      // the provider over real HTTP. The configured issuer is intentionally unreachable in tests, so
      // discovered endpoints are rebased onto this listen origin before each protocol call.
      await app.listen(0);
      const address = app.getHttpServer().address();
      const port = typeof address === 'object' && address != null ? address.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
    });

    afterEach(async () => {
      await app.close();
    });

    function rebaseEndpoint(endpoint: string): string {
      return baseUrl + new URL(endpoint).pathname;
    }

    async function registerPublicClient(clientName: string): Promise<string> {
      const created = await oidcClientService.createClient({
        client_name: clientName,
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: 'none'
      });

      // A public PKCE client must NOT be issued a secret.
      expect(created.client_secret).toBeUndefined();
      return created.client_id;
    }

    it('registers a public PKCE client without a client_secret', async () => {
      await registerPublicClient('rp-public-client');
    });

    it('drives authcode+PKCE → exchange → refresh+rotation → revocation via @dereekb/util/oidc', async () => {
      const clientId = await registerPublicClient('rp-lifecycle');

      // 1. Discovery via util/oidc (real fetch against the listen origin).
      const meta = await discoverOidcMetadata({ issuer: baseUrl, fetch });
      expect(meta.token_endpoint).toBeDefined();
      const tokenEndpoint = rebaseEndpoint(meta.token_endpoint);

      // 2. Build the authorization request with the pure helpers, then run the interaction leg.
      const { codeVerifier, codeChallenge } = await generatePkceMaterial();
      const state = generateOAuthState();
      const authorizationUrl = buildAuthorizationUrl({
        authorizationEndpoint: meta.authorization_endpoint,
        clientId,
        redirectUri: REDIRECT_URI,
        scopes: 'openid email demo offline_access',
        state,
        codeChallenge
      });

      const code = await obtainAuthorizationCode({ app, uid: u.uid, authorizationUrl });

      // 3. Exchange the code (public client — no secret, PKCE verifier only).
      const tokens = await exchangeAuthorizationCode({ tokenEndpoint, clientId, redirectUri: REDIRECT_URI, code, codeVerifier, fetch });
      expect(tokens.access_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();
      expect(tokens.id_token).toBeDefined();

      // 4. Refresh + rotation.
      const firstRefreshToken = tokens.refresh_token as string;
      const refreshed = await refreshAccessToken({ tokenEndpoint, clientId, refreshToken: firstRefreshToken, fetch });
      expect(refreshed.access_token).toBeDefined();
      expect(refreshed.refresh_token).toBeDefined();
      expect(refreshed.refresh_token).not.toBe(firstRefreshToken); // rotation forced on for public clients

      // 5. Revocation — confirm the current access token verifies, revoke it, confirm it no longer does.
      const currentAccessToken = refreshed.access_token;
      expect((await oidcService.verifyAccessToken(currentAccessToken))?.uid).toBe(u.uid);

      await revokeToken({ revocationEndpoint: rebaseEndpoint(`${meta.token_endpoint}/revocation`), clientId, token: currentAccessToken, tokenTypeHint: 'access_token', fetch });

      expect(await oidcService.verifyAccessToken(currentAccessToken)).toBeUndefined();

      // Replaying the now-rotated original refresh token must fail with invalid_grant. Done last
      // because oidc-provider's reuse detection revokes the entire grant on a replayed refresh token.
      await expect(refreshAccessToken({ tokenEndpoint, clientId, refreshToken: firstRefreshToken, fetch })).rejects.toMatchObject({ code: 'TOKEN_INVALID_GRANT' });
    });

    it('calls /api/model with the issued bearer token and enforces model.* scope gating', async () => {
      const clientId = await registerPublicClient('rp-model-scopes');

      const meta = await discoverOidcMetadata({ issuer: baseUrl, fetch });
      const tokenEndpoint = rebaseEndpoint(meta.token_endpoint);

      const { codeVerifier, codeChallenge } = await generatePkceMaterial();
      const state = generateOAuthState();
      // Request read/query but deliberately NOT model.create, to prove the scope gate.
      const authorizationUrl = buildAuthorizationUrl({
        authorizationEndpoint: meta.authorization_endpoint,
        clientId,
        redirectUri: REDIRECT_URI,
        scopes: 'openid email demo model.read model.query',
        state,
        codeChallenge
      });

      const code = await obtainAuthorizationCode({ app, uid: u.uid, authorizationUrl });
      const tokens = await exchangeAuthorizationCode({ tokenEndpoint, clientId, redirectUri: REDIRECT_URI, code, codeVerifier, fetch });
      const accessToken = tokens.access_token;

      // Seed a guestbook directly (the token lacks model.create), owned by the admin user.
      const guestbookAccessor = f.instance.demoFirestoreCollections.guestbookCollection.documentAccessor();
      const guestbookDocument = guestbookAccessor.newDocument();
      await guestbookDocument.create({ name: 'RP Bearer Read', published: true, locked: false, cby: u.uid });
      const key = guestbookDocument.key;

      // model.read is granted ⇒ the protected read route returns the document.
      const readRes = await fetch(`${baseUrl}/api/model/${guestbookIdentity.modelType}/get?key=${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      expect(readRes.status).toBe(200);
      const readBody = (await readRes.json()) as { key: string; data: { name: string } };
      expect(readBody.key).toBe(key);
      expect(readBody.data.name).toBe('RP Bearer Read');

      // model.create is NOT granted ⇒ a create call is rejected by the scope pre-assert (403).
      const createParams: CreateGuestbookParams = { name: 'Should Be Rejected' };
      const createRes = await fetch(`${baseUrl}/api/model/call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(onCallCreateModelParams(guestbookIdentity, createParams))
      });
      expect(createRes.status).toBe(403);
    });
  });
});
