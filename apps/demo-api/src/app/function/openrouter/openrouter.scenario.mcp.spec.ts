import { describe, expect, it } from 'vitest';
import { type OnCallQueryModelResult } from '@dereekb/firebase';
import { buildMcpToolName } from '@dereekb/firebase-server/mcp';
import { OpenRouterApi } from '@dereekb/nestjs/openrouter';
import { openRouterGeneration } from '@dereekb/openrouter';
import { type CreateOpenRouterPromptVersionResult, type OpenRouterPrompt, OpenRouterPromptState, OpenRouterRunTaskState, openRouterPromptIdentity, openRouterPromptVersionId, openRouterPromptVersionIdentity } from '@dereekb/openrouter/firebase';
import { openRouterRunTaskSweep } from '@dereekb/openrouter/firebase-server';
import { DEMO_API_TEST_OPENROUTER_MODEL_CONFIG, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext, demoOpenRouterPromptContext } from '../../../test/fixture';
import { callMcpTool, listMcpTools } from '../../../test/mcp';

/**
 * Closes the plan's last verification bullet: the prompt registry driven through the callModel MCP
 * rather than through the callables directly.
 *
 * The package's own emulator spec already proves the registry and the sweeper against the real API by
 * calling `openRouterPromptServerActions` in-process. What it cannot prove is that those operations are
 * REACHABLE over MCP, which is the whole reason the models declare CRUD instead of shipping a UI —
 * every hop between an MCP client and the action (manifest entry, generated tool, dispatch, role gate)
 * lives in the app, and each one is a place the surface can be silently absent. `openRouterPrompt.query`
 * was exactly that until this app registered `OpenRouterPromptModelFunctions` in its functions config:
 * the handler carries no `inputType`, so with no manifest entry to supply the schema the tool was
 * dropped at generation time and nothing failed.
 *
 * Everything here dispatches through `McpServerFactoryService` — the same chain `McpController` serves,
 * minus the HTTP transport.
 */

/**
 * Set to run the `live` block against the real API. Everything else runs on the emulator alone and
 * needs no credentials — the same gate the openrouter package's live block uses.
 */
const OPENROUTER_LIVE_API_KEY = process.env['OPENROUTER_API_KEY'];

/**
 * Model the live block runs against. A free model by default: this asserts that a run completes with
 * usage and a resolvable generation, none of which needs a paid model to be true.
 */
const LIVE_TEST_MODEL = process.env['OPENROUTER_TEST_MODEL_ID'] ?? 'nvidia/nemotron-nano-9b-v2:free';

/**
 * Retries a live generation lookup before failing.
 *
 * OpenRouter finalises a generation server-side after the response returns, so an immediate lookup 404s
 * for the first few seconds. That is a race, not a defect.
 *
 * @param fn - The lookup to run.
 * @param attempts - Attempts before the error is rethrown.
 * @returns The lookup's value.
 */
async function retryLive<T>(fn: () => Promise<T>, attempts = 10): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
  }

  throw lastError;
}

demoApiFunctionContextFactory((f) => {
  const promptQueryToolName = buildMcpToolName(openRouterPromptIdentity.modelType, 'query');
  const promptUpdateToolName = buildMcpToolName(openRouterPromptIdentity.modelType, 'update');
  const versionCreateToolName = buildMcpToolName(openRouterPromptVersionIdentity.modelType, 'create');
  const versionUpdateToolName = buildMcpToolName(openRouterPromptVersionIdentity.modelType, 'update');

  demoAuthorizedUserAdminContext({ f }, (au) => {
    describe('tools/list', () => {
      it('should advertise every openrouter prompt operation the model API declares', async () => {
        const names = new Set((await listMcpTools(f, au)).map((x) => x.name));

        expect(names.has(promptUpdateToolName)).toBe(true);
        expect(names.has(versionCreateToolName)).toBe(true);
        expect(names.has(versionUpdateToolName)).toBe(true);
        // The one with no `inputType` on its handler, and therefore the one that only exists because the
        // app's generated MCP manifest carries a schema for it.
        expect(names.has(promptQueryToolName)).toBe(true);
      });
    });

    describe('prompt registry over MCP', () => {
      // A prompt has no `create` on the model API — it comes into existence server-side from a seed or
      // an operator — so the document is staged and everything that follows goes over MCP.
      demoOpenRouterPromptContext({ f, key: 'mcp-prompt' }, (p) => {
        it('should publish, edit, promote and list a prompt entirely over MCP', async () => {
          const published = await callMcpTool({ f, u: au, name: versionCreateToolName, args: { prompt: p.documentKey, instructions: 'You are a test.', config: DEMO_API_TEST_OPENROUTER_MODEL_CONFIG as unknown as Record<string, unknown>, activate: true } });
          expect(published.isError).toBeUndefined();

          const created = published.structuredContent as unknown as CreateOpenRouterPromptVersionResult;
          expect(created.version).toBe(1);
          expect(created.activated).toBe(true);
          // The version document's own path, not the prompt's — a create reports what it created.
          expect(created.modelKeys[0]).toContain(openRouterPromptVersionId(1));

          const versionKey = created.modelKeys[0];
          const edited = await callMcpTool({ f, u: au, name: versionUpdateToolName, args: { key: versionKey, instructions: 'You are an edited test.', notes: 'Reworded over MCP.' } });
          expect(edited.isError).toBeUndefined();

          const renamed = await callMcpTool({ f, u: au, name: promptUpdateToolName, args: { key: p.documentKey, name: 'Renamed over MCP', tags: ['mcp'], activeVersion: 1 } });
          expect(renamed.isError).toBeUndefined();

          const prompt = await p.loadPrompt();
          expect(prompt.n).toBe('Renamed over MCP');
          expect(prompt.t).toEqual(['mcp']);
          expect(prompt.av).toBe(1);
          expect(prompt.s).toBe(OpenRouterPromptState.ACTIVE);

          const version = await p.loadVersion(1);
          expect(version?.i).toBe('You are an edited test.');
          expect(version?.nt).toBe('Reworded over MCP.');

          const listed = await callMcpTool({ f, u: au, name: promptQueryToolName, args: { state: OpenRouterPromptState.ACTIVE, limit: 10 } });
          expect(listed.isError).toBeUndefined();

          const query = listed.structuredContent as unknown as OnCallQueryModelResult<OpenRouterPrompt>;
          expect(query.results.map((x) => x.n)).toContain('Renamed over MCP');
        });

        demoAuthorizedUserContext({ f }, (u) => {
          it('should refuse a non-admin over MCP the same way the callable does', async () => {
            // A prompt has no owner to relate a role to, so the role map grants a non-admin nothing —
            // and the MCP surface must not be a way around that.
            const result = await callMcpTool({ f, u, name: versionCreateToolName, args: { prompt: p.documentKey, instructions: 'not mine', config: DEMO_API_TEST_OPENROUTER_MODEL_CONFIG as unknown as Record<string, unknown> } });
            expect(result.isError).toBe(true);
          });
        });
      });
    });

    describe('run task against an MCP-published version', () => {
      demoOpenRouterPromptContext({ f, key: 'mcp-run-prompt' }, (p) => {
        /**
         * Publishes and activates the prompt's first version over MCP.
         *
         * @param config - Model config to publish with.
         */
        async function publishOverMcp(config: Record<string, unknown>): Promise<void> {
          const result = await callMcpTool({ f, u: au, name: versionCreateToolName, args: { prompt: p.documentKey, instructions: 'You are a test.', config, activate: true } });
          expect(result.isError, JSON.stringify(result.content)).toBeUndefined();
        }

        it('should pin the version MCP published when the run is enqueued', async () => {
          await publishOverMcp(DEMO_API_TEST_OPENROUTER_MODEL_CONFIG as unknown as Record<string, unknown>);

          // The join the two halves meet at: the run task resolves the registry the MCP call wrote, so a
          // version published over MCP is the one an enqueued run is pinned to.
          const enqueued = await f.openRouterRunTaskService.enqueueRunTask({ key: 'mcp_pinned_run', promptKey: 'mcp-run-prompt', input: 'Reply with exactly: OK' });

          expect(enqueued.created).toBe(true);
          expect(enqueued.task.s).toBe(OpenRouterRunTaskState.QUEUED);
          expect(enqueued.task.pk).toBe('mcp-run-prompt');
          expect(enqueued.task.pv).toBe(1);
        });

        // MARK: The live block — the plan's end-to-end bullet, driven from the MCP side
        describe.skipIf(!OPENROUTER_LIVE_API_KEY)('live', () => {
          it('should drain a run published over MCP and resolve its stored generation id', async () => {
            // The cap is generous on purpose: a hybrid reasoning model spends output tokens on reasoning
            // first, so a tight one truncates the answer away and leaves `o` empty on an otherwise fine run.
            await publishOverMcp({ model: LIVE_TEST_MODEL, maxOutputTokens: 2048 });

            await f.openRouterRunTaskService.enqueueRunTask({ key: 'mcp_live_run', promptKey: 'mcp-run-prompt', input: 'Reply with exactly: OK' });

            const sweep = await openRouterRunTaskSweep({ service: f.openRouterRunTaskService, pageSize: 5 });
            expect(sweep.executed).toBe(1);

            const task = await f.demoFirestoreCollections.openRouterRunTaskCollection.documentAccessor().loadDocumentForId('mcp_live_run').snapshotData();
            expect(task?.s, `The live run did not complete: ${JSON.stringify(task?.e)}`).toBe(OpenRouterRunTaskState.COMPLETE);
            expect(task?.o).toBeTruthy();
            expect(task?.u?.totalTokens ?? 0).toBeGreaterThan(0);
            // Cost is reported even on a free model, where it is 0 — its PRESENCE is the assertion.
            expect(task?.u?.cost).toBeDefined();

            const generationId = (task?.gi ?? [])[0];
            expect(generationId).toBeTruthy();

            // The app's own client, so this resolves against the same account the run was billed to.
            const client = f.instance.nest.get(OpenRouterApi).openRouterClient;
            const generation = await retryLive(() => openRouterGeneration({ client, id: generationId }));

            expect(generation.id).toBe(generationId);
            expect(generation.model).toContain(LIVE_TEST_MODEL.split(':')[0]);
          }, 180_000);
        });
      });
    });
  });
});
