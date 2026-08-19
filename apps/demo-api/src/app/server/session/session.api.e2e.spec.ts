import request from 'supertest';
import { FIRESTORE_SESSION_API_PATH, FIRESTORE_SESSION_FORBIDDEN_ERROR_CODE, MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE, type FirestoreSessionResult } from '@dereekb/firebase-server';
import { FIRESTORE_SESSION_OIDC_SCOPE } from '@dereekb/firebase';

import { oAuthAuthorizedSuperTestContextFactory } from '@dereekb/firebase-server/test';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoOAuthAuthorizedSuperTestContext } from '../../../test/fixture';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

const SESSION_ENDPOINT_PATH = `/api${FIRESTORE_SESSION_API_PATH}`;

/**
 * OAuth fixture that explicitly requests `session.firestore`.
 *
 * The scope has to be spelled out: it is listed in `DEMO_OIDC_PROVIDER_CONFIG.adminOnlyScopes`, and the
 * test flow's default "all registered scopes" resolution deliberately drops every admin-only scope (it
 * is also used by non-admin users, for whom consenting to one is a hard `access_denied`).
 */
const demoOAuthSuperTestContextWithFirestoreSessionScope = oAuthAuthorizedSuperTestContextFactory({
  clientName: 'demo-session-oauth-context',
  scopes: `openid profile email demo offline_access model.read model.query ${FIRESTORE_SESSION_OIDC_SCOPE}`
});

/**
 * Coverage for the direct-Firestore session endpoint (`GET /api/session/firestore`) as wired into
 * demo-api by `DemoSessionApiModule`.
 *
 * The endpoint hands the caller a Firebase custom token for their own uid (plus an App Check
 * attestation outside of tests), so both of its gates are exercised here:
 *
 * 1. `FIRESTORE_SESSION_ADMIN_PREDICATE` — the load-bearing check. A non-admin is refused even though
 *    their token is otherwise valid.
 * 2. The `session.firestore` OIDC scope — defence in depth. An admin whose token never carried the
 *    scope is refused too.
 *
 * `apps/demo-cli/src/test/tests/firestore-session.spec.ts` picks up where this leaves off and spends
 * the minted credentials on a real rules-protected Firestore read.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('GET /api/session/firestore', () => {
    describe('admin caller holding the session.firestore scope', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        demoOAuthSuperTestContextWithFirestoreSessionScope({ f, u }, (oauth) => {
          it('mints a custom token for the calling user', async () => {
            const res = await oauth.authRequest('get', SESSION_ENDPOINT_PATH).expect(200);
            const result = res.body as FirestoreSessionResult;

            expect(result.uid).toBe(u.uid);
            expect(typeof result.customToken).toBe('string');
            expect(result.customToken.length).toBeGreaterThan(0);
            expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
          });

          it('omits the App Check attestation in a test environment', async () => {
            const res = await oauth.authRequest('get', SESSION_ENDPOINT_PATH).expect(200);
            const result = res.body as FirestoreSessionResult;

            // demoSessionApiModuleConfigFactory withholds `appCheckAppId` under `isTestingEnv`:
            // `admin.appCheck().createToken()` reaches the live App Check backend, which has no
            // emulator, and the emulators would not verify the attestation anyway.
            expect(result.appCheckToken).toBeUndefined();
          });

          it('never mints a session for a uid other than the caller', async () => {
            // The uid is read from `req.auth`, so there is no parameter to point elsewhere — a granted
            // session is exactly as privileged as the caller already is under Firestore rules.
            const res = await oauth.authRequest('get', `${SESSION_ENDPOINT_PATH}?uid=someone-else`).expect(200);
            expect((res.body as FirestoreSessionResult).uid).toBe(u.uid);
          });
        });
      });
    });

    describe('admin caller whose token lacks the session.firestore scope', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
          it('is refused by the scope gate, distinguishably from the admin gate', async () => {
            const res = await oauth.authRequest('get', SESSION_ENDPOINT_PATH).expect(403);

            expect(res.body.code).toBe(MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE);
            expect(res.body.message).toContain(FIRESTORE_SESSION_OIDC_SCOPE);
          });
        });
      });
    });

    describe('non-admin caller', () => {
      demoAuthorizedUserContext({ f }, (u) => {
        demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
          it('is refused by the admin predicate', async () => {
            const res = await oauth.authRequest('get', SESSION_ENDPOINT_PATH).expect(403);
            expect(res.body.code).toBe(FIRESTORE_SESSION_FORBIDDEN_ERROR_CODE);
          });
        });
      });
    });

    describe('unauthenticated caller', () => {
      it('is rejected by the bearer middleware', async () => {
        // Proves '/api/session' is in the OIDC module's protectedPaths — without it the request would
        // reach the controller with no `req.auth` instead of being stopped at the middleware.
        const app = await f.loadInitializedNestApplication();
        await request(app.getHttpServer()).get(SESSION_ENDPOINT_PATH).expect(401);
      });
    });
  });
});
