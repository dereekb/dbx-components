import request from 'supertest';
import { decodeJwt } from 'jose';
import { FIRESTORE_SESSION_API_PATH, MAX_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS, MIN_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS, firestoreSessionAppCheckTtlMillis, type FirestoreSessionResult } from '@dereekb/firebase-server';
import { FIRESTORE_SESSION_OIDC_SCOPE } from '@dereekb/firebase';
import { OidcService } from '@dereekb/firebase-server/oidc';
import { setupAndPerformFullOAuthFlow } from '@dereekb/firebase-server/test';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext } from '../../../test/fixture';

vi.setConfig({ hookTimeout: 40000, testTimeout: 40000 });

const SESSION_ENDPOINT_PATH = `/api${FIRESTORE_SESSION_API_PATH}`;

const SESSION_TEST_SCOPES = `openid profile email demo offline_access model.read model.query ${FIRESTORE_SESSION_OIDC_SCOPE}`;

/**
 * Where the revocation cascade STOPS at the Firebase boundary, pinned as behaviour rather than left to
 * a doc comment.
 *
 * `oidc.revocation.e2e.spec.ts` proves the OAuth half is immediate: revoke a Grant and its opaque
 * access token is dead on the next request. This spec asks the follow-up question — when that session
 * had already traded its access token for a direct-Firestore session
 * (`GET /api/session/firestore` → a Firebase custom token), does revoking the OAuth session take the
 * Firebase credentials down with it?
 *
 * **It does not, and today it cannot.** The two auth systems share no revocation channel:
 *
 * 1. Revoking a Grant is an operation on the OIDC provider's Firestore adapter. Nothing in that path
 *    touches Firebase Auth — pinned below by `tokensValidAfterTime` being unmoved across a revoke.
 * 2. Firebase's own kill switch, `admin.auth().revokeRefreshTokens(uid)`, exists and works (also
 *    pinned below), but is not wired to OIDC revocation — and it is blunt: it signs the user out of
 *    the browser app too, since it invalidates every refresh token the uid holds.
 * 3. Even calling it would not evict an ID token already minted. Firestore security rules validate an
 *    ID token's signature and `exp` only; they do not consult `tokensValidAfterTime`. Catching a
 *    revoked token requires either `verifyIdToken(token, true)` on a server, or a rules-level check
 *    of `request.auth.token.auth_time` against a per-user revocation timestamp. Neither repo has one.
 *
 * ## What actually bounds a revoked admin's direct-Firestore access
 *
 * Not `FirestoreSessionResult.expiresAt` — that is a client-side courtesy bound. `signInWithCustomToken`
 * leaves the Firebase client SDK holding a **refresh token** and running a refresh timer, so a process
 * that stays signed in keeps minting fresh ID tokens indefinitely.
 *
 * The one credential in the bundle with no renewal path is the **App Check attestation**: it is minted
 * by this endpoint with a server-chosen TTL, and `openFirebaseUserSession` feeds it to a
 * `CustomProvider` that hands back that same static token forever. So wherever App Check is ENFORCED,
 * `SessionApiModuleConfig.appCheckTokenTtlMillis` is the real upper bound on how long a
 * since-revoked admin keeps reading — and lowering it is the only lever that shortens that window
 * without a rules change. Its floor is pinned below.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('direct-Firestore session revocation', () => {
    demoAuthorizedUserAdminContext({ f }, (u) => {
      /**
       * Opens a session the way a real client does — full OAuth flow, then the session endpoint — and
       * hands back everything needed to revoke either half of it.
       */
      async function openSession(): Promise<{ readonly session: FirestoreSessionResult; readonly accessToken: string; readonly grantId: string; readonly oidcService: OidcService }> {
        const app = await f.loadInitializedNestApplication();
        const flow = await setupAndPerformFullOAuthFlow(app, u.uid, { scopes: SESSION_TEST_SCOPES, clientName: 'demo-session-revocation-context' });
        const oidcService = app.get(OidcService);
        const provider = await oidcService.getProvider();
        const accessToken = await provider.AccessToken.find(flow.accessToken);

        if (accessToken?.grantId == null) {
          throw new Error('Expected the issued opaque access token to carry a grantId.');
        }

        const res = await request(app.getHttpServer()).get(SESSION_ENDPOINT_PATH).set('Authorization', `Bearer ${flow.accessToken}`).expect(200);

        return { session: res.body as FirestoreSessionResult, accessToken: flow.accessToken, grantId: accessToken.grantId, oidcService };
      }

      describe('revoking the OAuth grant', () => {
        it('immediately stops NEW sessions being minted', async () => {
          // This is the containment that DOES work, and it is the one that matters most: a revoked
          // session can never obtain another custom token, so the blast radius is capped at the
          // credentials already handed out rather than growing.
          const app = await f.loadInitializedNestApplication();
          const { accessToken, grantId, oidcService } = await openSession();

          await oidcService.revokeGrant(grantId);

          await request(app.getHttpServer()).get(SESSION_ENDPOINT_PATH).set('Authorization', `Bearer ${accessToken}`).expect(401);
        });

        it('does NOT touch Firebase Auth — tokensValidAfterTime is unmoved', async () => {
          // The mechanical statement of the gap. If a future change wires an OIDC revoke to
          // `revokeRefreshTokens`, this assertion is the one that will fail and force the decision to
          // be made deliberately (it signs the user out of the browser app too).
          const { grantId, oidcService } = await openSession();

          const before = await f.authService.auth.getUser(u.uid);

          await oidcService.revokeGrant(grantId);

          const after = await f.authService.auth.getUser(u.uid);
          expect(after.tokensValidAfterTime).toBe(before.tokensValidAfterTime);
        });

        it('leaves the already-issued custom token intact and unexpired', async () => {
          // The custom token is a JWT signed by the service account; it lives in the client's hands and
          // no server-side record gates it. Revoking the Grant cannot reach it.
          const { session, grantId, oidcService } = await openSession();

          await oidcService.revokeGrant(grantId);

          const claims = decodeJwt(session.customToken);
          expect(claims['uid']).toBe(u.uid);
          expect(claims.exp! * 1000).toBeGreaterThan(Date.now());
        });
      });

      describe("Firebase's own kill switch", () => {
        it('revokeRefreshTokens moves tokensValidAfterTime forward', async () => {
          // Proves the lever EXISTS and works against this project — so the gap above is a wiring
          // decision, not a missing capability.
          await openSession();

          const before = await f.authService.auth.getUser(u.uid);

          await f.authService.auth.revokeRefreshTokens(u.uid);

          const after = await f.authService.auth.getUser(u.uid);
          expect(Date.parse(after.tokensValidAfterTime!)).toBeGreaterThan(Date.parse(before.tokensValidAfterTime ?? '1970-01-01T00:00:00Z'));
        });

        it('still does not invalidate an already-minted custom token', async () => {
          // The half that is a Firebase platform property rather than our wiring: revocation bounds
          // what can be REFRESHED, not what has already been signed. A client holding this token can
          // still exchange it, and the ID token it gets back is accepted by Firestore rules (which
          // never consult tokensValidAfterTime) for its full hour.
          const { session } = await openSession();

          await f.authService.auth.revokeRefreshTokens(u.uid);

          const claims = decodeJwt(session.customToken);
          expect(claims.exp! * 1000).toBeGreaterThan(Date.now());
        });
      });

      describe('the App Check TTL lever', () => {
        it('is the only credential in the bundle with a server-chosen, non-renewable lifetime', () => {
          // A deployed app shortens a revoked admin's direct-Firestore window by lowering
          // `SessionApiModuleConfig.appCheckTokenTtlMillis`. The Admin SDK's own floor is 30 minutes,
          // so that is as tight as this lever goes — anything shorter needs the rules-level check.
          expect(firestoreSessionAppCheckTtlMillis(60 * 1000)).toBe(MIN_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS);
          expect(MIN_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS).toBe(30 * 60 * 1000);
          expect(firestoreSessionAppCheckTtlMillis(30 * 24 * 60 * 60 * 1000)).toBe(MAX_FIRESTORE_SESSION_APP_CHECK_TTL_MILLIS);
        });

        it('bounds the session expiry the endpoint reports', async () => {
          // With no App Check token (the test environment withholds `appCheckAppId`), `expiresAt` is
          // the custom-token exchange window alone — one hour, fixed by Firebase. It is a HINT for the
          // client's cache, not an enforced deadline: the signed-in SDK keeps refreshing past it.
          const { session } = await openSession();

          const remainingMs = new Date(session.expiresAt).getTime() - Date.now();
          expect(remainingMs).toBeGreaterThan(0);
          expect(remainingMs).toBeLessThanOrEqual(60 * 60 * 1000);
        });
      });
    });
  });
});
