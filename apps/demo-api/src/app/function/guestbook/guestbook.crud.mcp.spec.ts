import { type CreateGuestbookParams, guestbookIdentity, guestbookEntryIdentity, type AllPublishedGuestbookEntriesParams } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoGuestbookContext, demoGuestbookEntryContext } from '../../../test/fixture';
import { callMcpMethod, callMcpMethodAnonymous, describeMcpMethod, searchMcpMethods } from '../../../test/mcp';
import { AUTH_ADMIN_ROLE } from '@dereekb/util';
import { mcpMethodIdForDispatch } from '@dereekb/firebase-server/mcp';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

/**
 * Exercises the demo-api MCP surface end-to-end through `McpServerFactoryService.createServer()`.
 *
 * Tests run each method in-process through the compact `demo_mcp_read` / `demo_mcp_write` routers — the same
 * dispatch chain the live `McpController` runs, minus the Streamable HTTP transport. Asserts both the
 * `CallToolResult` envelope and the Firestore side-effect so a regression in either layer is caught.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  const guestbookCreateMethod = mcpMethodIdForDispatch({ modelType: guestbookIdentity.modelType, call: 'create' });
  const allPublishedEntriesMethod = mcpMethodIdForDispatch({ modelType: guestbookEntryIdentity.modelType, call: 'invoke', specifier: 'allPublishedEntries' });

  demoAuthorizedUserContext({ f }, (u) => {
    describe('compact search', () => {
      it('finds the guestbook.create and guestbookEntry.invoke.allPublishedEntries methods', async () => {
        const found = await searchMcpMethods({ f, u, query: 'guestbook', limit: 50 });
        const methods = new Set(found.methods.map((x) => x.method));
        expect(methods.has(guestbookCreateMethod)).toBe(true);
        expect(methods.has(allPublishedEntriesMethod)).toBe(true);
      });
    });

    // guestbookEntryAllPublishedEntries declares requiredScope: 'lms', so an OIDC caller needs both the
    // per-verb model.invoke scope AND lms to see or call it. A plain Firebase caller (above) bypasses.
    describe('per-function requiredScope (lms) scope gating', () => {
      it('hides the lms-gated method from an OIDC caller holding model.invoke but not lms', async () => {
        const { result, details } = await describeMcpMethod({ f, u, method: allPublishedEntriesMethod, scopes: 'model.invoke' });
        expect(result.isError).toBe(true);
        expect(details).toBeUndefined();
      });

      it('describes the lms-gated method for an OIDC caller holding both model.invoke and lms', async () => {
        const { details } = await describeMcpMethod({ f, u, method: allPublishedEntriesMethod, scopes: 'model.invoke lms' });
        expect(details?.method).toBe(allPublishedEntriesMethod);
        expect(details?.kind).toBe('read');
      });

      it('rejects a read call for the lms-gated method when the OIDC caller lacks lms', async () => {
        const result = await callMcpMethod({ f, u, kind: 'read', method: allPublishedEntriesMethod, params: { limit: 10 }, scopes: 'model.invoke' });
        expect(result.isError).toBe(true);
      });
    });

    describe(guestbookCreateMethod, () => {
      it('creates a guestbook and persists it to Firestore', async () => {
        const params: CreateGuestbookParams = { name: 'mcpCreate' };
        const result = await callMcpMethod({ f, u, kind: 'write', method: guestbookCreateMethod, params: params as unknown as Record<string, unknown> });

        expect(result.isError).toBeUndefined();

        const structured = result.structuredContent as { readonly modelKeys: ReadonlyArray<string> };
        expect(structured.modelKeys.length).toBeGreaterThan(0);

        const createdKey = structured.modelKeys[0];
        const accessor = f.instance.demoFirestoreCollections.guestbookCollection.documentAccessor();
        const document = accessor.loadDocumentForKey(createdKey);

        const exists = await document.accessor.exists();
        expect(exists).toBe(true);

        const data = await document.snapshotData();
        expect(data?.name).toBe('mcpCreate');
      });
    });

    describe(allPublishedEntriesMethod, () => {
      demoGuestbookContext({ f, name: 'AllPublishedBook', published: true }, (g) => {
        demoGuestbookEntryContext({ f, u, g, published: true }, (_e) => {
          beforeEach(async () => {
            // `useModel('guestbookEntry', { roles: 'read' })` for cursor loading
            // requires read access — admin satisfies it for the seeded entry.
            await f.instance.authService.userContext(u.uid).addRoles([AUTH_ADMIN_ROLE]);
          });

          it('returns the MCP-mapped aggregate projection (entries stripped) for the seeded published entry', async () => {
            const params: AllPublishedGuestbookEntriesParams = { limit: 10 };
            const result = await callMcpMethod({ f, u, kind: 'read', method: allPublishedEntriesMethod, params: params as unknown as Record<string, unknown> });

            expect(result.isError).toBeUndefined();

            // `mapSuccessfulResult` trims the raw result down to AllPublishedGuestbookEntriesMcpResult,
            // so the MCP structuredContent carries the aggregate counts but not the `entries` array.
            const structured = result.structuredContent as { readonly count: number; readonly hitLimit: boolean; readonly entries?: ReadonlyArray<unknown> };
            expect(structured.count).toBeGreaterThanOrEqual(1);
            expect(structured.entries).toBeUndefined();
            // `hitLimit` is only true when more entries exist beyond the cap. The seeded fixture
            // only inserts a single entry, so the loop exits on `!page.hasMore`, not on cap.
            expect(structured.hitLimit).toBe(false);
          });
        });
      });
    });

    describe('unauthenticated dispatch', () => {
      it('returns isError when allPublishedEntries is called without auth', async () => {
        const result = await callMcpMethodAnonymous({ f, kind: 'read', method: allPublishedEntriesMethod, params: { limit: 10 } });
        expect(result.isError).toBe(true);
      });
    });
  });
});
