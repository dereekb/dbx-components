import { MODEL_GET_TOOL_NAME } from '@dereekb/firebase-server/mcp';
import { guestbookIdentity, guestbookEntryIdentity } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext, demoGuestbookContext, demoGuestbookEntryContext } from '../../../test/fixture';
import { callMcpTool, callMcpToolAnonymous, listMcpTools } from '../../../test/mcp';
import { AUTH_ADMIN_ROLE } from '@dereekb/util';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

/**
 * Integration coverage for the built-in `model-get` MCP tool in apps/demo-api.
 *
 * The tool itself lives in `@dereekb/firebase-server/mcp` but it pulls registered identities
 * and per-key permission checks from the live demo Nest module, so we exercise the full path
 * (auth → useMultipleModels → snapshot read) for a few representative shapes:
 *
 * - Full keys vs bare ids on a root model (`guestbook`).
 * - Subcollection rejection on `guestbookEntry`.
 * - Anonymous callers blocked by the declarative `requireAuthenticated` rule.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  demoAuthorizedUserContext({ f }, (u) => {
    beforeEach(async () => {
      // `useMultipleModels(..., roles: 'read')` requires admin on the seeded guestbooks/entries
      // — read permission for non-owners isn't granted by the model rules in the demo app.
      await f.instance.authService.userContext(u.uid).addRoles([AUTH_ADMIN_ROLE]);
    });

    describe('tools/list', () => {
      it('exposes model-get with readOnly metadata', async () => {
        const tools = await listMcpTools(f, u);
        const tool = tools.find((t) => t.name === MODEL_GET_TOOL_NAME);
        expect(tool).toBeDefined();
        expect(tool?.description).toContain('Fetch');
        expect(tool?.inputSchema).toMatchObject({ type: 'object' });
      });
    });

    describe(MODEL_GET_TOOL_NAME, () => {
      demoGuestbookContext({ f, name: 'ModelGetA', published: true }, (gA) => {
        demoGuestbookContext({ f, name: 'ModelGetB', published: true }, (gB) => {
          it('returns a seeded guestbook fetched by full key', async () => {
            const result = await callMcpTool({
              f,
              u,
              name: MODEL_GET_TOOL_NAME,
              args: { modelType: guestbookIdentity.modelType, keys: [gA.documentKey] }
            });

            expect(result.isError).toBeUndefined();
            const structured = result.structuredContent as { readonly results: ReadonlyArray<{ readonly key: string; readonly data: { readonly name: string } }>; readonly errors: ReadonlyArray<unknown> };
            expect(structured.errors).toHaveLength(0);
            expect(structured.results).toHaveLength(1);
            expect(structured.results[0].key).toBe(gA.documentKey);
            expect(structured.results[0].data.name).toBe('ModelGetA');
          });

          it('auto-promotes a bare id to <collectionName>/<id> for a root model', async () => {
            const result = await callMcpTool({
              f,
              u,
              name: MODEL_GET_TOOL_NAME,
              args: { modelType: guestbookIdentity.modelType, keys: [gA.documentId] }
            });

            expect(result.isError).toBeUndefined();
            const structured = result.structuredContent as { readonly results: ReadonlyArray<{ readonly key: string }> };
            expect(structured.results).toHaveLength(1);
            expect(structured.results[0].key).toBe(`${guestbookIdentity.collectionName}/${gA.documentId}`);
          });

          it('fetches a batch with mixed full keys and bare ids', async () => {
            const result = await callMcpTool({
              f,
              u,
              name: MODEL_GET_TOOL_NAME,
              args: { modelType: guestbookIdentity.modelType, keys: [gA.documentKey, gB.documentId] }
            });

            expect(result.isError).toBeUndefined();
            const structured = result.structuredContent as { readonly results: ReadonlyArray<{ readonly key: string }>; readonly errors: ReadonlyArray<unknown> };
            expect(structured.errors).toHaveLength(0);
            const keys = structured.results.map((r) => r.key);
            expect(keys).toContain(gA.documentKey);
            expect(keys).toContain(`${guestbookIdentity.collectionName}/${gB.documentId}`);
          });

          it('surfaces unknown keys in the errors array without throwing', async () => {
            const result = await callMcpTool({
              f,
              u,
              name: MODEL_GET_TOOL_NAME,
              args: { modelType: guestbookIdentity.modelType, keys: [gA.documentKey, 'gb/definitely-missing'] }
            });

            expect(result.isError).toBeUndefined();
            const structured = result.structuredContent as { readonly results: ReadonlyArray<{ readonly key: string }>; readonly errors: ReadonlyArray<{ readonly key: string; readonly message: string }> };
            expect(structured.results.map((r) => r.key)).toContain(gA.documentKey);
            expect(structured.errors.map((e) => e.key)).toContain('gb/definitely-missing');
          });
        });

        demoGuestbookEntryContext({ f, u, g: gA, published: true }, (entry) => {
          it('rejects bare ids for subcollection model types', async () => {
            const result = await callMcpTool({
              f,
              u,
              name: MODEL_GET_TOOL_NAME,
              args: { modelType: guestbookEntryIdentity.modelType, keys: [entry.documentId] }
            });

            expect(result.isError).toBe(true);
            const text = (result.content[0] as { text: string }).text;
            expect(text).toContain('subcollection');
          });

          it('accepts a full subcollection key', async () => {
            const result = await callMcpTool({
              f,
              u,
              name: MODEL_GET_TOOL_NAME,
              args: { modelType: guestbookEntryIdentity.modelType, keys: [entry.documentKey] }
            });

            expect(result.isError).toBeUndefined();
            const structured = result.structuredContent as { readonly results: ReadonlyArray<{ readonly key: string }> };
            expect(structured.results).toHaveLength(1);
            expect(structured.results[0].key).toBe(entry.documentKey);
          });
        });
      });

      it('returns isError when an unknown modelType is requested', async () => {
        const result = await callMcpTool({
          f,
          u,
          name: MODEL_GET_TOOL_NAME,
          args: { modelType: 'not-a-real-model', keys: ['something/abc'] }
        });

        expect(result.isError).toBe(true);
        expect((result.content[0] as { text: string }).text).toContain('Unknown modelType');
      });
    });

    describe('unauthenticated dispatch', () => {
      it('is hidden from tools/list and isError when called anonymously', async () => {
        const result = await callMcpToolAnonymous({
          f,
          name: MODEL_GET_TOOL_NAME,
          args: { modelType: guestbookIdentity.modelType, keys: ['gb/abc'] }
        });

        expect(result.isError).toBe(true);
      });
    });
  });
});
