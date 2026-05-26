import { demoCallModel } from './../model/crud.functions';
import { type CreateGuestbookParams, type QueryGuestbooksParams, type QueryGuestbookEntriesParams, guestbookIdentity, guestbookEntryIdentity, type InsertGuestbookEntryParams, type PublishGuestbookParams } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoGuestbookContext } from '../../../test/fixture';
import { describeCallableRequestTest } from '@dereekb/firebase-server/test';
import { type OnCallCreateModelResult, type OnCallQueryModelResult, onCallCreateModelParams, onCallQueryModelParams, onCallUpdateModelParams } from '@dereekb/firebase';
import { AUTH_ADMIN_ROLE } from '@dereekb/util';
import { BAD_DOCUMENT_QUERY_CURSOR_ERROR_CODE } from '@dereekb/firebase';
import { firebaseServerErrorInfo } from '@dereekb/firebase-server';
import { MODEL_GET_TOOL_NAME } from '@dereekb/firebase-server/mcp';
import { callMcpTool } from '../../../test/mcp';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describeCallableRequestTest('guestbookCreate', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
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
        // the create function stamps the authed caller as the creator
        expect(data?.cby).toBe(u.uid);
      });
    });
  });

  // MARK: Query Guestbooks
  describeCallableRequestTest('guestbookQuery', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
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

      it('should let a non-admin paginate published guestbooks since published cursor docs are readable', async () => {
        // Do NOT grant admin — published guestbooks are readable by anyone, so the cursor document loads fine
        await createGuestbook('CursorTargetA');
        await createGuestbook('CursorTargetB');

        // First page succeeds (published=true, no cursor)
        const firstPageParams: QueryGuestbooksParams = { published: true, limit: 1 };
        const firstPage = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookIdentity, firstPageParams))) as OnCallQueryModelResult;

        expect(firstPage.cursorDocumentKey).toBeDefined();

        // Second page with cursor — succeeds because the published cursor document is readable by a non-admin
        const secondPageParams: QueryGuestbooksParams = { published: true, limit: 1, cursorDocumentKey: firstPage.cursorDocumentKey };
        const secondPage = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(guestbookIdentity, secondPageParams))) as OnCallQueryModelResult;

        expect(secondPage).toBeDefined();

        // keys should not overlap between pages
        const firstPageKeys = new Set(firstPage.keys);

        for (const key of secondPage.keys) {
          expect(firstPageKeys.has(key)).toBe(false);
        }
      });
    });
  });

  // MARK: Publish
  describeCallableRequestTest('guestbookPublish', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      describe('when caller is admin', () => {
        beforeEach(async () => {
          await f.instance.authService.userContext(u.uid).addRoles([AUTH_ADMIN_ROLE]);
        });

        demoGuestbookContext({ f, published: false }, (g) => {
          it('should publish an unpublished guestbook', async () => {
            const params: PublishGuestbookParams = { key: g.document.key };
            await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(guestbookIdentity, params, 'publish'));

            const data = await g.document.snapshotData();
            expect(data?.published).toBe(true);
          });

          it('should be idempotent when publishing an already-published guestbook', async () => {
            const params: PublishGuestbookParams = { key: g.document.key };
            await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(guestbookIdentity, params, 'publish'));
            await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(guestbookIdentity, params, 'publish'));

            const data = await g.document.snapshotData();
            expect(data?.published).toBe(true);
          });
        });

        demoGuestbookContext({ f, published: false, locked: true }, (g) => {
          it('should reject publishing a locked guestbook', async () => {
            const params: PublishGuestbookParams = { key: g.document.key };

            await expect(u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(guestbookIdentity, params, 'publish'))).rejects.toThrow();

            const data = await g.document.snapshotData();
            expect(data?.published).toBe(false);
          });
        });
      });

      describe('when caller is not admin', () => {
        demoGuestbookContext({ f, published: false }, (g) => {
          it('should be forbidden from publishing', async () => {
            const params: PublishGuestbookParams = { key: g.document.key };

            await expect(u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(guestbookIdentity, params, 'publish'))).rejects.toThrow();

            const data = await g.document.snapshotData();
            expect(data?.published).toBe(false);
          });
        });
      });
    });
  });

  // MARK: Read & creator permissions
  describeCallableRequestTest('guestbookRead', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserContext({ f }, (u) => {
      async function createGuestbookForUser(name: string): Promise<string> {
        const params: CreateGuestbookParams = { name };
        const result = (await u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(guestbookIdentity, params))) as OnCallCreateModelResult;
        return result.modelKeys[0];
      }

      it('should allow a non-admin to read a published guestbook by key', async () => {
        const key = await createGuestbookForUser('ReadablePublished');

        // publish it via a merge update so the cby stamped by the create function is preserved
        const guestbookAccessor = f.instance.demoFirestoreCollections.guestbookCollection.documentAccessor();
        await guestbookAccessor.loadDocumentForKey(key).accessor.update({ published: true });

        const result = await callMcpTool({ f, u, name: MODEL_GET_TOOL_NAME, args: { modelType: guestbookIdentity.modelType, keys: [key] } });

        expect(result.isError).toBeUndefined();

        const structured = result.structuredContent as { readonly results: ReadonlyArray<{ readonly key: string; readonly data: { readonly name: string } }>; readonly errors: ReadonlyArray<unknown> };
        expect(structured.errors).toHaveLength(0);
        expect(structured.results).toHaveLength(1);
        expect(structured.results[0].key).toBe(key);
        expect(structured.results[0].data.name).toBe('ReadablePublished');
      });

      it('should allow the creator to read their own unpublished guestbook', async () => {
        const key = await createGuestbookForUser('OwnerReadableUnpublished');

        const result = await callMcpTool({ f, u, name: MODEL_GET_TOOL_NAME, args: { modelType: guestbookIdentity.modelType, keys: [key] } });

        expect(result.isError).toBeUndefined();

        const structured = result.structuredContent as { readonly results: ReadonlyArray<{ readonly key: string; readonly data: { readonly published: boolean } }>; readonly errors: ReadonlyArray<unknown> };
        expect(structured.errors).toHaveLength(0);
        expect(structured.results).toHaveLength(1);
        expect(structured.results[0].key).toBe(key);
        expect(structured.results[0].data.published).toBe(false);
      });

      it('should forbid a non-admin from reading an unpublished guestbook they do not own', async () => {
        // seed an unpublished guestbook owned by a different user
        const guestbookAccessor = f.instance.demoFirestoreCollections.guestbookCollection.documentAccessor();
        const document = guestbookAccessor.newDocument();
        await document.create({ name: 'PrivateBook', published: false, locked: false, cby: 'some-other-uid' });

        const result = await callMcpTool({ f, u, name: MODEL_GET_TOOL_NAME, args: { modelType: guestbookIdentity.modelType, keys: [document.key] } });

        expect(result.isError).toBeUndefined();

        const structured = result.structuredContent as { readonly results: ReadonlyArray<unknown>; readonly errors: ReadonlyArray<{ readonly key: string }> };
        expect(structured.results).toHaveLength(0);
        expect(structured.errors).toHaveLength(1);
        expect(structured.errors[0].key).toBe(document.key);
      });

      it('should allow the creator (cby) to publish their own guestbook', async () => {
        const key = await createGuestbookForUser('OwnerPublishable');

        const params: PublishGuestbookParams = { key };
        await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(guestbookIdentity, params, 'publish'));

        const guestbookAccessor = f.instance.demoFirestoreCollections.guestbookCollection.documentAccessor();
        const data = await guestbookAccessor.loadDocumentForKey(key).snapshotData();
        expect(data?.published).toBe(true);
      });
    });
  });

  // MARK: Query Guestbook Entries
  describeCallableRequestTest('guestbookEntryQuery', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
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

          await u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(guestbookEntryIdentity, params, 'insert'));
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
