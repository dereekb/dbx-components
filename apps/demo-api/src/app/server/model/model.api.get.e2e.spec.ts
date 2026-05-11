import { type CreateGuestbookParams, guestbookIdentity } from 'demo-firebase';
import { type OnCallCreateModelResult, onCallCreateModelParams } from '@dereekb/firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoOAuthAuthorizedSuperTestContext } from '../../../test/fixture';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

/**
 * Regression coverage for the model document-access routes
 * (`GET/POST /api/model/:modelType/get`) under OIDC bearer auth.
 *
 * Before the fix, `ModelApiGetService._makeAuthRef` replaced the synthetic
 * `auth.token` with the stripped `oidcValidatedToken` subset. That subset
 * omits `iat`/`auth_time`, so downstream `firebaseAuthTokenFromDecodedIdToken`
 * called `new Date(undefined).toISOString()` and threw a
 * `RangeError("Invalid time value")`. Every read returned HTTP 500.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  // Guestbook reads are admin-only (`grantFullAccessIfAdmin`), so the OAuth user
  // must be an admin to exercise the document-access routes end-to-end.
  demoAuthorizedUserAdminContext({ f }, (u) => {
    demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
      async function createGuestbook(name: string): Promise<string> {
        const params: CreateGuestbookParams = { name };
        const body = onCallCreateModelParams(guestbookIdentity, params);
        const res = await oauth.authRequest('post', '/api/model/call').send(body).expect(201);
        const result = res.body as OnCallCreateModelResult;
        const key = result.modelKeys[0];

        // create handler only sets `name`; mark published so a non-admin OAuth user can read it
        const accessor = f.instance.demoFirestoreCollections.guestbookCollection.documentAccessor();
        const document = accessor.loadDocumentForKey(key);
        await document.accessor.set({ name, published: true, locked: false });

        return key;
      }

      describe('GET /api/model/:modelType/get', () => {
        it('reads a single document by key', async () => {
          const key = await createGuestbook('Single Read');

          const res = await oauth.authRequest('get', `/api/model/${guestbookIdentity.modelType}/get?key=${encodeURIComponent(key)}`).expect(200);

          expect(res.body).toBeDefined();
          expect(res.body.key).toBe(key);
          expect(res.body.data).toBeDefined();
          expect(res.body.data.name).toBe('Single Read');
        });
      });

      describe('POST /api/model/:modelType/get', () => {
        it('reads multiple documents by key', async () => {
          const keyA = await createGuestbook('Multi A');
          const keyB = await createGuestbook('Multi B');

          const res = await oauth
            .authRequest('post', `/api/model/${guestbookIdentity.modelType}/get`)
            .send({ keys: [keyA, keyB] })
            .expect(201);

          expect(res.body).toBeDefined();
          expect(Array.isArray(res.body.results)).toBe(true);
          expect(res.body.results).toHaveLength(2);
          expect(Array.isArray(res.body.errors)).toBe(true);
          expect(res.body.errors).toHaveLength(0);

          const byKey = new Map<string, { name: string }>(res.body.results.map((r: { key: string; data: { name: string } }) => [r.key, r.data]));
          expect(byKey.get(keyA)?.name).toBe('Multi A');
          expect(byKey.get(keyB)?.name).toBe('Multi B');
        });
      });
    });
  });
});
