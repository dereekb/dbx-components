import { demoCallModel } from './../model/crud.functions';
import { type CreateGuestbookParams, type QueryGuestbooksParams, type QueryGuestbookEntriesParams, guestbookIdentity, guestbookEntryIdentity, type InsertGuestbookEntryParams } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoGuestbookContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { type OnCallCreateModelResult, type OnCallQueryModelResult, onCallCreateModelParams, onCallQueryModelParams, onCallUpdateModelParams } from '@dereekb/firebase';
import { AUTH_ADMIN_ROLE } from '@dereekb/util';
import { BAD_DOCUMENT_QUERY_CURSOR_ERROR_CODE } from '@dereekb/firebase';
import { firebaseServerErrorInfo } from '@dereekb/firebase-server';

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('createGuestbook', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      it('should create a guestbook.', async () => {
        const name = 'testName';

        const params: CreateGuestbookParams = {
          name
        };

        const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(guestbookIdentity, params))) as OnCallCreateModelResult;

        expect(result).toBeDefined();
        expect(result.modelKeys).toBeDefined();

        const createdModelKey = result.modelKeys[0];
        expect(createdModelKey).toBeDefined();

        const accessor = f.instance.demoFirestoreCollections.guestbookCollection.documentAccessor();
        const document = accessor.loadDocumentForKey(createdModelKey);

        const exists = await document.accessor.exists();
        expect(exists).toBe(true);

        const data = await document.snapshotData();
        expect(data).toBeDefined();
        expect(data?.name).toBe(name);
      });
    });
  });

  // MARK: Query Guestbooks
  describeCallableRequestTest('queryGuestbooks', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      async function createGuestbook(name: string, published = true) {
        const params: CreateGuestbookParams = { name };
        const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(guestbookIdentity, params))) as OnCallCreateModelResult;

        const accessor = f.instance.demoFirestoreCollections.guestbookCollection.documentAccessor();
        const document = accessor.loadDocumentForKey(result.modelKeys[0]);
        await document.accessor.set({ name, published, locked: false });

        return result;
      }

      it('should query published guestbooks', async () => {
        await createGuestbook('Alpha');
        await createGuestbook('Beta');

        const queryParams: QueryGuestbooksParams = { published: true };
        const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookIdentity, queryParams))) as OnCallQueryModelResult;

        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(result.count).toBeGreaterThanOrEqual(2);
        expect(result.keys.length).toBe(result.count);
      });

      it('should only return published guestbooks when filtering published=true', async () => {
        await createGuestbook('Published', true);
        await createGuestbook('Unpublished', false);

        const queryParams: QueryGuestbooksParams = { published: true };
        const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookIdentity, queryParams))) as OnCallQueryModelResult;

        expect(result).toBeDefined();
        expect(result.results.length).toBeGreaterThanOrEqual(1);

        for (const doc of result.results as any[]) {
          expect(doc.published).toBe(true);
        }
      });

      it('should throw forbidden when non-admin queries unpublished guestbooks', async () => {
        await createGuestbook('SomeBook');

        // Querying with published=false requires admin
        const queryParams: QueryGuestbooksParams = { published: false };

        await expect(u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookIdentity, queryParams))).rejects.toThrow();
      });

      it('should default to published=true for non-admin queries without published filter', async () => {
        await createGuestbook('PublishedBook', true);
        await createGuestbook('UnpublishedBook', false);

        // Non-admin without published filter gets defaultValue=true via resolveAdminOnlyValue
        const queryParams: QueryGuestbooksParams = {};
        const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookIdentity, queryParams))) as OnCallQueryModelResult;

        expect(result).toBeDefined();

        // Should only contain published guestbooks
        for (const doc of result.results as any[]) {
          expect(doc.published).toBe(true);
        }
      });

      it('should allow admin to query all guestbooks without published filter', async () => {
        await f.instance.authService.userContext(u.uid).addRoles([AUTH_ADMIN_ROLE]);

        await createGuestbook('Alpha');
        await createGuestbook('Beta', false);

        const queryParams: QueryGuestbooksParams = {};
        const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookIdentity, queryParams))) as OnCallQueryModelResult;

        expect(result).toBeDefined();
        expect(result.count).toBeGreaterThanOrEqual(2);
      });

      it('should respect the limit parameter', async () => {
        await createGuestbook('One');
        await createGuestbook('Two');
        await createGuestbook('Three');

        const queryParams: QueryGuestbooksParams = { published: true, limit: 1 };
        const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookIdentity, queryParams))) as OnCallQueryModelResult;

        expect(result).toBeDefined();
        expect(result.count).toBe(1);
        expect(result.hasMore).toBe(true);
        expect(result.cursorDocumentKey).toBeDefined();
      });

      it('should paginate with cursor', async () => {
        // Grant admin so useModel('guestbook', { roles: 'read' }) succeeds for cursor loading
        await f.instance.authService.userContext(u.uid).addRoles([AUTH_ADMIN_ROLE]);

        await createGuestbook('AAA');
        await createGuestbook('BBB');
        await createGuestbook('CCC');

        // First page
        const firstPageParams: QueryGuestbooksParams = { published: true, limit: 2 };
        const firstPage = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookIdentity, firstPageParams))) as OnCallQueryModelResult;

        expect(firstPage.count).toBe(2);
        expect(firstPage.hasMore).toBe(true);
        expect(firstPage.cursorDocumentKey).toBeDefined();

        // Second page using cursor
        const secondPageParams: QueryGuestbooksParams = { published: true, limit: 2, cursorDocumentKey: firstPage.cursorDocumentKey };
        const secondPage = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookIdentity, secondPageParams))) as OnCallQueryModelResult;

        expect(secondPage.count).toBeGreaterThanOrEqual(1);

        // Keys should not overlap between pages
        const firstPageKeys = new Set(firstPage.keys);

        for (const key of secondPage.keys) {
          expect(firstPageKeys.has(key)).toBe(false);
        }
      });

      it('should throw BAD_DOCUMENT_QUERY_CURSOR when cursor document does not exist', async () => {
        // Grant admin so the permission check and admin assertion both pass
        await f.instance.authService.userContext(u.uid).addRoles([AUTH_ADMIN_ROLE]);

        const nonExistentKey = 'gb/does_not_exist_abc123';
        const queryParams: QueryGuestbooksParams = { published: true, limit: 1, cursorDocumentKey: nonExistentKey };

        try {
          await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookIdentity, queryParams));
          expect.fail('Expected an error to be thrown');
        } catch (e: unknown) {
          const errorInfo = firebaseServerErrorInfo(e);
          expect(errorInfo.serverErrorCode).toBe(BAD_DOCUMENT_QUERY_CURSOR_ERROR_CODE);
        }
      });

      it('should throw BAD_DOCUMENT_QUERY_CURSOR when user lacks permission to read the cursor document', async () => {
        // Do NOT grant admin — the user can query published guestbooks but can't read cursor via useModel
        await createGuestbook('CursorTarget');

        // First page succeeds (published=true, no cursor)
        const firstPageParams: QueryGuestbooksParams = { published: true, limit: 1 };
        const firstPage = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookIdentity, firstPageParams))) as OnCallQueryModelResult;

        expect(firstPage.cursorDocumentKey).toBeDefined();

        // Second page with cursor — fails because non-admin can't read cursor document via useModel
        const secondPageParams: QueryGuestbooksParams = { published: true, limit: 1, cursorDocumentKey: firstPage.cursorDocumentKey };

        try {
          await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookIdentity, secondPageParams));
          expect.fail('Expected an error to be thrown');
        } catch (e: unknown) {
          const errorInfo = firebaseServerErrorInfo(e);
          expect(errorInfo.serverErrorCode).toBe(BAD_DOCUMENT_QUERY_CURSOR_ERROR_CODE);
        }
      });
    });
  });

  // MARK: Query Guestbook Entries
  describeCallableRequestTest('queryGuestbookEntries', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      demoGuestbookContext({ f, published: true }, (g) => {
        // Grant admin so useModel('guestbook', { roles: 'read' }) succeeds for parent access
        beforeEach(async () => {
          await f.instance.authService.userContext(u.uid).addRoles([AUTH_ADMIN_ROLE]);
        });

        async function createGuestbookEntry(message: string, published = true) {
          const params: InsertGuestbookEntryParams = {
            guestbook: g.documentId,
            message,
            signed: 'tester',
            published
          };

          await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(guestbookEntryIdentity, params));
        }

        it('should query published entries for a guestbook', async () => {
          await createGuestbookEntry('Hello world');

          // Non-admin default: published=true via resolveAdminOnlyValue
          const queryParams: QueryGuestbookEntriesParams = { guestbook: g.document.key, published: true };
          const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookEntryIdentity, queryParams))) as OnCallQueryModelResult;

          expect(result).toBeDefined();
          expect(result.count).toBeGreaterThanOrEqual(1);
          expect(result.keys.length).toBe(result.count);
        });

        it('should only return published entries when filtering published=true', async () => {
          await createGuestbookEntry('Published entry', true);

          const queryParams: QueryGuestbookEntriesParams = { guestbook: g.document.key, published: true };
          const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookEntryIdentity, queryParams))) as OnCallQueryModelResult;

          expect(result).toBeDefined();
          expect(result.results.length).toBeGreaterThanOrEqual(1);

          for (const doc of result.results as any[]) {
            expect(doc.published).toBe(true);
          }
        });

        it('should allow admin to query all entries without published filter', async () => {
          await createGuestbookEntry('Some entry');

          const queryParams: QueryGuestbookEntriesParams = { guestbook: g.document.key };
          const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookEntryIdentity, queryParams))) as OnCallQueryModelResult;

          expect(result).toBeDefined();
          expect(result.count).toBeGreaterThanOrEqual(1);
        });

        it('should respect the limit parameter', async () => {
          await createGuestbookEntry('Entry one');

          const queryParams: QueryGuestbookEntriesParams = { guestbook: g.document.key, published: true, limit: 1 };
          const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookEntryIdentity, queryParams))) as OnCallQueryModelResult;

          expect(result).toBeDefined();
          expect(result.count).toBeLessThanOrEqual(1);
        });

        it('should paginate with cursor', async () => {
          await createGuestbookEntry('My entry');

          const firstPageParams: QueryGuestbookEntriesParams = { guestbook: g.document.key, published: true, limit: 1 };
          const firstPage = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookEntryIdentity, firstPageParams))) as OnCallQueryModelResult;

          expect(firstPage).toBeDefined();
          expect(firstPage.count).toBe(1);

          if (firstPage.cursorDocumentKey) {
            const secondPageParams: QueryGuestbookEntriesParams = { guestbook: g.document.key, published: true, limit: 1, cursorDocumentKey: firstPage.cursorDocumentKey };
            const secondPage = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookEntryIdentity, secondPageParams))) as OnCallQueryModelResult;

            expect(secondPage).toBeDefined();

            const firstPageKeys = new Set(firstPage.keys);

            for (const key of secondPage.keys) {
              expect(firstPageKeys.has(key)).toBe(false);
            }
          }
        });
      });
    });
  });
});
