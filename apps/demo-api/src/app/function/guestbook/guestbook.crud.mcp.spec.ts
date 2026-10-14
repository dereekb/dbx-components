import { type CreateGuestbookParams, type GuestbookEntry, type InsertGuestbookEntryResult, guestbookIdentity, guestbookEntryIdentity, type AllPublishedGuestbookEntriesParams, GUESTBOOK_ID_OR_KEY_PARAM_DESCRIPTION } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoGuestbookContext, demoGuestbookEntryContext } from '../../../test/fixture';
import { type CallMcpMethodParams, callMcpMethod, callMcpMethodAnonymous, describeMcpMethod, searchMcpMethods } from '../../../test/mcp';
import { AUTH_ADMIN_ROLE, type Maybe } from '@dereekb/util';
import { type OnCallQueryModelResult } from '@dereekb/firebase';
import { mcpMethodIdForDispatch } from '@dereekb/firebase-server/mcp';
import { type CallToolResult } from '@modelcontextprotocol/server';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

/**
 * Exercises the demo-api MCP surface end-to-end through `McpServerFactoryService.createServer()`.
 *
 * Tests run each method in-process through the compact `demo_api_read` / `demo_api_write` routers — the same
 * dispatch chain the live `McpController` runs, minus the Streamable HTTP transport. Asserts both the
 * `CallToolResult` envelope and the Firestore side-effect so a regression in either layer is caught.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  const guestbookCreateMethod = mcpMethodIdForDispatch({ modelType: guestbookIdentity.modelType, call: 'create' });
  const allPublishedEntriesMethod = mcpMethodIdForDispatch({ modelType: guestbookEntryIdentity.modelType, call: 'invoke', specifier: 'allPublishedEntries' });
  const guestbookEntryDeleteMethod = mcpMethodIdForDispatch({ modelType: guestbookEntryIdentity.modelType, call: 'delete' });
  const guestbookEntryInsertMethod = mcpMethodIdForDispatch({ modelType: guestbookEntryIdentity.modelType, call: 'update', specifier: 'insert' });
  const guestbookEntryQueryMethod = mcpMethodIdForDispatch({ modelType: guestbookEntryIdentity.modelType, call: 'query' });

  /**
   * Calls a method through whichever compact router its `details` names, so a method that moves between the read, write
   * and destructive routers keeps its coverage.
   *
   * @param input - The {@link callMcpMethod} input, minus the `kind`.
   * @returns The router's `CallToolResult`.
   */
  async function callMcpMethodByKind(input: Omit<CallMcpMethodParams, 'kind'>): Promise<CallToolResult> {
    const { details } = await describeMcpMethod({ f: input.f, u: input.u, method: input.method });

    if (details == null) {
      throw new Error(`no details for ${input.method}`);
    }

    return callMcpMethod({ ...input, kind: details.kind });
  }

  /**
   * Joins a result's text blocks.
   *
   * @param result - The tool result.
   * @returns The text content.
   */
  function mcpResultText(result: CallToolResult): string {
    return result.content.map((x) => (x.type === 'text' ? x.text : '')).join('\n');
  }

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

    describe('guestbook param', () => {
      it('describes the guestbook param on every method that takes one', async () => {
        for (const method of [guestbookEntryDeleteMethod, guestbookEntryInsertMethod, guestbookEntryQueryMethod]) {
          const { details } = await describeMcpMethod({ f, u, method });
          const inputSchema = details?.inputSchema as Maybe<{ readonly properties?: Record<string, { readonly description?: string }> }>;
          const properties = inputSchema?.properties;
          expect(properties?.['guestbook']?.description).toBe(GUESTBOOK_ID_OR_KEY_PARAM_DESCRIPTION);
        }
      });
    });

    describe(guestbookEntryDeleteMethod, () => {
      demoGuestbookContext({ f, published: true }, (g) => {
        demoGuestbookEntryContext({ f, u, g }, (e) => {
          it('deletes the caller entry given the guestbook id', async () => {
            const result = await callMcpMethodByKind({ f, u, method: guestbookEntryDeleteMethod, params: { guestbook: g.documentId } });
            expect(result.isError).toBeUndefined();
            expect(await e.document.exists()).toBe(false);
          });

          it('deletes the caller entry given the full guestbook key', async () => {
            const result = await callMcpMethodByKind({ f, u, method: guestbookEntryDeleteMethod, params: { guestbook: g.document.key } });
            expect(result.isError).toBeUndefined();
            expect(await e.document.exists()).toBe(false);
          });

          it('refuses an entry key with a validation error rather than a Firestore error', async () => {
            const result = await callMcpMethodByKind({ f, u, method: guestbookEntryDeleteMethod, params: { guestbook: e.documentKey } });
            expect(result.isError).toBe(true);

            const text = mcpResultText(result);
            expect(text).toContain('guestbook must be');
            expect(text).not.toContain('documentPath');
            expect(text).not.toContain('unexpected key/path');
            expect(await e.document.exists()).toBe(true);
          });
        });
      });
    });

    describe(guestbookEntryInsertMethod, () => {
      demoGuestbookContext({ f, published: true }, (g) => {
        it('inserts the caller entry given the full guestbook key', async () => {
          const result = await callMcpMethodByKind({ f, u, method: guestbookEntryInsertMethod, params: { guestbook: g.documentKey, message: 'by key', signed: 'mcp' } });
          expect(result.isError).toBeUndefined();

          const entry = f.instance.demoFirestoreCollections.guestbookEntryCollectionFactory(g.document).documentAccessor().loadDocumentForId(u.uid);
          expect(await entry.exists()).toBe(true);
        });

        it('returns the new entry key given the guestbook id', async () => {
          const result = await callMcpMethodByKind({ f, u, method: guestbookEntryInsertMethod, params: { guestbook: g.documentId, message: 'by id', signed: 'mcp' } });
          expect(result.isError).toBeUndefined();

          const entry = f.instance.demoFirestoreCollections.guestbookEntryCollectionFactory(g.document).documentAccessor().loadDocumentForId(u.uid);
          const structured = result.structuredContent as unknown as InsertGuestbookEntryResult;
          expect(structured.modelKeys).toEqual([entry.key]);
        });

        it('refuses an entry key with a validation error', async () => {
          const result = await callMcpMethodByKind({ f, u, method: guestbookEntryInsertMethod, params: { guestbook: `${g.document.key}/gbe/x`, message: 'nope' } });
          expect(result.isError).toBe(true);
          expect(mcpResultText(result)).toContain('guestbook must be');
        });
      });
    });

    describe(guestbookEntryQueryMethod, () => {
      demoGuestbookContext({ f, published: true }, (g) => {
        demoGuestbookEntryContext({ f, u, g, published: true }, (e) => {
          it('queries entries given either the guestbook id or the full guestbook key', async () => {
            for (const guestbook of [g.documentId, g.document.key]) {
              const result = await callMcpMethodByKind({ f, u, method: guestbookEntryQueryMethod, params: { guestbook } });
              expect(result.isError).toBeUndefined();

              const query = result.structuredContent as unknown as OnCallQueryModelResult<GuestbookEntry>;
              expect(query.keys).toContain(e.documentKey);
            }
          });

          it('refuses an entry key with a validation error rather than a Firestore error', async () => {
            const result = await callMcpMethodByKind({ f, u, method: guestbookEntryQueryMethod, params: { guestbook: e.documentKey } });
            expect(result.isError).toBe(true);

            const text = mcpResultText(result);
            expect(text).toContain('guestbook must be');
            expect(text).not.toContain('documentPath');
          });
        });
      });
    });

    describe('validation errors', () => {
      it('names each failing field', async () => {
        const result = await callMcpMethod({ f, u, kind: 'write', method: guestbookCreateMethod, params: { published: true } });
        expect(result.isError).toBe(true);

        const text = mcpResultText(result);
        expect(text).toContain('One or more data/form validation errors occurred.');
        expect(text).toContain('name must be a string (was missing)');
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
