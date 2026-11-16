import { DOCS_NOT_FOUND_ERROR_CODE, DOCS_SECTION_NOT_FOUND_ERROR_CODE, type DocsListResult, type DocsSearchResult } from '@dereekb/firebase';
// eslint-disable-next-line @nx/enforce-module-boundaries -- demo-api fixture is intentionally shared with demo-cli specs (see apps/demo-cli/src/test/fixture.ts for the established pattern).
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContextFactory, demoOAuthAuthorizedSuperTestContext } from 'demo-api/test';
import { withDemoTestCli } from '../fixture';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

/**
 * The dynamic doc demo-api serves from `demoNotificationTypesDocsSource` (audience `user`). Asserted on instead of the
 * file docs, which need the `docs.manifest.json` that `demo-cli:test` does not build.
 */
const NOTIFICATION_TYPES_DOC_ID = 'notification/types';
const NOTIFICATION_TYPES_SECTION_ID = 'calendar-event-invite-calinv';

const demoAuthorizedNotOnboardedUserContext = demoAuthorizedUserContextFactory({ onboarded: false });

/**
 * Coverage for the built-in authenticated `docs` group every `runCli` app CLI gets: `docs list`, `docs search` and
 * `docs read` against demo-api's live docs API, with the audience 404 for a user who never finished onboarding.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('demo-cli docs', () => {
    demoAuthorizedUserAdminContext({ f }, (u) => {
      demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
        withDemoTestCli({ f, oauth }, ({ runCli }) => {
          it('lists the visible docs as JSON with --json', async () => {
            const result = await runCli(['docs', 'list', '--json']);

            expect(result.error).toBeUndefined();
            const parsed = JSON.parse(result.stdoutText);
            expect(parsed.ok).toBe(true);
            expect((parsed.data as DocsListResult).docs.map((x) => x.id)).toContain(NOTIFICATION_TYPES_DOC_ID);
          });

          it('lists the visible docs as markdown by default', async () => {
            const result = await runCli(['docs', 'list']);

            expect(result.error).toBeUndefined();
            expect(result.stdoutText).toContain('# Docs you can read');
            expect(result.stdoutText).toContain(`\`${NOTIFICATION_TYPES_DOC_ID}\``);
          });

          it('searches the docs', async () => {
            const result = await runCli(['docs', 'search', 'notification', 'types', '--json']);

            expect(result.error).toBeUndefined();
            const parsed = JSON.parse(result.stdoutText);
            expect((parsed.data as DocsSearchResult).results.map((x) => x.id)).toContain(NOTIFICATION_TYPES_DOC_ID);
          });

          it('reads a doc as raw markdown', async () => {
            const result = await runCli(['docs', 'read', NOTIFICATION_TYPES_DOC_ID]);

            expect(result.error).toBeUndefined();
            expect(result.stdoutText.startsWith('# Notification types')).toBe(true);
          });

          it('reads one section of a doc', async () => {
            const result = await runCli(['docs', 'read', NOTIFICATION_TYPES_DOC_ID, NOTIFICATION_TYPES_SECTION_ID]);

            expect(result.error).toBeUndefined();
            expect(result.stdoutText.startsWith('### ')).toBe(true);
          });

          it('fails with DOCS_SECTION_NOT_FOUND for an unknown section', async () => {
            const result = await runCli(['docs', 'read', NOTIFICATION_TYPES_DOC_ID, 'no-such-section']);

            expect(result.exitCode).toBe(1);
            const parsed = JSON.parse(result.stdoutText);
            expect(parsed.ok).toBe(false);
            expect(parsed.serverCode).toBe(DOCS_SECTION_NOT_FOUND_ERROR_CODE);
          });

          it('fails with DOCS_NOT_FOUND and a docs list suggestion for an unknown doc', async () => {
            const result = await runCli(['docs', 'read', 'no/such-doc']);

            expect(result.exitCode).toBe(1);
            const parsed = JSON.parse(result.stdoutText);
            expect(parsed.serverCode).toBe(DOCS_NOT_FOUND_ERROR_CODE);
            expect(parsed.suggestion).toContain('docs list');
          });
        });
      });
    });

    describe('user who never finished onboarding', () => {
      demoAuthorizedNotOnboardedUserContext({ f }, (u) => {
        demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
          withDemoTestCli({ f, oauth }, ({ runCli }) => {
            it('does not list the user-audience doc', async () => {
              const result = await runCli(['docs', 'list', '--json']);

              expect(result.error).toBeUndefined();
              const parsed = JSON.parse(result.stdoutText);
              expect((parsed.data as DocsListResult).docs.map((x) => x.id)).not.toContain(NOTIFICATION_TYPES_DOC_ID);
            });

            it('reads the user-audience doc as DOCS_NOT_FOUND with the audience explanation', async () => {
              const result = await runCli(['docs', 'read', NOTIFICATION_TYPES_DOC_ID]);

              expect(result.exitCode).toBe(1);
              const parsed = JSON.parse(result.stdoutText);
              expect(parsed.serverCode).toBe(DOCS_NOT_FOUND_ERROR_CODE);
              expect(parsed.suggestion).toContain('audience');
            });
          });
        });
      });
    });
  });
});
