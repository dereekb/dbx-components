import { deleteApp, getApps } from 'firebase/app';
import { createCliContext, type CliContext } from '@dereekb/dbx-cli';
// eslint-disable-next-line @nx/enforce-module-boundaries -- @dereekb/dbx-cli/test is a test-only sibling sub-project; demo-cli specs are the intended consumer.
import { listenOnNestAppForTest } from '@dereekb/dbx-cli/test';
import { FIRESTORE_SESSION_OIDC_SCOPE } from '@dereekb/firebase';
// eslint-disable-next-line @nx/enforce-module-boundaries -- firebase-server/test ships test-only fixtures; same pattern as `withDemoTestCli`.
import { oAuthAuthorizedSuperTestContextFactory } from '@dereekb/firebase-server/test';
// eslint-disable-next-line @nx/enforce-module-boundaries -- demo-api fixture is intentionally shared with demo-cli specs (see apps/demo-cli/src/test/fixture.ts for the established pattern).
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoGuestbookContext, demoGuestbookEntryContext, demoOAuthAuthorizedSuperTestContext } from 'demo-api/test';
import { makeDemoFirestoreCollections, publishedGuestbooksQuery } from 'demo-firebase';
import { queryPublishedGuestbookEntriesDirect } from '../../lib/actions';
import { DEMO_TEST_CLI_ENV_NAME, DEMO_TEST_CLI_NAME, buildDemoCliTestEnv, withDemoTestCli } from '../fixture';

vi.setConfig({ hookTimeout: 60000, testTimeout: 60000 });

/**
 * OAuth fixture that explicitly requests `session.firestore` — the demo provider config lists it in
 * `adminOnlyScopes`, and the test flow's default "all registered scopes" resolution drops those.
 */
const demoOAuthSuperTestContextWithFirestoreSessionScope = oAuthAuthorizedSuperTestContextFactory({
  clientName: 'demo-cli-session-oauth-context',
  scopes: `openid profile email demo offline_access model.read model.query ${FIRESTORE_SESSION_OIDC_SCOPE}`
});

/**
 * End-to-end coverage for the direct-Firestore session bridge, from the CLI's side.
 *
 * `apps/demo-api/src/app/server/session/session.api.e2e.spec.ts` stops at "the endpoint minted a custom
 * token"; this spec spends it. `createCliContext().getFirestoreSession()` fetches the session, signs in
 * with the custom token against the Auth emulator, and then reads Firestore through
 * `makeDemoFirestoreCollections` — the same collections object the Angular app builds off the same
 * `FirestoreContext` interface — with the emulator enforcing `firestore.rules`.
 *
 * ## What the emulators can and cannot prove
 *
 * **Rules are in force.** Listing every Guestbook is `allow list: if resourceIsPublished() ||
 * userClaimsIsSysAdmin()`, and the session is refused it while the `published`-filtered list succeeds.
 * That is the load-bearing security property: a session is a *user's* connection, not a privileged one.
 *
 * **A claim-derived grant cannot be shown here.** The Auth emulator resolves the project for a client
 * `signInWithCustomToken` call from its own default project, ignoring the API key entirely
 * (`getProjectIdByApiKey` in firebase-tools returns `defaultProjectId`), while the Admin SDK stores the
 * user's `setCustomUserClaims` under the per-run `firebase-test-<epoch>` project. The exchanged ID token
 * therefore comes back from a different auth namespace than the one holding the admin `a` claim, so
 * rules see an authenticated-but-claimless token no matter which user opened the session. That
 * custom claims survive `signInWithCustomToken` was verified separately in the Phase 0 spike, where both
 * sides shared one project.
 *
 * **App Check is absent.** `demoSessionApiModuleConfigFactory` withholds `appCheckAppId` under
 * `isTestingEnv`, and `createCliFirestoreSessionContext` skips `initializeAppCheck` whenever emulator
 * targets are active. Proving a read *fails* without an attestation needs a real App-Check-enforcing
 * project.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  /**
   * Drops the Firebase client app the session opened.
   *
   * Required between tests: `createCliFirestoreSessionContext` reuses a single app per
   * `<cliName>-<envName>`, so its `Firestore` instance would outlive the fixture's per-test emulator
   * reset and then answer queries from a cache still holding the previous test's (since-deleted)
   * documents.
   */
  afterEach(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  /**
   * Builds a real (non-test-stub) CliContext — the one `createCliContext` produces in production, so
   * the lazily-memoized `getFirestoreSession` thunk under test is the actual shipped code path.
   */
  async function buildSessionCliContext(accessToken: string): Promise<CliContext> {
    const app = await f.loadInitializedNestApplication();
    const { apiBaseUrl } = await listenOnNestAppForTest({ app, apiPrefix: 'api' });

    return createCliContext({
      cliName: DEMO_TEST_CLI_NAME,
      envName: DEMO_TEST_CLI_ENV_NAME,
      env: buildDemoCliTestEnv({ apiBaseUrl, projectId: f.instance.app.options.projectId }),
      accessToken
    });
  }

  describe('admin caller holding the session.firestore scope', () => {
    demoAuthorizedUserAdminContext({ f }, (adminUser) => {
      demoOAuthSuperTestContextWithFirestoreSessionScope({ f, u: adminUser }, (oauth) => {
        describe('getFirestoreSession()', () => {
          demoGuestbookContext({ f, name: 'Session Read Guestbook', published: true }, (g) => {
            it('signs in as the calling user and reads Firestore through the app collections factory', async () => {
              const context = await buildSessionCliContext(oauth.accessToken);
              const session = await context.getFirestoreSession!();

              expect(session.session.uid).toBe(adminUser.uid);
              expect(session.auth.currentUser?.uid).toBe(adminUser.uid);

              const collections = makeDemoFirestoreCollections(session.firestoreContext);
              const guestbook = await collections.guestbookCollection.documentAccessor().loadDocumentForKey(g.documentKey).snapshotData();

              expect(guestbook?.name).toBe('Session Read Guestbook');
            });

            it('is subject to the same security rules the app is', async () => {
              const context = await buildSessionCliContext(oauth.accessToken);
              const collections = makeDemoFirestoreCollections(await context.getFirestoreContext!());

              // `/gb` allows a list only when it is constrained to published guestbooks (or the caller is
              // a sysadmin), so the constrained query succeeds and the unconstrained one is refused.
              const published = await collections.guestbookCollection.queryDocument(...publishedGuestbooksQuery({ published: true })).getDocs();
              expect(published.map((x) => x.key)).toContain(g.documentKey);

              await expect(collections.guestbookCollection.queryDocument().getDocs()).rejects.toMatchObject({ code: 'permission-denied' });
            });
          });

          it('memoizes one session per context', async () => {
            const context = await buildSessionCliContext(oauth.accessToken);
            const [first, second] = await Promise.all([context.getFirestoreSession!(), context.getFirestoreSession!()]);

            expect(second.session.customToken).toBe(first.session.customToken);
            expect(second.firestore).toBe(first.firestore);
          });

          it('releases the Firebase app on close, which is what lets the CLI exit', async () => {
            // A signed-in `Auth` and a live `Firestore` hold the Node event loop open, so before
            // `closeFirestoreSession` existed the built binary printed its result and then hung
            // forever. That is invisible to the rest of this suite: `runCliCommand` drives the CLI
            // in-process and never depends on the process exiting — and the `afterEach` above
            // deletes the app itself, compensating for the very teardown production code lacked.
            // Assert on the app registry, which is the observable consequence either way.
            const context = await buildSessionCliContext(oauth.accessToken);
            const session = await context.getFirestoreSession!();

            expect(getApps()).toContain(session.app);

            await context.closeFirestoreSession!();

            expect(getApps()).not.toContain(session.app);
          });
        });

        describe('queryPublishedGuestbookEntriesDirect()', () => {
          demoGuestbookContext({ f, name: 'Direct Session Guestbook', published: true }, (g) => {
            demoGuestbookEntryContext({ f, u: adminUser, g, message: 'read over a direct connection', published: true }, () => {
              it('aggregates published entries without a single model-API call', async () => {
                const context = await buildSessionCliContext(oauth.accessToken);
                const result = await queryPublishedGuestbookEntriesDirect({ context });

                expect(result.uid).toBe(adminUser.uid);
                expect(result.appCheckAttested).toBe(false);

                const seeded = result.perGuestbook.find((x) => x.guestbook === g.documentKey);
                expect(seeded).toBeDefined();
                expect(seeded?.name).toBe('Direct Session Guestbook');
                expect(seeded?.entries.map((x) => x.message)).toContain('read over a direct connection');
                expect(result.entryCount).toBeGreaterThan(0);
              });
            });
          });
        });

        describe('demo-cli action guestbook direct-published-entries', () => {
          demoGuestbookContext({ f, name: 'Direct Session CLI Guestbook', published: true }, (g) => {
            demoGuestbookEntryContext({ f, u: adminUser, g, message: 'via the cli', published: true }, () => {
              withDemoTestCli({ f, oauth }, ({ runCli }) => {
                it('runs end to end through the registered action command', async () => {
                  const result = await runCli(['action', 'guestbook', 'direct-published-entries']);

                  expect(result.error).toBeUndefined();
                  expect(result.exitCode).toBeUndefined();
                  expect(result.stdoutText).toContain('via the cli');
                });
              });
            });
          });
        });
      });
    });
  });

  describe('non-admin caller', () => {
    demoAuthorizedUserContext({ f }, (nonAdminUser) => {
      demoOAuthAuthorizedSuperTestContext({ f, u: nonAdminUser }, (oauth) => {
        it('fails loudly rather than falling back to the model API', async () => {
          const context = await buildSessionCliContext(oauth.accessToken);

          // The admin predicate refuses the session, and there is deliberately no fallback path.
          await expect(context.getFirestoreSession!()).rejects.toThrow(/firestore session request failed/i);
        });
      });
    });
  });
});
