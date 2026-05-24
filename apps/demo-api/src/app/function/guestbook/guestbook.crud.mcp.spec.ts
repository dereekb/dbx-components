import { type CreateGuestbookParams, guestbookIdentity, guestbookEntryIdentity, type AllPublishedGuestbookEntriesParams } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoGuestbookContext, demoGuestbookEntryContext } from '../../../test/fixture';
import { callMcpTool, callMcpToolAnonymous, listMcpTools } from '../../../test/mcp';
import { AUTH_ADMIN_ROLE } from '@dereekb/util';
import { buildMcpToolName } from '@dereekb/firebase-server/mcp';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

/**
 * Exercises the demo-api MCP surface end-to-end through `McpServerFactoryService.createServer()`.
 *
 * Tests dispatch each tool in-process — the same dispatch chain the live `McpController`
 * runs, minus the Streamable HTTP transport. Asserts both the `CallToolResult` envelope
 * and the Firestore side-effect so a regression in either layer is caught.
 *
 * Only tools generated from handlers that declare an `inputType` are exposed by
 * `generateMcpToolDefinitions` — at present that's `guestbook-create` (no specifier)
 * and `guestbookEntry-invoke-allPublishedEntries`. Update/query handlers in this model
 * group are skipped until their `withApiDetails` calls grow an `inputType`.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  const guestbookCreateToolName = buildMcpToolName(guestbookIdentity.modelType, 'create');
  const guestbookEntryAllPublishedEntriesToolName = buildMcpToolName(guestbookEntryIdentity.modelType, 'invoke', 'allPublishedEntries');

  demoAuthorizedUserContext({ f }, (u) => {
    describe('McpServerFactoryService tools/list', () => {
      it('exposes the guestbook-create and guestbookEntry-invoke-allPublishedEntries tools', async () => {
        const tools = await listMcpTools(f, u);
        const names = new Set(tools.map((t) => t.name));
        expect(names.has(guestbookCreateToolName)).toBe(true);
        expect(names.has(guestbookEntryAllPublishedEntriesToolName)).toBe(true);
      });
    });

    describe(guestbookCreateToolName, () => {
      it('creates a guestbook and persists it to Firestore', async () => {
        const params: CreateGuestbookParams = { name: 'mcpCreate' };
        const result = await callMcpTool({ f, u, name: guestbookCreateToolName, args: params as unknown as Record<string, unknown> });

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

    describe(guestbookEntryAllPublishedEntriesToolName, () => {
      demoGuestbookContext({ f, name: 'AllPublishedBook', published: true }, (g) => {
        demoGuestbookEntryContext({ f, u, g, published: true }, (_e) => {
          beforeEach(async () => {
            // `useModel('guestbookEntry', { roles: 'read' })` for cursor loading
            // requires read access — admin satisfies it for the seeded entry.
            await f.instance.authService.userContext(u.uid).addRoles([AUTH_ADMIN_ROLE]);
          });

          it('returns the seeded published entry across all guestbooks', async () => {
            const params: AllPublishedGuestbookEntriesParams = { limit: 10 };
            const result = await callMcpTool({ f, u, name: guestbookEntryAllPublishedEntriesToolName, args: params as unknown as Record<string, unknown> });

            expect(result.isError).toBeUndefined();

            const structured = result.structuredContent as { readonly count: number; readonly entries: ReadonlyArray<unknown>; readonly hitLimit: boolean };
            expect(structured.count).toBeGreaterThanOrEqual(1);
            expect(structured.entries.length).toBe(structured.count);
            // `hitLimit` is only true when more entries exist beyond the cap. The seeded fixture
            // only inserts a single entry, so the loop exits on `!page.hasMore`, not on cap.
            expect(structured.hitLimit).toBe(false);
          });
        });
      });
    });

    describe('unauthenticated dispatch', () => {
      it('returns isError when allPublishedEntries is called without auth', async () => {
        const result = await callMcpToolAnonymous({ f, name: guestbookEntryAllPublishedEntriesToolName, args: { limit: 10 } });
        expect(result.isError).toBe(true);
      });
    });
  });
});
