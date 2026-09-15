import request from 'supertest';
import { type INestApplication } from '@nestjs/common';
import { type Provider } from 'oidc-provider';
import { FIRESTORE_SESSION_API_PATH } from '@dereekb/firebase-server';
import { FIRESTORE_SESSION_OIDC_SCOPE } from '@dereekb/firebase';
import { OidcModuleConfig, OidcService, buildOidcResourceServer } from '@dereekb/firebase-server/oidc';
import { setupAndPerformFullOAuthFlow, type OAuthTestFlowSession, type PerformFullOAuthFlowResult } from '@dereekb/firebase-server/test';
import { type Configurable } from '@dereekb/util';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext } from '../../../test/fixture';

vi.setConfig({ hookTimeout: 40000, testTimeout: 40000 });

const SESSION_ENDPOINT_PATH = `/api${FIRESTORE_SESSION_API_PATH}`;

/**
 * Scopes every flow in this spec requests.
 *
 * `offline_access` is mandatory here — it is the only reason the provider issues a refresh token, and
 * the refresh exchange is the operation that distinguishes "this Grant is gone" from "this access
 * token merely expired".
 *
 * Requesting the scope is NOT sufficient on its own: per OIDC Core 3.1.2.1 the provider drops
 * `offline_access` unless the authorization request also carries `prompt=consent`, so every flow here
 * that spends a refresh token passes `prompt: 'consent'`. Without it the scope is silently discarded
 * and `flow.refreshToken` comes back undefined.
 */
const REVOCATION_TEST_SCOPES = `openid profile email demo offline_access model.read model.query ${FIRESTORE_SESSION_OIDC_SCOPE}`;

/**
 * A resource server registered with `accessTokenFormat: 'jwt'`, used by the last block to pin the
 * documented trade-off that an off-box (JWT) access token is NOT revocable before `exp`.
 *
 * Mirrors `oauth-resource.e2e.spec.ts`'s satellite registration — `getResourceServerInfo` reads
 * `config.resourceServers` per request, so mutating the config object affects the already-built
 * provider.
 */
const SATELLITE_ORIGIN = 'https://satellite.revocation.example.com';
const SATELLITE_RESOURCE = `${SATELLITE_ORIGIN}/mcp`;

/**
 * How long a revocation is allowed to take to become observable, in milliseconds.
 *
 * Deliberately tight. The point of these tests is not that revocation *eventually* happens but that
 * it needs NO propagation delay at all: an opaque access token is a key into the provider's Firestore
 * adapter, so the very next request after `revokeGrant` resolves already fails. Nothing here sleeps,
 * polls, or retries — a regression that introduced a cache in front of the adapter would show up as a
 * still-200 response rather than as a slow test.
 */
const MAX_REVOCATION_LATENCY_MS = 2000;

/**
 * Coverage for how quickly a revoked OAuth session stops working, and for the two places where the
 * cascade deliberately stops.
 *
 * ## What is proven here
 *
 * - Revoking a Grant kills its OPAQUE access token on the next request, with no waiting. This is the
 *   load-bearing property: demo-api's own MCP resource server is registered without an explicit
 *   `accessTokenFormat`, so it issues opaque tokens, and `OidcService.verifyAccessToken` looks every
 *   one of them up in the adapter.
 * - The refresh exchange fails `invalid_grant` immediately, so a revoked session cannot re-arm itself.
 * - The RFC 7009 revocation endpoint reaches the same state through the client-facing route.
 *
 * ## What is proven NOT to cascade
 *
 * Both are accepted, documented limitations rather than bugs, and are pinned here so a future change
 * to either has to be deliberate:
 *
 * - A **minted CLI credential** lives on its own Grant (a refresh token is client-bound, so the parent
 *   Grant cannot be reused), so revoking the parent session leaves it alive. See
 *   `OidcCliTokenService`'s "Accepted limitation — no revocation cascade".
 * - A **JWT access token** has no adapter record at all, so `revokeGrant` cannot reach it and it stays
 *   verifiable until `exp`. See `BuildOidcResourceServerConfig.accessTokenFormat`.
 *
 * The Firebase side of the same question — whether revoking an OAuth session invalidates a
 * direct-Firestore session it minted — is covered in
 * `apps/demo-cli/src/test/tests/firestore-session.revocation.spec.ts`, which can spend real
 * credentials against the emulator's rules.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('OIDC revocation latency', () => {
    demoAuthorizedUserAdminContext({ f }, (u) => {
      /**
       * Runs a full authorization code flow and returns the tokens plus the Grant id behind them.
       *
       * The Grant id is read back off the issued access token rather than tracked through the flow,
       * because that is the only handle a caller ever has: `revokeGrant` is keyed by it, and the
       * `deleteOidcToken` callModel action resolves it from the `OidcEntryDocument` the same way.
       */
      async function performFlowWithGrantId(scopes: string = REVOCATION_TEST_SCOPES): Promise<{ readonly flow: PerformFullOAuthFlowResult; readonly grantId: string; readonly provider: Provider; readonly oidcService: OidcService }> {
        const app = await f.loadInitializedNestApplication();
        const flow = await setupAndPerformFullOAuthFlow(app, u.uid, { scopes, clientName: 'demo-revocation-oauth-context', prompt: 'consent' });
        const oidcService = app.get(OidcService);
        const provider = await oidcService.getProvider();
        const accessToken = await provider.AccessToken.find(flow.accessToken);

        if (accessToken?.grantId == null) {
          throw new Error('Expected the issued opaque access token to carry a grantId.');
        }

        return { flow, grantId: accessToken.grantId, provider, oidcService };
      }

      /**
       * Performs a `grant_type=refresh_token` exchange with the flow's own client credentials.
       *
       * @returns The raw supertest response, so a caller can assert on both the status and the OAuth error code.
       */
      function refreshWith(server: ReturnType<INestApplication['getHttpServer']>, session: OAuthTestFlowSession, refreshToken: string): request.Test {
        return request(server).post('/oidc/token').type('form').send({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: session.client.client_id,
          client_secret: session.client.client_secret
        });
      }

      describe('revokeGrant() on a live session', () => {
        it('rejects the opaque access token on the very next request', async () => {
          const app = await f.loadInitializedNestApplication();
          const { flow, grantId, oidcService } = await performFlowWithGrantId();
          const server = app.getHttpServer();

          // baseline — the token works on a bearer-protected route
          await request(server).get('/oidc/me').set('Authorization', `Bearer ${flow.accessToken}`).expect(200);

          const revokedAt = Date.now();
          await oidcService.revokeGrant(grantId);

          // no sleep, no retry: the next request is already rejected
          await request(server).get('/oidc/me').set('Authorization', `Bearer ${flow.accessToken}`).expect(401);

          expect(Date.now() - revokedAt).toBeLessThan(MAX_REVOCATION_LATENCY_MS);
        });

        it('rejects the token at the app API surface too, not just at the provider', async () => {
          const app = await f.loadInitializedNestApplication();
          const { flow, grantId, oidcService } = await performFlowWithGrantId();
          const server = app.getHttpServer();

          // `session.firestore` is the highest-value route the token reaches — it mints a Firebase
          // custom token — so it is the one that matters most for revocation to shut down promptly.
          await request(server).get(SESSION_ENDPOINT_PATH).set('Authorization', `Bearer ${flow.accessToken}`).expect(200);

          await oidcService.revokeGrant(grantId);

          await request(server).get(SESSION_ENDPOINT_PATH).set('Authorization', `Bearer ${flow.accessToken}`).expect(401);
        });

        it('fails the refresh exchange with invalid_grant, so the session cannot re-arm itself', async () => {
          const app = await f.loadInitializedNestApplication();
          const { flow, grantId, oidcService } = await performFlowWithGrantId();
          const server = app.getHttpServer();

          expect(flow.refreshToken).toBeDefined();

          // baseline — the refresh token is spendable while the Grant lives
          const before = await refreshWith(server, flow.session, flow.refreshToken!).expect(200);
          expect(before.body.access_token).toBeDefined();

          // rotation is on, so the exchange above replaced the refresh token; revoke and try the NEW one
          await oidcService.revokeGrant(grantId);

          const after = await refreshWith(server, flow.session, before.body.refresh_token).expect(400);
          expect(after.body.error).toBe('invalid_grant');
        });

        it('leaves the access token verifiable as nothing, not merely unauthorized', async () => {
          // Guards the layer beneath the HTTP status: a 401 could come from any middleware, whereas
          // `verifyAccessToken` returning undefined proves the adapter record itself is gone.
          const { flow, grantId, oidcService } = await performFlowWithGrantId();

          expect(await oidcService.verifyAccessToken(flow.accessToken)).toBeDefined();

          await oidcService.revokeGrant(grantId);

          expect(await oidcService.verifyAccessToken(flow.accessToken)).toBeUndefined();
        });
      });

      describe('RFC 7009 POST /oidc/token/revocation', () => {
        it('kills the session through the client-facing route', async () => {
          const app = await f.loadInitializedNestApplication();
          const { flow } = await performFlowWithGrantId();
          const server = app.getHttpServer();

          await request(server).get('/oidc/me').set('Authorization', `Bearer ${flow.accessToken}`).expect(200);

          const revokedAt = Date.now();
          await request(server)
            .post('/oidc/token/revocation')
            .type('form')
            .send({
              token: flow.accessToken,
              token_type_hint: 'access_token',
              client_id: flow.session.client.client_id,
              client_secret: flow.session.client.client_secret
            })
            .expect(200);

          await request(server).get('/oidc/me').set('Authorization', `Bearer ${flow.accessToken}`).expect(401);

          expect(Date.now() - revokedAt).toBeLessThan(MAX_REVOCATION_LATENCY_MS);
        });

        it('makes a revoked refresh token unspendable', async () => {
          const app = await f.loadInitializedNestApplication();
          const { flow } = await performFlowWithGrantId();
          const server = app.getHttpServer();

          await request(server)
            .post('/oidc/token/revocation')
            .type('form')
            .send({
              token: flow.refreshToken,
              token_type_hint: 'refresh_token',
              client_id: flow.session.client.client_id,
              client_secret: flow.session.client.client_secret
            })
            .expect(200);

          const after = await refreshWith(server, flow.session, flow.refreshToken!).expect(400);
          expect(after.body.error).toBe('invalid_grant');
        });
      });

      describe('a JWT-format access token (off-box resource server)', () => {
        let previousResourceServers: OidcModuleConfig['resourceServers'];

        beforeEach(async () => {
          const app = await f.loadInitializedNestApplication();
          const oidcModuleConfig = app.get(OidcModuleConfig);

          previousResourceServers = oidcModuleConfig.resourceServers;
          (oidcModuleConfig as Configurable<OidcModuleConfig>).resourceServers = {
            ...oidcModuleConfig.resourceServers,
            ...buildOidcResourceServer({ url: SATELLITE_RESOURCE, scope: REVOCATION_TEST_SCOPES, audience: SATELLITE_ORIGIN, accessTokenFormat: 'jwt', accessTokenTTL: 3600 })
          };
        });

        afterEach(async () => {
          const app = await f.loadInitializedNestApplication();
          (app.get(OidcModuleConfig) as Configurable<OidcModuleConfig>).resourceServers = previousResourceServers;
        });

        it('SURVIVES revokeGrant until exp — the documented cost of the jwt format', async () => {
          const app = await f.loadInitializedNestApplication();
          const flow = await setupAndPerformFullOAuthFlow(app, u.uid, { scopes: REVOCATION_TEST_SCOPES, clientName: 'demo-revocation-jwt-context', resource: SATELLITE_RESOURCE, prompt: 'consent' });
          const oidcService = app.get(OidcService);

          // a JWT has three dot-separated segments; an opaque token has none
          expect(flow.accessToken.split('.')).toHaveLength(3);

          // The Grant still exists and is revocable — it is only the TOKEN that has no adapter record.
          // Its id comes off the refresh token, which IS persisted.
          const provider = await oidcService.getProvider();
          const refreshToken = await provider.RefreshToken.find(flow.refreshToken!);
          const grantId = refreshToken?.grantId;

          expect(grantId).toBeDefined();

          await oidcService.revokeGrant(grantId!);

          // the refresh path is dead...
          const after = await refreshWith(app.getHttpServer(), flow.session, flow.refreshToken!).expect(400);
          expect(after.body.error).toBe('invalid_grant');

          // ...but the outstanding JWT still verifies. This is why `accessTokenTTL` must stay short on
          // any resource server that opts into the format.
          expect(await oidcService.verifyAccessToken(flow.accessToken)).toBeDefined();
        });
      });
    });
  });
});
