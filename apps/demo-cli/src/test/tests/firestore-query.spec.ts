import { deleteApp, getApps } from 'firebase/app';
import { FIRESTORE_SESSION_OIDC_SCOPE } from '@dereekb/firebase';
// eslint-disable-next-line @nx/enforce-module-boundaries -- firebase-server/test ships test-only fixtures; same pattern as `withDemoTestCli`.
import { oAuthAuthorizedSuperTestContextFactory } from '@dereekb/firebase-server/test';
// eslint-disable-next-line @nx/enforce-module-boundaries -- demo-api fixture is intentionally shared with demo-cli specs (see apps/demo-cli/src/test/fixture.ts for the established pattern).
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoGuestbookContext, demoGuestbookEntryContext } from 'demo-api/test';
import { withDemoTestCli } from '../fixture';

vi.setConfig({ hookTimeout: 60000, testTimeout: 60000 });

/**
 * OAuth fixture that explicitly requests `session.firestore` — the demo provider config lists it in
 * `adminOnlyScopes`, and the test flow's default "all registered scopes" resolution drops those.
 */
const demoOAuthSuperTestContextWithFirestoreSessionScope = oAuthAuthorizedSuperTestContextFactory({
  clientName: 'demo-cli-firestore-query-oauth-context',
  scopes: `openid profile email demo offline_access model.read model.query ${FIRESTORE_SESSION_OIDC_SCOPE}`
});

/**
 * Parses a CLI stdout envelope, failing the assertion with the raw text when it is not JSON.
 *
 * @param stdoutText - Captured stdout.
 * @returns The parsed envelope.
 */
function parseEnvelope(stdoutText: string): any {
  let result: any;

  try {
    result = JSON.parse(stdoutText);
  } catch {
    throw new Error(`stdout was not a JSON envelope: ${stdoutText}`);
  }

  return result;
}

/**
 * End-to-end coverage for `firestore-queries` / `firestore-query` / `firestore-get` and `--via`,
 * against the emulators.
 *
 * ## The emulator constraint every assertion here is designed around
 *
 * `apps/demo-cli/src/test/tests/firestore-session.spec.ts` documents it in full: the Auth emulator
 * resolves a client `signInWithCustomToken` against its OWN default project, ignoring the API key,
 * while the Admin SDK stores `setCustomUserClaims` under the per-run `firebase-test-<epoch>` project.
 * The exchanged ID token therefore comes back from a different auth namespace than the one holding the
 * admin `a` claim, so rules always see an **authenticated but CLAIMLESS** token — no matter which user
 * opened the session.
 *
 * Consequences, and how they shape this spec:
 *
 * - Every direct-read assertion uses a **rules-permitted** path: published `gb` / `gbe`.
 * - `pr`-style denials (`allow list: if userClaimsIsSysAdmin()`) are the **negative** tests.
 * - Anything needing admin claims goes `--via api`, where authorization runs through
 *   `roleMapForModel` under the Admin SDK.
 *
 * App Check is also absent (`demoSessionApiModuleConfigFactory` withholds `appCheckAppId` under
 * `isTestingEnv`), so nothing here proves an attestation is required.
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

  describe('admin caller holding the session.firestore scope', () => {
    demoAuthorizedUserAdminContext({ f }, (adminUser) => {
      demoOAuthSuperTestContextWithFirestoreSessionScope({ f, u: adminUser }, (oauth) => {
        withDemoTestCli({ f, oauth }, ({ runCli }) => {
          describe('firestore-queries', () => {
            it('lists the catalog without opening a session', async () => {
              const result = await runCli(['firestore-queries']);

              expect(result.error).toBeUndefined();
              expect(result.stdoutText).toContain('SLUG');
              expect(result.stdoutText).toContain('published-guestbooks-query');
              expect(result.stdoutText).toContain('published-guestbook-entries-query');
              expect(result.stdoutText).toContain('profile-with-username-query');
            });

            it('emits three parseable entries under --json, all invocable', async () => {
              const result = await runCli(['firestore-queries', '--json']);
              const envelope = parseEnvelope(result.stdoutText);

              expect(envelope.ok).toBe(true);
              expect(envelope.data).toHaveLength(3);
              expect(envelope.data.every((e: { readonly invocable: boolean }) => e.invocable)).toBe(true);
            });
          });

          describe('with a published guestbook and entry', () => {
            demoGuestbookContext({ f, name: 'Firestore Query Guestbook', published: true }, (g) => {
              demoGuestbookEntryContext({ f, u: adminUser, g, message: 'queried directly', published: true }, (e) => {
                describe('firestore-query', () => {
                  it('returns DECODED rows carrying full gb/x/gbe/y keys', async () => {
                    const result = await runCli(['firestore-query', 'published-guestbook-entries-query', '--params', '{"published":true}']);
                    const envelope = parseEnvelope(result.stdoutText);

                    expect(result.error).toBeUndefined();
                    expect(envelope.ok).toBe(true);
                    expect(envelope.data.source).toBe('firestore');
                    expect(envelope.data.scope).toBe('COLLECTION_GROUP');

                    const row = envelope.data.rows.find((r: { readonly key: string }) => r.key === e.documentKey);
                    expect(row).toBeDefined();
                    expect(row.key).toContain(`${g.documentKey}/gbe/`);
                    // decoded, not raw: `message` is the long-form field name the converter produces
                    expect(row.data.message).toBe('queried directly');
                    expect(row.data.published).toBe(true);
                  });

                  it('narrows to one parent under --parent', async () => {
                    const all = parseEnvelope((await runCli(['firestore-query', 'published-guestbook-entries-query', '--params', '{"published":true}'])).stdoutText);
                    const scoped = parseEnvelope((await runCli(['firestore-query', 'published-guestbook-entries-query', '--params', '{"published":true}', '--parent', g.documentKey])).stdoutText);

                    expect(scoped.ok).toBe(true);
                    expect(scoped.data.parent).toBe(g.documentKey);
                    expect(scoped.data.count).toBeGreaterThan(0);
                    expect(scoped.data.count).toBeLessThanOrEqual(all.data.count);
                    expect(scoped.data.rows.every((r: { readonly key: string }) => r.key.startsWith(g.documentKey))).toBe(true);
                  });

                  it('returns a count and no rows under --count', async () => {
                    const envelope = parseEnvelope((await runCli(['firestore-query', 'published-guestbook-entries-query', '--params', '{"published":true}', '--count'])).stdoutText);

                    expect(envelope.ok).toBe(true);
                    expect(envelope.data.count).toBeGreaterThan(0);
                    expect(envelope.data.rows).toBeUndefined();
                  });

                  it('resolves every row from its own query snapshot, decoded', async () => {
                    // The 1-read-per-row property comes from `getDocSnapshotDataPairs()` + the per-document
                    // converter; `getDocs()` would cost 2N because `queryLike` is converter-less on a
                    // collection group and re-loads each matched document from its ref purely to convert it.
                    // Which method actually runs is pinned structurally by
                    // `packages/dbx-cli/src/lib/firestore/firestore-query.command.spec.ts`, whose stub
                    // collection only offers `getDocSnapshotDataPairs` / `countDocs`. What is observable
                    // from out here is the consequence: one decoded row per matched document, no extras.
                    const envelope = parseEnvelope((await runCli(['firestore-query', 'published-guestbook-entries-query', '--params', '{"published":true}'])).stdoutText);
                    const keys = envelope.data.rows.map((r: { readonly key: string }) => r.key);

                    expect(envelope.data.rows).toHaveLength(envelope.data.count);
                    expect(new Set(keys).size).toBe(keys.length);
                    expect(envelope.data.rows.every((r: { readonly data: { readonly message?: string } }) => typeof r.data.message === 'string')).toBe(true);
                  });

                  it('refuses a rules-denied query with a clean PERMISSION_DENIED', async () => {
                    // `/pr` is `allow list: if userClaimsIsSysAdmin()` and the emulator session is claimless
                    const result = await runCli(['firestore-query', 'profile-with-username-query', '--params', '{"username":"nobody"}']);
                    const envelope = parseEnvelope(result.stdoutText);

                    expect(envelope.ok).toBe(false);
                    expect(envelope.code).toBe('AUTH_FORBIDDEN');
                  });
                });

                describe('firestore-get', () => {
                  it('matches `get` field-for-field, with meta.source: firestore', async () => {
                    const direct = parseEnvelope((await runCli(['firestore-get', g.documentKey])).stdoutText);
                    const overApi = parseEnvelope((await runCli(['get', g.documentKey, '--via', 'api'])).stdoutText);

                    expect(direct.ok).toBe(true);
                    expect(direct.meta.source).toBe('firestore');
                    expect(overApi.meta.source).toBe('api');
                    expect(direct.data.key).toBe(overApi.data.key);
                    expect(direct.data.data).toEqual(overApi.data.data);
                  });
                });

                describe('get --via', () => {
                  it('goes direct under --via firestore and reports it on meta', async () => {
                    const envelope = parseEnvelope((await runCli(['get', g.documentKey, '--via', 'firestore'])).stdoutText);

                    expect(envelope.ok).toBe(true);
                    expect(envelope.meta).toMatchObject({ source: 'firestore', via: 'firestore', reason: 'explicit' });
                    expect(envelope.data.data.name).toBe('Firestore Query Guestbook');
                  });

                  it('goes direct under the default --via auto', async () => {
                    const envelope = parseEnvelope((await runCli(['get', g.documentKey])).stdoutText);

                    expect(envelope.ok).toBe(true);
                    expect(envelope.meta).toMatchObject({ source: 'firestore', via: 'auto', reason: 'session-available' });
                  });

                  it('rejects an unknown --via value', async () => {
                    const result = await runCli(['get', g.documentKey, '--via', 'grpc']);
                    expect(result.error ?? new Error(result.stdoutText)).toBeDefined();
                    expect(`${result.error?.message ?? ''}${result.stderrText}${result.stdoutText}`).toMatch(/grpc/);
                  });
                });
              });
            });
          });

          describe('server-only models', () => {
            it.each(['api', 'firestore', 'auto'])('refuses `get sys/<id>` with MODEL_IS_SERVER_ONLY on --via %s', async (via) => {
              const result = await runCli(['get', 'sys/anything', '--via', via]);
              const envelope = parseEnvelope(result.stdoutText);

              expect(envelope.ok).toBe(false);
              expect(envelope.code).toBe('MODEL_IS_SERVER_ONLY');
              expect(envelope.suggestion).toContain('sys');
            });

            it('refuses `firestore-get sys/<id>` before opening a session', async () => {
              const envelope = parseEnvelope((await runCli(['firestore-get', 'sys/anything'])).stdoutText);

              expect(envelope.ok).toBe(false);
              expect(envelope.code).toBe('MODEL_IS_SERVER_ONLY');
            });

            it('refuses `model systemState get` on the per-model command too', async () => {
              const envelope = parseEnvelope((await runCli(['model', 'systemState', 'get', 'anything'])).stdoutText);

              expect(envelope.ok).toBe(false);
              expect(envelope.code).toBe('MODEL_IS_SERVER_ONLY');
            });
          });

          describe('doctor', () => {
            it('reports the resolved read preference and the catalog/server-only counts', async () => {
              const result = await runCli(['doctor']);
              const envelope = parseEnvelope(result.stdoutText);
              const check = envelope.data.checks.find((c: { readonly name: string }) => c.name === 'firestore-session');

              expect(check).toBeDefined();
              expect(check.detail.readRouting).toMatchObject({ getFirestoreModels: true, invocableQueryEntries: 3, totalQueryEntries: 3 });
              expect(['firestore', 'api']).toContain(check.detail.readRouting.readPreference);
              expect(check.detail.readRouting.serverOnlyModels).toBeGreaterThan(0);
            });
          });
        });
      });
    });
  });
});
