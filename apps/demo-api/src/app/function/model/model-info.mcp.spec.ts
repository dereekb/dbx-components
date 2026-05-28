import { MODEL_INFO_TOOL_NAME } from '@dereekb/firebase-server/mcp';
import { guestbookIdentity, guestbookEntryIdentity } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { callMcpTool, callMcpToolAnonymous, listMcpTools } from '../../../test/mcp';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

/**
 * Integration coverage for the built-in `model-info` MCP tool in apps/demo-api.
 *
 * The tool itself lives in `@dereekb/firebase-server/mcp` but the catalog it serves is
 * sourced from the build-time MCP manifest JSON loaded by {@link McpServerFactoryService}
 * at boot. These tests exercise the full path (manifest-on-disk → factory cache →
 * tools/list + tools/call) against the live demo Nest module:
 *
 * - tools/list exposes `model-info` with the catalog description.
 * - List mode returns every registered demo model (guestbook, guestbookEntry, …).
 * - Single mode resolves by `modelType`, `collectionPrefix`, and `identityConst`.
 * - Unknown queries surface as `isError`.
 * - Anonymous callers are blocked by the declarative `requireAuthenticated` rule.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  demoAuthorizedUserContext({ f }, (u) => {
    describe('tools/list', () => {
      it('exposes model-info with catalog description', async () => {
        const tools = await listMcpTools(f, u);
        const tool = tools.find((t) => t.name === MODEL_INFO_TOOL_NAME);
        expect(tool).toBeDefined();
        expect(tool?.description).toContain('catalog');
        expect(tool?.inputSchema).toMatchObject({ type: 'object' });
      });
    });

    describe(MODEL_INFO_TOOL_NAME, () => {
      it('returns the full model list when called with all:true', async () => {
        const result = await callMcpTool({ f, u, name: MODEL_INFO_TOOL_NAME, args: { all: true } });

        expect(result.isError).toBeUndefined();
        const structured = result.structuredContent as { readonly mode: string; readonly models: ReadonlyArray<{ readonly modelType: string; readonly collectionPrefix: string }> };
        expect(structured.mode).toBe('list');
        const modelTypes = structured.models.map((m) => m.modelType);
        expect(modelTypes).toContain(guestbookIdentity.modelType);
        expect(modelTypes).toContain(guestbookEntryIdentity.modelType);
      });

      it('returns the full entry when called with a modelType', async () => {
        const result = await callMcpTool({ f, u, name: MODEL_INFO_TOOL_NAME, args: { model: guestbookIdentity.modelType } });

        expect(result.isError).toBeUndefined();
        const structured = result.structuredContent as { readonly mode: string; readonly model: { readonly modelType: string; readonly identityConst: string; readonly collectionPrefix: string; readonly fields: ReadonlyArray<unknown> } };
        expect(structured.mode).toBe('single');
        expect(structured.model.modelType).toBe(guestbookIdentity.modelType);
        expect(structured.model.identityConst).toBe('guestbookIdentity');
        expect(structured.model.collectionPrefix).toBe(guestbookIdentity.collectionName);
        expect(structured.model.fields.length).toBeGreaterThan(0);
      });

      it('resolves by collectionPrefix', async () => {
        const result = await callMcpTool({ f, u, name: MODEL_INFO_TOOL_NAME, args: { model: guestbookIdentity.collectionName } });

        expect(result.isError).toBeUndefined();
        const structured = result.structuredContent as { readonly mode: string; readonly model: { readonly modelType: string } };
        expect(structured.mode).toBe('single');
        expect(structured.model.modelType).toBe(guestbookIdentity.modelType);
      });

      it('resolves by identityConst', async () => {
        const result = await callMcpTool({ f, u, name: MODEL_INFO_TOOL_NAME, args: { model: 'guestbookEntryIdentity' } });

        expect(result.isError).toBeUndefined();
        const structured = result.structuredContent as { readonly mode: string; readonly model: { readonly modelType: string; readonly parentIdentityConst?: string } };
        expect(structured.mode).toBe('single');
        expect(structured.model.modelType).toBe(guestbookEntryIdentity.modelType);
        expect(structured.model.parentIdentityConst).toBe('guestbookIdentity');
      });

      it('returns isError when no manifest entry matches the query', async () => {
        const result = await callMcpTool({ f, u, name: MODEL_INFO_TOOL_NAME, args: { model: 'not-a-real-model' } });

        expect(result.isError).toBe(true);
        expect((result.content[0] as { text: string }).text).toContain('no exact match');
      });
    });

    describe('unauthenticated dispatch', () => {
      it('is hidden from tools/list and isError when called anonymously', async () => {
        const result = await callMcpToolAnonymous({ f, name: MODEL_INFO_TOOL_NAME, args: {} });
        expect(result.isError).toBe(true);
      });
    });
  });
});
