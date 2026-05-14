import { type CreateGuestbookParams, guestbookIdentity } from 'demo-firebase';
import { type OnCallCreateModelResult, onCallCreateModelParams } from '@dereekb/firebase';
// eslint-disable-next-line @nx/enforce-module-boundaries -- demo-api fixture is intentionally shared with demo-cli specs (see apps/demo-cli/src/test/fixture.ts for the established pattern).
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoOAuthAuthorizedSuperTestContext } from 'demo-api/test';
import { withDemoTestCli } from '../fixture';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

/**
 * Sanity coverage for demo-cli's authenticated `get` / `get-many` flow.
 *
 * Drives the CLI in-process via `createCli().parse()` with a `testCliContext` built from the OAuth
 * fixture's access token and the fixture-listening NestJS app's `apiBaseUrl`. Exercises the same
 * `/api/model/<modelType>/get` endpoints that {@link model.api.get.e2e.spec.ts} covers, but through
 * the CLI surface so we catch regressions in argv parsing, manifest-driven key→modelType resolution,
 * the HTTP client, and the output formatter end-to-end.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  demoAuthorizedUserAdminContext({ f }, (u) => {
    demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
      async function createPublishedGuestbook(name: string): Promise<string> {
        const params: CreateGuestbookParams = { name };
        const body = onCallCreateModelParams(guestbookIdentity, params);
        const res = await oauth.authRequest('post', '/api/model/call').send(body).expect(201);
        const result = res.body as OnCallCreateModelResult;
        const key = result.modelKeys[0];

        const accessor = f.instance.demoFirestoreCollections.guestbookCollection.documentAccessor();
        const document = accessor.loadDocumentForKey(key);
        await document.accessor.set({ name, published: true, locked: false });

        return key;
      }

      withDemoTestCli({ f, oauth }, ({ runCli }) => {
        describe('demo-cli get <key>', () => {
          it('reads a single guestbook by key', async () => {
            const key = await createPublishedGuestbook('CLI Single Read');

            const result = await runCli(['get', key]);

            expect(result.error).toBeUndefined();
            expect(result.stdoutText).toContain('CLI Single Read');
            expect(result.stdoutText).toContain(key);
          });

          it('emits a NOT_FOUND CliError envelope and exits 1 when the key is unknown', async () => {
            const result = await runCli(['get', `${guestbookIdentity.collectionName}/does-not-exist-12345`]);

            expect(result.exitCode).toBe(1);
            const combined = `${result.stdoutText}${result.stderrText}`;
            expect(combined.toLowerCase()).toMatch(/not.?found|404/);
          });
        });

        describe('demo-cli get-many <key...>', () => {
          it('batch-reads multiple guestbooks in a single request', async () => {
            const keyA = await createPublishedGuestbook('CLI Multi A');
            const keyB = await createPublishedGuestbook('CLI Multi B');

            const result = await runCli(['get-many', keyA, keyB]);

            expect(result.error).toBeUndefined();
            expect(result.stdoutText).toContain('CLI Multi A');
            expect(result.stdoutText).toContain('CLI Multi B');
          });
        });
      });
    });
  });
});
