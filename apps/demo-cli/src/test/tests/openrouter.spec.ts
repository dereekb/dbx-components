// eslint-disable-next-line @nx/enforce-module-boundaries -- @dereekb/openrouter/firebase builds through the parent `openrouter` project, so nx sees no build target of its own; the generated manifests carry the same disable for the same import.
import { openRouterPromptVersionId } from '@dereekb/openrouter/firebase';
// eslint-disable-next-line @nx/enforce-module-boundaries -- demo-api fixture is intentionally shared with demo-cli specs (see apps/demo-cli/src/test/fixture.ts for the established pattern).
import { type DemoApiFunctionContextFixture, DEMO_API_TEST_OPENROUTER_MODEL_CONFIG, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoOAuthAuthorizedSuperTestContext } from 'demo-api/test';
import { withDemoTestCli } from '../fixture';

vi.setConfig({ hookTimeout: 30000, testTimeout: 30000 });

const PROMPT_KEY = 'cli-read-write-prompt';
const PROMPT_MODEL_KEY = `orp/${PROMPT_KEY}`;

function parseEnvelope(stdout: string): { ok: boolean; data?: unknown; code?: string } {
  return JSON.parse(stdout) as { ok: boolean; data?: unknown; code?: string };
}

/**
 * Proves an admin can manage OpenRouter prompts entirely from the CLI.
 *
 * These models used to be `@dbxModelServerOnly`, which the CLI enforced LOCALLY off the generated
 * manifest — the read was refused before a transport was even chosen, so an operator could publish a
 * version and never read back what they wrote. The tag is gone, `firestore.rules` grants system admins
 * the read, and the service factories no longer set `serverOnly`; this spec is what holds all three in
 * place, because reinstating any one of them breaks it.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  demoAuthorizedUserAdminContext({ f }, (u) => {
    demoOAuthAuthorizedSuperTestContext({ f, u }, (oauth) => {
      withDemoTestCli({ f, oauth }, ({ runCli }) => {
        describe('demo-cli openRouterPrompt', () => {
          beforeEach(async () => {
            // A prompt has no `create` on the model API by design — it comes into existence server-side
            // from a seed or an operator — so the document is staged here and everything after it is the
            // CLI doing the work.
            await f.instance.openRouterPromptServerActions.createOpenRouterPrompt({ key: PROMPT_KEY, name: 'CLI Read/Write Prompt' });
          });

          it('writes a version, then reads back what it wrote', async () => {
            const created = parseEnvelope((await runCli(['model', 'openRouterPromptVersion', 'create', '--data', JSON.stringify({ prompt: PROMPT_MODEL_KEY, instructions: 'You were written by the CLI.', config: DEMO_API_TEST_OPENROUTER_MODEL_CONFIG, activate: true })])).stdoutText);

            expect(created.ok).toBe(true);
            expect((created.data as { version: number }).version).toBe(1);

            // The round trip the server-only tag made impossible.
            const read = parseEnvelope((await runCli(['model', 'openRouterPrompt', 'read', '--data', JSON.stringify({ key: PROMPT_MODEL_KEY })])).stdoutText);

            expect(read.ok).toBe(true);

            const result = read.data as { source: string; resolved: { version: number; instructions: string }; prompt: { av: number } };
            expect(result.source).toBe('store');
            expect(result.resolved.version).toBe(1);
            expect(result.resolved.instructions).toBe('You were written by the CLI.');
            expect(result.prompt.av).toBe(1);
          });

          it('reads the prompt document by key through `get`', async () => {
            const envelope = parseEnvelope((await runCli(['get', PROMPT_MODEL_KEY])).stdoutText);

            expect(envelope.ok).toBe(true);
            // `orp` resolving at all is the manifest half of the fix; the document coming back is the
            // serverOnly half.
            expect(JSON.stringify(envelope.data)).toContain('CLI Read/Write Prompt');
          });

          it('reads a version document by key through `get`', async () => {
            await runCli(['model', 'openRouterPromptVersion', 'create', '--data', JSON.stringify({ prompt: PROMPT_MODEL_KEY, instructions: 'Version one.', config: DEMO_API_TEST_OPENROUTER_MODEL_CONFIG })]);

            const envelope = parseEnvelope((await runCli(['get', `${PROMPT_MODEL_KEY}/orpv/${openRouterPromptVersionId(1)}`])).stdoutText);

            expect(envelope.ok).toBe(true);
            expect(JSON.stringify(envelope.data)).toContain('Version one.');
          });

          it('queries the prompt collection', async () => {
            const envelope = parseEnvelope((await runCli(['model', 'openRouterPrompt', 'query', '--data', '{}'])).stdoutText);

            expect(envelope.ok).toBe(true);
            expect(JSON.stringify(envelope.data)).toContain(PROMPT_KEY);
          });

          it('updates prompt metadata', async () => {
            const updated = parseEnvelope((await runCli(['model', 'openRouterPrompt', 'update', '--data', JSON.stringify({ key: PROMPT_MODEL_KEY, name: 'Renamed From The CLI' })])).stdoutText);
            expect(updated.ok).toBe(true);

            const read = parseEnvelope((await runCli(['get', PROMPT_MODEL_KEY])).stdoutText);
            expect(JSON.stringify(read.data)).toContain('Renamed From The CLI');
          });
        });
      });
    });
  });
});
