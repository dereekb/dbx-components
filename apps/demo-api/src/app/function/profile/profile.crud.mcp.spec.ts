import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserContext } from '../../../test/fixture';
import { callMcpMethod } from '../../../test/mcp';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

/**
 * Covers the callModel dispatch's check of MCP params against the handler's declared `inputType`.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  demoAuthorizedUserContext({ f }, (u) => {
    describe('profile.update.onboard', () => {
      it('rejects params that do not match the declared inputType and names the field', async () => {
        const result = await callMcpMethod({ f, u, kind: 'write', method: 'profile.update.onboard', params: { key: 5 } });

        expect(result.isError).toBe(true);
        const text = (result.content[0] as { readonly text: string }).text;
        expect(text).toContain('One or more data/form validation errors occurred.');
        expect(text).toContain('key');
      });
    });
  });
});
