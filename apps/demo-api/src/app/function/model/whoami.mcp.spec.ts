import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { callMcpMethod } from '../../../test/mcp';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

/**
 * Covers the JSON-Schema check of the built-in `whoami` MCP method's args against its own `inputSchema`.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  demoAuthorizedUserContext({ f }, (u) => {
    describe('whoami', () => {
      it('rejects a detail that is not one of the allowed values', async () => {
        const result = await callMcpMethod({ f, u, kind: 'read', method: 'whoami', params: { detail: true } });

        expect(result.isError).toBe(true);
        expect((result.content[0] as { readonly text: string }).text).toContain('detail must be one of');
      });

      it('accepts an allowed detail', async () => {
        const result = await callMcpMethod({ f, u, kind: 'read', method: 'whoami', params: { detail: 'claims' } });
        expect(result.isError).toBeUndefined();
      });
    });
  });
});
