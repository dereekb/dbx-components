import request from 'supertest';
import { CLI_TOKEN_OIDC_SCOPE, SERVICE_TOKEN_OIDC_SCOPE, type CreateOidcClientParams } from '@dereekb/firebase';
import { MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE } from '@dereekb/firebase-server';
import { CLI_TOKEN_CLAIM_INVALID_ERROR_CODE, CLI_TOKEN_FORBIDDEN_ERROR_CODE, FIREBASE_SERVER_CLI_TOKEN_API_PROTECTED_PATH, FIREBASE_SERVER_CLI_TOKEN_CLAIM_PATH, MAX_CLI_TOKEN_TTL_SECONDS, OidcClientService, type CliTokenHandoffBundle, type CliTokenMintResult } from '@dereekb/firebase-server/oidc';
import { oAuthAuthorizedSuperTestContextFactory, performOAuthFlow } from '@dereekb/firebase-server/test';
import { CLI_HANDOFF_OIDC_PROVIDER_PROFILE_KEY } from 'demo-firebase';
import { DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY } from '../../api/oidc/oidc.module';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoOAuthAuthorizedSuperTestContext } from '../../../test/fixture';

vi.setConfig({ hookTimeout: 40000, testTimeout: 40000 });

/**
 * OAuth fixture that requests `token.cli`.
 *
 * Both halves are required: the scope is unlocked ONLY by the admin-only `cli-handoff` provider
 * profile (so the client has to carry it), and the test flow's default "all registered scopes"
 * resolution deliberately excludes assignment-only scopes (so it has to be spelled out).
 */
const demoOAuthSuperTestContextWithCliTokenScope = oAuthAuthorizedSuperTestContextFactory({
  clientName: 'demo-cli-token-oauth-context',
  providerProfiles: [CLI_HANDOFF_OIDC_PROVIDER_PROFILE_KEY],
  scopes: `openid profile email demo offline_access model.read model.query ${CLI_TOKEN_OIDC_SCOPE}`
});

/**
 * Coverage for the MCP-minted CLI credential handoff as wired into demo-api:
 * `POST /oidc/cli-token` (bearer-authenticated, admin + `token.cli`) and
 * `POST /oidc/cli-token/claim` (unauthenticated by design — the one-time code IS the credential).
 *
 * Both of the mint's gates are exercised, the same way `session.api.e2e.spec.ts` does:
 *
 * 1. `CLI_TOKEN_ADMIN_PREDICATE` — the load-bearing check. A non-admin is refused even with a valid token.
 * 2. The `token.cli` OIDC scope — defence in depth. An admin whose token never carried it is refused too.
 *
 * Plus the two properties the whole design rests on: the minted credential is never more privileged
 * than the session that minted it, and a claim code redeems exactly once.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('CLI token handoff', () => {
    describe('admin caller holding the token.cli scope', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        demoOAuthSuperTestContextWithCliTokenScope({ f, u }, (oauth) => {
          let previousClientId: string | undefined;

          // PER TEST, not beforeAll: the context fixture builds its instance (and with it the Nest
          // application and the emulator's Firestore state) in its own beforeEach, so there is no
          // app to register a client against until after that has run — and the client would not
          // survive into the next test anyway. Registered here, after the fixture/user/oauth hooks
          // at the enclosing levels, which vitest runs outermost-first.
          beforeEach(async () => {
            // The mint issues against the app's CONFIGURED CLI client, so one has to exist. The demo
            // config reads the id live from the environment, which is what lets a client registered
            // here (after the module graph was built) be the one minted against.
            const app = await f.loadInitializedNestApplication();
            const clientService = app.get(OidcClientService);
            const created = await clientService.createClient({
              client_name: 'demo-cli (e2e)',
              redirect_uris: ['http://127.0.0.1:0/callback'],
              token_endpoint_auth_method: 'none'
            } as CreateOidcClientParams);

            previousClientId = process.env[DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY];
            process.env[DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY] = created.client_id;
          });

          afterEach(() => {
            if (previousClientId == null) {
              delete process.env[DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY];
            } else {
              process.env[DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY] = previousClientId;
            }
          });

          async function mint(body: Record<string, unknown> = {}): Promise<CliTokenMintResult> {
            const res = await oauth.authRequest('post', FIREBASE_SERVER_CLI_TOKEN_API_PROTECTED_PATH).send(body).expect(201);
            return res.body as CliTokenMintResult;
          }

          async function claim(code: string, expectStatus: number): Promise<request.Response> {
            const app = await f.loadInitializedNestApplication();
            return request(app.getHttpServer()).post(FIREBASE_SERVER_CLI_TOKEN_CLAIM_PATH).send({ code }).expect(expectStatus);
          }

          it('returns a claim code and never the refresh token', async () => {
            const minted = await mint();

            expect(typeof minted.claimCode).toBe('string');
            expect(minted.claimCode.length).toBeGreaterThan(20);
            expect(JSON.stringify(minted)).not.toContain('refreshToken');
            expect(new Date(minted.claimExpiresAt).getTime()).toBeGreaterThan(Date.now());
          });

          it('caps the credential at one hour even when more is requested', async () => {
            const minted = await mint({ ttlSeconds: 60 * 60 * 24 * 30 });
            const lifetimeSeconds = (new Date(minted.expiresAt).getTime() - Date.now()) / 1000;

            expect(lifetimeSeconds).toBeLessThanOrEqual(MAX_CLI_TOKEN_TTL_SECONDS + 5);
          });

          it('never grants token.cli or token.service to the child credential', async () => {
            const granted = new Set((await mint()).scope.split(' '));

            expect(granted.has(CLI_TOKEN_OIDC_SCOPE)).toBe(false);
            expect(granted.has(SERVICE_TOKEN_OIDC_SCOPE)).toBe(false);
            expect(granted.has('offline_access')).toBe(true);
            expect(granted.has('demo')).toBe(true);
          });

          it('narrows to a requested subset and never widens beyond the caller’s own scopes', async () => {
            const granted = new Set((await mint({ scopes: ['model.read', 'model.delete'] })).scope.split(' '));

            expect(granted.has('model.read')).toBe(true);
            // requested, but the minting session never held it
            expect(granted.has('model.delete')).toBe(false);
          });

          it('redeems the claim code for a usable credential bundle, exactly once', async () => {
            const minted = await mint();
            const first = await claim(minted.claimCode, 201);
            const bundle = first.body as CliTokenHandoffBundle;

            expect(bundle.uid).toBe(u.uid);
            expect(typeof bundle.refreshToken).toBe('string');
            expect(bundle.refreshToken.length).toBeGreaterThan(0);
            expect(bundle.clientId).toBe(process.env[DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY]);
            expect(bundle.scope).toBe(minted.scope);

            // a second redeem of the same code loses — the consume happens inside a transaction
            const second = await claim(minted.claimCode, 404);
            expect(second.body.code).toBe(CLI_TOKEN_CLAIM_INVALID_ERROR_CODE);
          });

          it('produces a refresh token the CLI client can exchange for an access token', async () => {
            const minted = await mint();
            const bundle = (await claim(minted.claimCode, 201)).body as CliTokenHandoffBundle;
            const app = await f.loadInitializedNestApplication();

            const res = await request(app.getHttpServer()).post('/oidc/token').type('form').send({ grant_type: 'refresh_token', refresh_token: bundle.refreshToken, client_id: bundle.clientId }).expect(200);

            expect(typeof res.body.access_token).toBe('string');
            // the exchanged token carries exactly the scopes the mint granted — no more
            expect(new Set((res.body.scope as string).split(' '))).toEqual(new Set(bundle.scope.split(' ')));
          });
        });
      });
    });

    describe('admin caller whose token lacks the token.cli scope', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
          it('is refused by the scope gate, distinguishably from the admin gate', async () => {
            const res = await oauth.authRequest('post', FIREBASE_SERVER_CLI_TOKEN_API_PROTECTED_PATH).send({}).expect(403);

            expect(res.body.code).toBe(MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE);
            expect(res.body.message).toContain(CLI_TOKEN_OIDC_SCOPE);
          });
        });
      });
    });

    describe('non-admin caller', () => {
      demoAuthorizedUserContext({ f }, (u) => {
        demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
          it('is refused by the admin predicate', async () => {
            const res = await oauth.authRequest('post', FIREBASE_SERVER_CLI_TOKEN_API_PROTECTED_PATH).send({}).expect(403);
            expect(res.body.code).toBe(CLI_TOKEN_FORBIDDEN_ERROR_CODE);
          });
        });
      });
    });

    // The mint's gates only ever see a token that was ISSUED. This covers the step before that: the
    // `cli-handoff` provider profile is `adminOnly`, so a non-admin consenting to `token.cli` must be
    // refused at the consent screen rather than handed a token the mint then rejects.
    describe('consent gate on the token.cli scope', () => {
      demoAuthorizedUserContext({ f }, (nonAdmin) => {
        it('ends a non-admin consent submit naming token.cli in access_denied', async () => {
          const app = await f.loadInitializedNestApplication();
          const { callbackUrl } = await performOAuthFlow({
            server: app.getHttpServer(),
            oidcClientService: app.get(OidcClientService),
            nestApp: app,
            uid: nonAdmin.uid,
            config: {
              clientName: 'cli-handoff-nonadmin-denied',
              providerProfiles: [CLI_HANDOFF_OIDC_PROVIDER_PROFILE_KEY],
              scopes: `openid email demo offline_access ${CLI_TOKEN_OIDC_SCOPE}`,
              prompt: 'consent',
              stopAtStage: 'callback'
            }
          });

          expect(callbackUrl!.searchParams.get('error')).toBe('access_denied');
          expect(callbackUrl!.searchParams.get('code')).toBeNull();
        });
      });
    });

    describe('unauthenticated caller', () => {
      it('is rejected at the mint by the bearer middleware', async () => {
        // Proves '/oidc/cli-token' is in the OIDC module's protectedPaths.
        const app = await f.loadInitializedNestApplication();
        await request(app.getHttpServer()).post(FIREBASE_SERVER_CLI_TOKEN_API_PROTECTED_PATH).send({}).expect(401);
      });

      it('REACHES the claim endpoint and gets the generic rejection, not a 401', async () => {
        // The claim route sits under the protected `/oidc/cli-token` prefix, so this is what proves
        // the `unprotectedPaths` exclusion is in place — without it the machine redeeming a code
        // (which has no credential yet, by definition) would be 401'd.
        const app = await f.loadInitializedNestApplication();
        const res = await request(app.getHttpServer()).post(FIREBASE_SERVER_CLI_TOKEN_CLAIM_PATH).send({ code: 'not-a-real-code' }).expect(404);

        expect(res.body.code).toBe(CLI_TOKEN_CLAIM_INVALID_ERROR_CODE);
      });

      it('returns the SAME generic rejection for an empty code, so the route is not an oracle', async () => {
        const app = await f.loadInitializedNestApplication();
        const res = await request(app.getHttpServer()).post(FIREBASE_SERVER_CLI_TOKEN_CLAIM_PATH).send({ code: '' }).expect(404);

        expect(res.body.code).toBe(CLI_TOKEN_CLAIM_INVALID_ERROR_CODE);
      });
    });
  });
});
