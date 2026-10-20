import request from 'supertest';
import { DOCS_API_CACHE_CONTROL, DOCS_NOT_FOUND_ERROR_CODE, DOCS_SECTION_NOT_FOUND_ERROR_CODE, FIREBASE_SERVER_DOCS_API_PROTECTED_PATH, type DocsListResult, type DocsReadResult, type DocsSearchResult } from '@dereekb/firebase-server';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoAuthorizedUserContextFactory, demoOAuthAuthorizedSuperTestContext } from '../../../test/fixture';
import { DEMO_NOTIFICATION_TYPES_DOC_ID } from './docs.notification';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

const DOCS_PATH = FIREBASE_SERVER_DOCS_API_PROTECTED_PATH;
const ANY_DOC_ID = 'getting-started';
const USER_DOC_ID = 'guestbook/signing';
const ADMIN_DOC_ID = 'admin/managing-guestbooks';
const NOTIFICATION_USER_DOC_ID = 'notification/task-bots';
const DYNAMIC_USER_DOC_ID = DEMO_NOTIFICATION_TYPES_DOC_ID;
const DYNAMIC_DOC_SECTION_ID = 'calendar-event-invite-calinv';

/**
 * A user who never finished onboarding: holds no demo role, so only `any` docs are visible to them.
 */
const demoAuthorizedNotOnboardedUserContext = demoAuthorizedUserContextFactory({ onboarded: false });

/**
 * Builds the read path for a doc id (and optional section). Ids contain `/`, so they travel as a query parameter.
 *
 * @param id - The doc id.
 * @param section - Optional section id.
 * @returns The request path.
 */
function readPath(id: string, section?: string): string {
  const query = new URLSearchParams({ id, ...(section == null ? undefined : { section }) });
  return `${DOCS_PATH}/read?${query.toString()}`;
}

/**
 * Coverage for demo-api's audience-gated docs API (`GET /api/docs`, `/api/docs/search`, `/api/docs/read`), wired by
 * `DemoDocsApiModule` over the markdown in `src/assets/docs` and the `docs.manifest.json` that the
 * `generate-docs-manifest` target writes, plus the dynamic `notification/types` doc that `demoNotificationTypesDocsSource`
 * renders from the notification type registry.
 *
 * Audiences come from `demoDocsAudienceReader`: admins hold `admin` + `user`, onboarded users hold `user`, and every
 * authenticated caller holds `any`. A hidden doc and a missing doc share one 404, so a caller cannot probe for ids.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('docs API', () => {
    describe('unauthenticated caller', () => {
      it('is rejected by the bearer middleware', async () => {
        // Proves '/api/docs' is in the OIDC module's protectedPaths.
        const app = await f.loadInitializedNestApplication();
        await request(app.getHttpServer()).get(DOCS_PATH).expect(401);
        await request(app.getHttpServer()).get(readPath(ANY_DOC_ID)).expect(401);
      });
    });

    describe('admin caller', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
          it('lists every doc', async () => {
            const res = await oauth.authRequest('get', DOCS_PATH).expect(200);
            const ids = (res.body as DocsListResult).docs.map((x) => x.id);

            expect(ids).toEqual([ADMIN_DOC_ID, ANY_DOC_ID, USER_DOC_ID, NOTIFICATION_USER_DOC_ID, DYNAMIC_USER_DOC_ID]);
            expect(res.headers['cache-control']).toBe(DOCS_API_CACHE_CONTROL);
          });

          it('reads the admin doc', async () => {
            const res = await oauth.authRequest('get', readPath(ADMIN_DOC_ID)).expect(200);
            const result = res.body as DocsReadResult;

            expect(result.title).toBe('Managing guestbooks');
            expect(result.sections?.map((x) => x.id)).toContain('moderating-entries');
            // frontmatter is stripped from what is served
            expect(result.content).not.toContain('audience:');
          });
        });
      });
    });

    describe('onboarded user', () => {
      demoAuthorizedUserContext({ f }, (u) => {
        demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
          it('lists the any and user docs, never the admin doc', async () => {
            const res = await oauth.authRequest('get', DOCS_PATH).expect(200);
            const ids = (res.body as DocsListResult).docs.map((x) => x.id);

            expect(ids).toEqual([ANY_DOC_ID, USER_DOC_ID, NOTIFICATION_USER_DOC_ID, DYNAMIC_USER_DOC_ID]);
          });

          it('reads one section of the dynamic doc', async () => {
            const res = await oauth.authRequest('get', readPath(DYNAMIC_USER_DOC_ID, DYNAMIC_DOC_SECTION_ID)).expect(200);
            const result = res.body as DocsReadResult;

            expect(result.title).toBe('Notification types');
            expect(result.section?.id).toBe(DYNAMIC_DOC_SECTION_ID);
            expect(result.content).toContain('- Always delivered by: email');
            expect(result.content).not.toContain('Guestbook Entry Liked');
          });

          it('finds a section of the dynamic doc through search', async () => {
            const res = await oauth.authRequest('get', `${DOCS_PATH}/search?q=calendar%20event%20invite&limit=50`).expect(200);
            const results = (res.body as DocsSearchResult).results;

            expect(results.find((x) => x.id === DYNAMIC_USER_DOC_ID)?.section?.id).toBe(DYNAMIC_DOC_SECTION_ID);
          });

          it('searches only the docs it may see', async () => {
            const res = await oauth.authRequest('get', `${DOCS_PATH}/search?q=guestbook&limit=50`).expect(200);
            const ids = new Set((res.body as DocsSearchResult).results.map((x) => x.id));

            expect(ids.has(USER_DOC_ID)).toBe(true);
            expect(ids.has(ADMIN_DOC_ID)).toBe(false);
          });

          it('reads one section of a visible doc', async () => {
            const res = await oauth.authRequest('get', readPath(USER_DOC_ID, 'checking-an-entry')).expect(200);
            const result = res.body as DocsReadResult;

            expect(result.section?.id).toBe('checking-an-entry');
            expect(result.content).toContain('entryDetails');
            expect(result.content).not.toContain('Writing an entry');
          });

          it('answers an unknown section of a visible doc with its own 404', async () => {
            const res = await oauth.authRequest('get', readPath(USER_DOC_ID, 'no-such-section')).expect(404);
            expect(res.body.code).toBe(DOCS_SECTION_NOT_FOUND_ERROR_CODE);
          });

          it('answers a hidden doc exactly like a missing one', async () => {
            const hidden = await oauth.authRequest('get', readPath(ADMIN_DOC_ID)).expect(404);
            const missing = await oauth.authRequest('get', readPath('admin/does-not-exist')).expect(404);

            expect(hidden.body.code).toBe(DOCS_NOT_FOUND_ERROR_CODE);
            expect(missing.body.code).toBe(DOCS_NOT_FOUND_ERROR_CODE);
            expect(String(hidden.body.message).replace(ADMIN_DOC_ID, '<id>')).toBe(String(missing.body.message).replace('admin/does-not-exist', '<id>'));
          });
        });
      });
    });

    describe('user who never finished onboarding', () => {
      demoAuthorizedNotOnboardedUserContext({ f }, (u) => {
        demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
          it('lists only the any doc', async () => {
            const res = await oauth.authRequest('get', DOCS_PATH).expect(200);
            expect((res.body as DocsListResult).docs.map((x) => x.id)).toEqual([ANY_DOC_ID]);
          });

          it('reads the any doc but not the user doc', async () => {
            await oauth.authRequest('get', readPath(ANY_DOC_ID)).expect(200);
            const res = await oauth.authRequest('get', readPath(USER_DOC_ID)).expect(404);
            expect(res.body.code).toBe(DOCS_NOT_FOUND_ERROR_CODE);
          });

          it('cannot read the user-audience dynamic doc', async () => {
            const res = await oauth.authRequest('get', readPath(DYNAMIC_USER_DOC_ID)).expect(404);
            expect(res.body.code).toBe(DOCS_NOT_FOUND_ERROR_CODE);
          });
        });
      });
    });
  });
});
