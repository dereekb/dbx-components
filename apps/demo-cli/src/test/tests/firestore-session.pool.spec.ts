import { getApps } from 'firebase/app';
import { FIRESTORE_SESSION_OIDC_SCOPE } from '@dereekb/firebase';
// eslint-disable-next-line @nx/enforce-module-boundaries -- the `/firebase` subpath has only a `build-base` target because it ships INSIDE the buildable `@dereekb/oauth-resource` package, which its `build` target assembles.
import { type FirebaseUserSessionPool, closeFirebaseUserSessionApps, firebaseUserSessionPool } from '@dereekb/oauth-resource/firebase';
// eslint-disable-next-line @nx/enforce-module-boundaries -- @dereekb/dbx-cli/test is a test-only sibling sub-project; demo-cli specs are the intended consumer.
import { listenOnNestAppForTest } from '@dereekb/dbx-cli/test';
// eslint-disable-next-line @nx/enforce-module-boundaries -- firebase-server/test ships test-only fixtures; same pattern as `withDemoTestCli`.
import { oAuthAuthorizedSuperTestContextFactory } from '@dereekb/firebase-server/test';
// eslint-disable-next-line @nx/enforce-module-boundaries -- demo-api fixture is intentionally shared with demo-cli specs (see apps/demo-cli/src/test/fixture.ts for the established pattern).
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext } from 'demo-api/test';
import { makeDemoFirestoreCollections, publishedGuestbooksQuery } from 'demo-firebase';
import { buildDemoCliTestFirebaseConfig } from '../fixture';

vi.setConfig({ hookTimeout: 60000, testTimeout: 60000 });

const POOL_NAMESPACE = 'demo-cli-pool-spec';

/**
 * OAuth fixture that explicitly requests `session.firestore` — the demo provider config lists it in
 * `adminOnlyScopes`, and the test flow's default "all registered scopes" resolution drops those.
 */
const demoOAuthSuperTestContextWithFirestoreSessionScope = oAuthAuthorizedSuperTestContextFactory({
  clientName: 'demo-cli-pool-oauth-context',
  scopes: `openid profile email demo offline_access model.read model.query ${FIRESTORE_SESSION_OIDC_SCOPE}`
});

/**
 * The only place `firebaseUserSessionPool` is driven against a REAL Firebase handshake.
 *
 * The pool's lifecycle rules — LRU eviction, the cap overshoot, TTL refresh, lease refcounting — are
 * specced exhaustively against a fake opener in
 * `packages/oauth-resource/firebase/src/lib/session/firebase-user-session.pool.spec.ts`, where the
 * clock is injectable. What that cannot show is that a pooled session is a genuine, rules-evaluated
 * user connection and that teardown actually removes the app, which is what this spec covers.
 *
 * The emulator limits carried over from `firestore-session.spec.ts` apply here too: App Check is
 * absent (the emulators do not verify attestations), and a claim-derived grant cannot be shown because
 * the Auth emulator resolves `signInWithCustomToken` against its own default project while the Admin
 * SDK writes claims under the per-run `firebase-test-<epoch>` project.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  afterEach(async () => {
    // the pool's own `close()` covers the normal path; this is the sweep for a spec that threw
    await closeFirebaseUserSessionApps({ namespace: POOL_NAMESPACE });
  });

  async function buildPool(): Promise<FirebaseUserSessionPool> {
    const app = await f.loadInitializedNestApplication();
    const { apiBaseUrl } = await listenOnNestAppForTest({ app, apiPrefix: 'api' });
    const firebase = buildDemoCliTestFirebaseConfig({ projectId: f.instance.app.options.projectId });

    if (!firebase) {
      throw new Error('the emulator env vars are absent, so no session can be opened');
    }

    return firebaseUserSessionPool({ namespace: POOL_NAMESPACE, firebase, apiBaseUrl });
  }

  function pooledApps(): string[] {
    return getApps()
      .map((x) => x.name)
      .filter((x) => x.startsWith(`${POOL_NAMESPACE}::`));
  }

  describe('firebaseUserSessionPool()', () => {
    demoAuthorizedUserAdminContext({ f }, (adminUser) => {
      demoOAuthSuperTestContextWithFirestoreSessionScope({ f, u: adminUser }, (oauth) => {
        it('signs a pooled session in as the calling user and reads Firestore under the same rules', async () => {
          const pool = await buildPool();

          try {
            const published = await pool.useSession({ uid: adminUser.uid, accessToken: oauth.accessToken }, async (session) => {
              expect(session.uid).toBe(adminUser.uid);
              expect(session.auth.currentUser?.uid).toBe(adminUser.uid);

              const collections = makeDemoFirestoreCollections(session.firestoreContext);

              // `/gb` allows a list only when it is constrained to published guestbooks (or the caller
              // is a sysadmin), so a pooled session is no more privileged than the CLI's
              await expect(collections.guestbookCollection.queryDocument().getDocs()).rejects.toMatchObject({ code: 'permission-denied' });

              return collections.guestbookCollection.queryDocument(...publishedGuestbooksQuery({ published: true })).getDocs();
            });

            expect(Array.isArray(published)).toBe(true);
            expect(pool.stats().leased).toBe(0);
          } finally {
            await pool.close();
          }
        });

        it('holds one app per uid across repeated acquisitions and releases them all on close()', async () => {
          const pool = await buildPool();

          try {
            const first = await pool.openSession({ uid: adminUser.uid, accessToken: oauth.accessToken });
            const second = await pool.openSession({ uid: adminUser.uid, accessToken: oauth.accessToken });

            // the same live session, not a second handshake — two apps would mean two refresh timers
            expect(second.session).toBe(first.session);
            expect(pooledApps()).toEqual([first.session.appName]);
            expect(first.session.appName).toBe(`${POOL_NAMESPACE}::${f.instance.app.options.projectId}::${adminUser.uid}`);
            expect(pool.stats()).toMatchObject({ size: 1, leased: 2 });

            first.release();
            second.release();
          } finally {
            await pool.close();
          }

          expect(pooledApps()).toHaveLength(0);
        });

        it('closeSession(uid) removes exactly that uid’s app', async () => {
          const pool = await buildPool();

          try {
            (await pool.openSession({ uid: adminUser.uid, accessToken: oauth.accessToken })).release();
            expect(pooledApps()).toHaveLength(1);

            await pool.closeSession(adminUser.uid);

            expect(pooledApps()).toHaveLength(0);
            expect(pool.stats().size).toBe(0);
          } finally {
            await pool.close();
          }
        });
      });
    });
  });
});
