import request from 'supertest';
import { type CreateGuestbookParams, type QueryGuestbooksParams, guestbookIdentity } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoAuthorizedUserAdminContext, demoOAuthAuthorizedSuperTestContext } from '../../../test/fixture';
import { type OnCallCreateModelResult, type OnCallQueryModelResult, onCallCreateModelParams, onCallQueryModelParams } from '@dereekb/firebase';

vi.setConfig({ hookTimeout: 20000, testTimeout: 20000 });

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  // MARK: Helper
  async function createGuestbookViaApi(oauth: { authRequest: (method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string) => any }, name: string, published = true): Promise<OnCallCreateModelResult> {
    const params: CreateGuestbookParams = { name };
    const body = onCallCreateModelParams(guestbookIdentity, params);

    const res = await oauth.authRequest('post', '/api/model/call').send(body).expect(201);
    const result = res.body as OnCallCreateModelResult;

    // Set the published/locked fields directly (create only sets the name)
    const accessor = f.instance.demoFirestoreCollections.guestbookCollection.documentAccessor();
    const document = accessor.loadDocumentForKey(result.modelKeys[0]);
    await document.accessor.set({ name, published, locked: false });

    return result;
  }

  // MARK: Unauthenticated
  describe('unauthenticated requests', () => {
    let server: any;

    beforeEach(async () => {
      const app = await f.loadInitializedNestApplication();
      server = app.getHttpServer();
    });

    it('should return 401 when creating a guestbook without auth', async () => {
      const params: CreateGuestbookParams = { name: 'Unauthorized' };
      const body = onCallCreateModelParams(guestbookIdentity, params);

      const res = await request(server).post('/api/model/call').send(body);
      expect(res.status).toBe(401);
    });

    it('should return 401 when querying guestbooks without auth', async () => {
      const queryParams: QueryGuestbooksParams = { published: true };
      const body = onCallQueryModelParams(guestbookIdentity, queryParams);

      const res = await request(server).post('/api/model/call').send(body);
      expect(res.status).toBe(401);
    });

    it('should return 401 with an invalid bearer token', async () => {
      const params: CreateGuestbookParams = { name: 'BadToken' };
      const body = onCallCreateModelParams(guestbookIdentity, params);

      const res = await request(server).post('/api/model/call').set('Authorization', 'Bearer invalid-token').send(body);
      expect(res.status).toBe(401);
    });
  });

  demoAuthorizedUserContext({ f }, (u) => {
    demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
      it('should get userinfo via /oidc/me', async () => {
        const res = await oauth.authRequest('get', '/oidc/me').expect(200);
        expect(res.body.sub).toBe(u.uid);
      });

      // MARK: Create
      describe('create guestbook via API', () => {
        it('should create a guestbook via POST /api/model/call', async () => {
          const params: CreateGuestbookParams = { name: 'API Test Guestbook' };
          const body = onCallCreateModelParams(guestbookIdentity, params);

          const res = await oauth.authRequest('post', '/api/model/call').send(body).expect(201);

          expect(res.body).toBeDefined();
          expect(res.body.modelKeys).toBeDefined();
          expect(res.body.modelKeys[0]).toBeDefined();

          // Verify the document was actually created
          const accessor = f.instance.demoFirestoreCollections.guestbookCollection.documentAccessor();
          const document = accessor.loadDocumentForKey(res.body.modelKeys[0]);
          const data = await document.snapshotData();
          expect(data).toBeDefined();
          expect(data?.name).toBe('API Test Guestbook');
        });
      });

      // MARK: Query
      describe('query guestbooks via API', () => {
        it('should query published guestbooks', async () => {
          await createGuestbookViaApi(oauth, 'Alpha');
          await createGuestbookViaApi(oauth, 'Beta');

          const queryParams: QueryGuestbooksParams = { published: true };
          const body = onCallQueryModelParams(guestbookIdentity, queryParams);

          const res = await oauth.authRequest('post', '/api/model/call').send(body).expect(201);
          const result = res.body as OnCallQueryModelResult;

          expect(result).toBeDefined();
          expect(result.results).toBeDefined();
          expect(result.count).toBeGreaterThanOrEqual(2);
          expect(result.keys.length).toBe(result.count);
        });

        it('should only return published guestbooks when filtering published=true', async () => {
          await createGuestbookViaApi(oauth, 'Published', true);
          await createGuestbookViaApi(oauth, 'Unpublished', false);

          const queryParams: QueryGuestbooksParams = { published: true };
          const body = onCallQueryModelParams(guestbookIdentity, queryParams);

          const res = await oauth.authRequest('post', '/api/model/call').send(body).expect(201);
          const result = res.body as OnCallQueryModelResult;

          expect(result).toBeDefined();
          expect(result.results.length).toBeGreaterThanOrEqual(1);

          for (const doc of result.results as any[]) {
            expect(doc.published).toBe(true);
          }
        });

        it('should default to published=true for non-admin queries without published filter', async () => {
          await createGuestbookViaApi(oauth, 'PublishedBook', true);
          await createGuestbookViaApi(oauth, 'UnpublishedBook', false);

          const queryParams: QueryGuestbooksParams = {};
          const body = onCallQueryModelParams(guestbookIdentity, queryParams);

          const res = await oauth.authRequest('post', '/api/model/call').send(body).expect(201);
          const result = res.body as OnCallQueryModelResult;

          expect(result).toBeDefined();

          for (const doc of result.results as any[]) {
            expect(doc.published).toBe(true);
          }
        });
      });
    });
  });

  // MARK: Admin Query
  describe('admin queries', () => {
    demoAuthorizedUserAdminContext({ f }, (u) => {
      demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
        it('should allow admin to query all guestbooks without published filter', async () => {
          await createGuestbookViaApi(oauth, 'AdminAlpha');
          await createGuestbookViaApi(oauth, 'AdminBeta', false);

          const queryParams: QueryGuestbooksParams = {};
          const body = onCallQueryModelParams(guestbookIdentity, queryParams);

          const res = await oauth.authRequest('post', '/api/model/call').send(body).expect(201);
          const result = res.body as OnCallQueryModelResult;

          expect(result).toBeDefined();
          expect(result.count).toBeGreaterThanOrEqual(2);
        });
      });
    });
  });
});
