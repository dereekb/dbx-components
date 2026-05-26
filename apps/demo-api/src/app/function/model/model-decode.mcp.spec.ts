import { MODEL_DECODE_TOOL_NAME } from '@dereekb/firebase-server/mcp';
import { guestbookIdentity, guestbookEntryIdentity } from 'demo-firebase';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { callMcpTool, callMcpToolAnonymous, listMcpTools } from '../../../test/mcp';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

/**
 * Integration coverage for the built-in `model-decode` MCP tool in apps/demo-api.
 *
 * The tool itself lives in `@dereekb/firebase-server/mcp` but the prefix map it walks
 * is sourced from the build-time MCP manifest JSON loaded by {@link McpServerFactoryService}
 * at boot. These tests exercise the full path (manifest-on-disk → factory cache →
 * tools/list + tools/call) against the live demo Nest module:
 *
 * - tools/list exposes `model-decode`.
 * - Root keys resolve to the matching model with no ancestors.
 * - Subcollection keys resolve the leaf + parent in order.
 * - Unknown prefixes are surfaced via `unresolvedPrefixes` without throwing.
 * - Malformed keys return `isError`.
 * - Anonymous callers are blocked by the declarative `requireAuthenticated` rule.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  demoAuthorizedUserContext({ f }, (u) => {
    describe('tools/list', () => {
      it('exposes model-decode with decode description', async () => {
        const tools = await listMcpTools(f, u);
        const tool = tools.find((t) => t.name === MODEL_DECODE_TOOL_NAME);
        expect(tool).toBeDefined();
        expect(tool?.description).toContain('Decode');
        expect(tool?.inputSchema).toMatchObject({ type: 'object' });
      });
    });

    describe(MODEL_DECODE_TOOL_NAME, () => {
      it('resolves a root key against the registered manifest', async () => {
        const result = await callMcpTool({ f, u, name: MODEL_DECODE_TOOL_NAME, args: { key: `${guestbookIdentity.collectionName}/abc` } });

        expect(result.isError).toBeUndefined();
        const structured = result.structuredContent as {
          readonly leaf: { readonly prefix: string; readonly id: string; readonly modelType?: string; readonly identityConst?: string };
          readonly ancestors: ReadonlyArray<unknown>;
          readonly unresolvedPrefixes: ReadonlyArray<string>;
        };
        expect(structured.leaf.prefix).toBe(guestbookIdentity.collectionName);
        expect(structured.leaf.id).toBe('abc');
        expect(structured.leaf.modelType).toBe(guestbookIdentity.modelType);
        expect(structured.leaf.identityConst).toBe('guestbookIdentity');
        expect(structured.ancestors).toHaveLength(0);
        expect(structured.unresolvedPrefixes).toHaveLength(0);
      });

      it('resolves a subcollection key with the parent in ancestors', async () => {
        const key = `${guestbookIdentity.collectionName}/parent/${guestbookEntryIdentity.collectionName}/child`;
        const result = await callMcpTool({ f, u, name: MODEL_DECODE_TOOL_NAME, args: { key } });

        expect(result.isError).toBeUndefined();
        const structured = result.structuredContent as {
          readonly leaf: { readonly modelType?: string; readonly parentIdentityConst?: string };
          readonly ancestors: ReadonlyArray<{ readonly modelType?: string; readonly id: string }>;
        };
        expect(structured.leaf.modelType).toBe(guestbookEntryIdentity.modelType);
        expect(structured.leaf.parentIdentityConst).toBe('guestbookIdentity');
        expect(structured.ancestors).toHaveLength(1);
        expect(structured.ancestors[0].modelType).toBe(guestbookIdentity.modelType);
        expect(structured.ancestors[0].id).toBe('parent');
      });

      it('reports unresolved prefixes without throwing', async () => {
        const result = await callMcpTool({ f, u, name: MODEL_DECODE_TOOL_NAME, args: { key: 'not-a-prefix/abc' } });

        expect(result.isError).toBeUndefined();
        const structured = result.structuredContent as { readonly leaf: { readonly modelType?: string }; readonly unresolvedPrefixes: ReadonlyArray<string> };
        expect(structured.leaf.modelType).toBeUndefined();
        expect(structured.unresolvedPrefixes).toContain('not-a-prefix');
      });

      it('returns isError for a malformed key with an odd number of segments', async () => {
        const result = await callMcpTool({ f, u, name: MODEL_DECODE_TOOL_NAME, args: { key: 'gb' } });

        expect(result.isError).toBe(true);
        expect((result.content[0] as { text: string }).text).toContain('Expected an even number of segments');
      });
    });

    describe('unauthenticated dispatch', () => {
      it('is hidden from tools/list and isError when called anonymously', async () => {
        const result = await callMcpToolAnonymous({ f, name: MODEL_DECODE_TOOL_NAME, args: { key: `${guestbookIdentity.collectionName}/abc` } });
        expect(result.isError).toBe(true);
      });
    });
  });
});
