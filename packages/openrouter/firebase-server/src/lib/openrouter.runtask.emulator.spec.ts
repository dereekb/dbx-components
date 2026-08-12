import { beforeEach, describe, expect, it } from 'vitest';
import * as z from 'zod/v4';
import { firestoreModelKey } from '@dereekb/firebase';
import { firebaseServerActionsContext } from '@dereekb/firebase-server';
import { adminFirestoreFactory } from '@dereekb/firebase-server/test';
import { MS_IN_HOUR, type Maybe } from '@dereekb/util';
import { OpenRouterWebhookController, OpenRouterWebhookService } from '@dereekb/nestjs/openrouter';
import { type OpenRouterCore, type OpenRouterModelConfig, type Tool, openRouterFileSearchTool, openRouterGeneration, tool } from '@dereekb/openrouter';
import { OpenRouterCore as OpenRouterClient } from '@openrouter/sdk/core';
import { OPENROUTER_RUN_TASK_MAX_AGE, type OpenRouterPromptDocument, type OpenRouterRunTask, OpenRouterRunTaskState, openRouterPromptFirestoreCollection, openRouterPromptIdentity, openRouterPromptVersionFirestoreCollectionFactory, openRouterPromptVersionFirestoreCollectionGroup, openRouterRunTaskFirestoreCollection } from '@dereekb/openrouter/firebase';
import { type FakeOpenRouterClient, type FakeOpenRouterReply, type FakeOpenRouterReplyFactory, type FakeStorageContext, fakeOpenRouterClient, fakeStorageContext } from '../test/openrouter.fake';
import { openRouterPromptServerActions } from './openrouter.action.server';
import { type OpenRouterFileAttachmentMode } from './openrouter.file.attachment';
import { openRouterPromptService } from './openrouter.prompt.service';
import { type OpenRouterRunTaskExecutionResult, type OpenRouterRunTaskService, openRouterRunTaskService } from './openrouter.runtask.service';
import { openRouterRunTaskExpirationSweep, openRouterRunTaskSweep } from './openrouter.runtask.sweep';
import { reconcileOpenRouterRunTaskFromBroadcast, openRouterRunTaskKeyFromBroadcastAttributes } from './openrouter.broadcast';

const TEST_PROMPT_KEY = 'test-prompt';
const TEST_MODEL_CONFIG: OpenRouterModelConfig = { model: 'openai/gpt-5.1', provider: { only: ['openai'], allowFallbacks: false, requireParameters: true } };

/**
 * Set to run the `live end-to-end` block against the real API. Every other block runs against a fake
 * client and needs no credentials.
 */
const OPENROUTER_LIVE_API_KEY = process.env['OPENROUTER_API_KEY'];
const LIVE_TEST_MODEL = process.env['OPENROUTER_TEST_MODEL_ID'] ?? 'nvidia/nemotron-nano-9b-v2:free';

/**
 * Retries a live lookup a few times before failing.
 *
 * A generation is not queryable the instant its response returns — OpenRouter finalises it server-side
 * — so a bare call races the API and would fail intermittently for a reason that is not a defect. The
 * budget is deliberately generous: measured against the live API the lookup 404s for the first ~5
 * seconds after the response lands, so a tight retry loop is just a slower way to get a flake.
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

/**
 * A manual tool. `execute: false` is what makes the SDK emit the call without running it, and
 * `requireApproval` is what makes it PAUSE on that call instead of finishing the turn without it —
 * both are required for a deferred pause, and only the pair produces one.
 */
const DEFERRED_TOOL_NAME = 'await_external_review';
const deferredTool = tool({
  name: DEFERRED_TOOL_NAME,
  description: 'Waits on a decision made outside this process.',
  inputSchema: z.object({ subject: z.string() }),
  requireApproval: true,
  execute: false
});

describe('OpenRouterRunTaskService (firestore emulator)', () => {
  adminFirestoreFactory((f) => {
    interface TestStack {
      readonly service: OpenRouterRunTaskService;
      readonly fake: FakeOpenRouterClient;
      readonly storage: FakeStorageContext;
      readonly terminal: OpenRouterRunTaskExecutionResult[];
      readonly promptDocument: OpenRouterPromptDocument;
      readonly collections: ReturnType<typeof buildCollections>;
      readonly taskData: (key: string) => Promise<Maybe<OpenRouterRunTask>>;
    }

    function buildCollections() {
      const context = f.firestoreContext;

      return {
        openRouterPromptCollection: openRouterPromptFirestoreCollection(context),
        openRouterPromptVersionCollectionFactory: openRouterPromptVersionFirestoreCollectionFactory(context),
        openRouterPromptVersionCollectionGroup: openRouterPromptVersionFirestoreCollectionGroup(context),
        openRouterRunTaskCollection: openRouterRunTaskFirestoreCollection(context)
      };
    }

    interface BuildStackConfig {
      readonly reply?: FakeOpenRouterReplyFactory | FakeOpenRouterReply;
      readonly tools?: readonly Tool[];
      readonly maxAttempts?: number;
      readonly config?: OpenRouterModelConfig;
      readonly promptKey?: string;
      /**
       * Client to run against, replacing the fake. Only the live end-to-end block passes one.
       */
      readonly client?: OpenRouterCore;
      /**
       * Explicit file attachment mode. Unset means the service's default, which is `signedUrl`.
       */
      readonly fileAttachmentMode?: OpenRouterFileAttachmentMode;
    }

    async function buildStack(config?: BuildStackConfig): Promise<TestStack> {
      const collections = buildCollections();
      const promptKey = config?.promptKey ?? TEST_PROMPT_KEY;
      const promptService = openRouterPromptService({ collections, cacheDuration: 1 });
      const actionsContext = { ...firebaseServerActionsContext(), ...collections, firestoreContext: f.firestoreContext, openRouterPromptService: promptService };
      const actions = openRouterPromptServerActions(actionsContext);

      const promptDocument = await actions.createOpenRouterPrompt({ key: promptKey, name: 'Test Prompt' });
      const publish = await actions.publishOpenRouterPromptVersion({ key: firestoreModelKey(openRouterPromptIdentity, promptKey), instructions: 'You are a test.', config: (config?.config ?? TEST_MODEL_CONFIG) as Record<string, unknown>, activate: true });
      await publish(promptDocument);

      const fake = fakeOpenRouterClient(config?.reply ?? { text: 'ok' });
      const storage = fakeStorageContext();
      const terminal: OpenRouterRunTaskExecutionResult[] = [];

      const service = openRouterRunTaskService({
        collections,
        promptService,
        client: config?.client ?? fake.client,
        storageContext: storage.storageContext,
        fileAttachmentMode: config?.fileAttachmentMode,
        tools: config?.tools,
        maxAttempts: config?.maxAttempts,
        onTerminalState: async (_document, result) => {
          terminal.push(result);
        }
      });

      return {
        service,
        fake,
        storage,
        terminal,
        promptDocument,
        collections,
        taskData: (key: string) => collections.openRouterRunTaskCollection.documentAccessor().loadDocumentForId(key).snapshotData()
      };
    }

    // MARK: 1 — Queue drain
    describe('queue drain', () => {
      it('should drive 25 enqueued tasks to a terminal state in one sweep', async () => {
        const stack = await buildStack();

        for (let i = 0; i < 25; i += 1) {
          await stack.service.enqueueRunTask({ key: `drain_${i}`, promptKey: TEST_PROMPT_KEY, input: `task ${i}` });
        }

        const result = await openRouterRunTaskSweep({ service: stack.service, maxParallelTasks: 10, pageSize: 10 });

        expect(result.executed).toBe(25);
        expect(result.completed).toBe(25);
        expect(result.stoppedForTimeBudget).toBe(false);

        const states = await Promise.all(Array.from({ length: 25 }, (_, i) => stack.taskData(`drain_${i}`)));
        states.forEach((task) => expect(task?.s).toBe(OpenRouterRunTaskState.COMPLETE));
      });

      it('should claim in queue order', async () => {
        // Claim order is the assertable one: execution runs ten at a time, so completion order is not
        // meaningful, but which ten get claimed first is the whole of what `qat` decides. Queue order is the
        // ONLY order — a priority column would cost a second composite index and buy a second failure mode.
        const stack = await buildStack();
        const keys = ['q_first', 'q_second', 'q_third', 'q_fourth'];

        for (const key of keys) {
          await stack.service.enqueueRunTask({ key, promptKey: TEST_PROMPT_KEY, input: key });
          // Distinct `qat` values, so the sort has something to sort on.
          await new Promise((resolve) => setTimeout(resolve, 15));
        }

        const claimed = await stack.service.claimNextRunTasks({ limit: 10, leaseOwner: 'test' });
        expect(claimed.map((x) => x.id)).toEqual(keys);
      });
    });

    // MARK: 2 — Double-run safety
    describe('double-run safety', () => {
      it('should never execute a task twice across two concurrent sweeps', async () => {
        const executions: string[] = [];
        const stack = await buildStack({
          reply: (body) => {
            executions.push(JSON.stringify(body['input']));
            return { text: 'ok', delayMs: 25 };
          }
        });

        const keys = Array.from({ length: 8 }, (_, i) => `race_${i}`);

        for (const key of keys) {
          await stack.service.enqueueRunTask({ key, promptKey: TEST_PROMPT_KEY, input: key });
        }

        const [a, b] = await Promise.all([openRouterRunTaskSweep({ service: stack.service, maxParallelTasks: 8, pageSize: 8, leaseOwner: 'sweep_a' }), openRouterRunTaskSweep({ service: stack.service, maxParallelTasks: 8, pageSize: 8, leaseOwner: 'sweep_b' })]);

        const executedKeys = [...a.results, ...b.results].map((x) => x.key);
        expect(new Set(executedKeys).size).toBe(executedKeys.length);
        expect(new Set(executedKeys)).toEqual(new Set(keys));
        // One inference per task: the transactional claim is what makes that true, not the sweep loop.
        expect(stack.fake.callCount).toBe(keys.length);
      });
    });

    // MARK: 3 — Crash reclamation
    describe('crash reclamation', () => {
      it('should reclaim and complete a RUNNING task whose lease has gone stale', async () => {
        const stack = await buildStack();
        const document = stack.collections.openRouterRunTaskCollection.documentAccessor().loadDocumentForId('crashed');

        await document.accessor.set({
          s: OpenRouterRunTaskState.RUNNING,
          qat: new Date(Date.now() - MS_IN_HOUR),
          sat: new Date(Date.now() - MS_IN_HOUR),
          lat: new Date(Date.now() - MS_IN_HOUR),
          lo: 'a_sweep_that_died',
          at: 1,
          pk: TEST_PROMPT_KEY,
          pv: 1,
          in: [{ role: 'user', content: 'unfinished work' }]
        });

        const result = await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        expect(result.completed).toBe(1);
        expect((await stack.taskData('crashed'))?.s).toBe(OpenRouterRunTaskState.COMPLETE);
      });

      it('should NOT reclaim a RUNNING task whose lease is still fresh', async () => {
        const stack = await buildStack();
        const document = stack.collections.openRouterRunTaskCollection.documentAccessor().loadDocumentForId('healthy');

        await document.accessor.set({
          s: OpenRouterRunTaskState.RUNNING,
          qat: new Date(),
          lat: new Date(),
          lo: 'a_live_sweep',
          at: 1,
          pk: TEST_PROMPT_KEY,
          pv: 1,
          in: []
        });

        const result = await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });
        expect(result.executed).toBe(0);
      });
    });

    // MARK: 5 — StateAccessor round-trip
    describe('state accessor round trip', () => {
      it('should continue an interrupted multi-step run rather than restart it', async () => {
        // Turn 1 parks on a deferred tool; the resumed turn must carry the whole prior conversation,
        // because OpenRouter has no `previous_response_id` to carry it for us.
        const stack = await buildStack({
          tools: [deferredTool],
          reply: (_body, index) => (index === 0 ? { toolCalls: [{ callId: 'call_1', name: DEFERRED_TOOL_NAME, arguments: { subject: 'resume' } }] } : { text: 'continued' })
        });

        await stack.service.enqueueRunTask({ key: 'multistep', promptKey: TEST_PROMPT_KEY, input: 'please review this' });
        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        const parked = await stack.taskData('multistep');
        expect(parked?.s).toBe(OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS);
        expect((parked?.msg ?? []).length).toBeGreaterThan(0);

        await stack.service.resolveDeferredTool({ key: 'multistep', taskId: 'call_1', output: { approved: true } });
        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        expect(stack.fake.callCount).toBe(2);

        const resumedInput = JSON.stringify(stack.fake.requests[1]['input']);
        // Continued: the original ask and the tool result are both on the second request.
        expect(resumedInput).toContain('please review this');
        expect(resumedInput).toContain('function_call_output');
        // …and the original ask appears exactly once, so the conversation was continued, not replayed.
        expect(resumedInput.split('please review this').length - 1).toBe(1);
      });
    });

    // MARK: 6 — Deferred tool resume
    describe('deferred tool resume', () => {
      it('should park at AWAITING_ASYNC_TOOLS and complete once resolved from another context', async () => {
        const stack = await buildStack({
          tools: [deferredTool],
          reply: (_body, index) => (index === 0 ? { toolCalls: [{ callId: 'call_defer', name: DEFERRED_TOOL_NAME, arguments: { subject: 'hiring' } }] } : { text: 'the reviewer approved it' })
        });

        await stack.service.enqueueRunTask({ key: 'deferred', promptKey: TEST_PROMPT_KEY, input: 'ask the reviewer' });
        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        const parked = await stack.taskData('deferred');
        expect(parked?.s).toBe(OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS);
        expect(parked?.ptc?.map((x) => x.taskId)).toEqual(['call_defer']);
        // The lease is released while parked, so a crashed sweep does not hold a paused run hostage.
        expect(parked?.lat).toBeFalsy();

        // A sweep in between must NOT pick it back up: nothing has been resolved yet.
        const idle = await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });
        expect(idle.executed).toBe(0);

        // Resolution arrives from a separate context — a webhook, a worker, a human.
        const resolution = await stack.service.resolveDeferredTool({ key: 'deferred', taskId: 'call_defer', output: { decision: 'approve' } });
        expect(resolution.resolved).toBe(true);
        expect(resolution.ready).toBe(true);
        expect((await stack.taskData('deferred'))?.s).toBe(OpenRouterRunTaskState.QUEUED);

        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        const finished = await stack.taskData('deferred');
        expect(finished?.s).toBe(OpenRouterRunTaskState.COMPLETE);
        expect(finished?.o).toBe('the reviewer approved it');
        // The pause data is cleared once replayed, so a later sweep cannot resume the same run again.
        expect(finished?.ptc ?? []).toEqual([]);
        expect(finished?.utr ?? []).toEqual([]);

        const resumedInput = JSON.stringify(stack.fake.requests[1]['input']);
        // The externally-produced output is on the wire — the thing the SDK's own resume API cannot do.
        expect(resumedInput).toContain('approve');
      });

      it('should treat a replayed resolution as a no-op', async () => {
        // Resolutions come from outside this process and can be delivered more than once.
        const stack = await buildStack({
          tools: [deferredTool],
          reply: (_body, index) => (index === 0 ? { toolCalls: [{ callId: 'call_dupe', name: DEFERRED_TOOL_NAME, arguments: { subject: 'x' } }] } : { text: 'done' })
        });

        await stack.service.enqueueRunTask({ key: 'dupe', promptKey: TEST_PROMPT_KEY, input: 'ask' });
        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        const first = await stack.service.resolveDeferredTool({ key: 'dupe', taskId: 'call_dupe', output: 1 });
        const second = await stack.service.resolveDeferredTool({ key: 'dupe', taskId: 'call_dupe', output: 1 });

        expect(first.resolved).toBe(true);
        expect(second.resolved).toBe(false);
        expect((await stack.taskData('dupe'))?.utr?.length).toBe(1);
      });

      it('should preserve the ORIGINAL qat when a resume returns the task to QUEUED', async () => {
        // `qat` is write-once, and both things that read it depend on that. It is the task's retention age,
        // so a rolling value would let a run cycling through tool resolutions keep pushing its own age
        // forward and never age out. And it is the claim order: a run waiting on a tool since yesterday
        // should be claimed ahead of one queued a minute ago, not sent to the back of the line.
        const stack = await buildStack({
          tools: [deferredTool],
          reply: (_body, index) => (index === 0 ? { toolCalls: [{ callId: 'call_qat', name: DEFERRED_TOOL_NAME, arguments: { subject: 'x' } }] } : { text: 'done' })
        });

        await stack.service.enqueueRunTask({ key: 'stable_qat', promptKey: TEST_PROMPT_KEY, input: 'ask' });
        const enqueuedAt = (await stack.taskData('stable_qat'))?.qat;
        expect(enqueuedAt).toBeInstanceOf(Date);

        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });
        expect((await stack.taskData('stable_qat'))?.s).toBe(OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS);

        // Enough of a gap that a reset would be visible.
        await new Promise((resolve) => setTimeout(resolve, 25));
        await stack.service.resolveDeferredTool({ key: 'stable_qat', taskId: 'call_qat', output: 1 });

        const resumed = await stack.taskData('stable_qat');
        expect(resumed?.s).toBe(OpenRouterRunTaskState.QUEUED);
        expect(resumed?.qat?.getTime()).toBe(enqueuedAt?.getTime());
      });
    });

    // MARK: 7 — Prompt versioning
    describe('prompt versioning', () => {
      it('should serve activeVersion to an unpinned caller and the pinned version to a pinned one', async () => {
        const collections = buildCollections();
        const promptService = openRouterPromptService({ collections });
        const actionsContext = { ...firebaseServerActionsContext(), ...collections, firestoreContext: f.firestoreContext, openRouterPromptService: promptService };
        const actions = openRouterPromptServerActions(actionsContext);

        const promptDocument = await actions.createOpenRouterPrompt({ key: 'versioned', name: 'Versioned' });
        const promptModelKey = firestoreModelKey(openRouterPromptIdentity, 'versioned');

        const publishV1 = await actions.publishOpenRouterPromptVersion({ key: promptModelKey, instructions: 'version one', config: TEST_MODEL_CONFIG as Record<string, unknown>, activate: true });
        const v1 = await publishV1(promptDocument);
        expect(v1.version).toBe(1);
        expect(v1.activated).toBe(true);

        expect((await promptService.resolvePrompt({ promptKey: 'versioned' })).instructions).toBe('version one');

        const publishV2 = await actions.publishOpenRouterPromptVersion({ key: promptModelKey, instructions: 'version two', config: TEST_MODEL_CONFIG as Record<string, unknown>, activate: true });
        const v2 = await publishV2(promptDocument);
        expect(v2.version).toBe(2);

        // The publish action clears the cache, so the promotion is visible immediately rather than after
        // the cache window — the whole point of `clearCachedPrompt`.
        expect((await promptService.resolvePrompt({ promptKey: 'versioned' })).instructions).toBe('version two');
        // A pinned caller is unaffected by the promotion. This is what OpenRouter Presets cannot do.
        expect((await promptService.resolvePrompt({ promptKey: 'versioned', version: 1 })).instructions).toBe('version one');
      });

      it('should record the resolved version on the run task at enqueue, not at dispatch', async () => {
        // A promotion between enqueue and dispatch must not change what a queued run is going to say.
        const stack = await buildStack({ promptKey: 'pinned-at-enqueue' });
        await stack.service.enqueueRunTask({ key: 'pinned_run', promptKey: 'pinned-at-enqueue', input: 'hello' });
        expect((await stack.taskData('pinned_run'))?.pv).toBe(1);
      });

      it('should surface a config warning rather than refusing to publish', async () => {
        const collections = buildCollections();
        const promptService = openRouterPromptService({ collections });
        const actionsContext = { ...firebaseServerActionsContext(), ...collections, firestoreContext: f.firestoreContext, openRouterPromptService: promptService };
        const actions = openRouterPromptServerActions(actionsContext);

        const promptDocument = await actions.createOpenRouterPrompt({ key: 'warned', name: 'Warned' });
        const publish = await actions.publishOpenRouterPromptVersion({
          key: firestoreModelKey(openRouterPromptIdentity, 'warned'),
          // No pinned pdf engine: OpenRouter falls back to mistral-ocr silently, which is a warning and
          // not an error precisely because it produces a wrong answer rather than a failure.
          config: { model: 'openai/gpt-5.1', plugins: [{ id: 'file-parser' }] },
          activate: true
        });

        const result = await publish(promptDocument);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings.join(' ')).toContain('mistral-ocr');
      });
    });

    // MARK: 8 — Signed URL freshness
    describe('signed url freshness', () => {
      it('should mint a NEW signed url on a retry rather than replay an expired one', async () => {
        let clock = Date.parse('2026-01-01T00:00:00Z');
        const stack = await buildStack({
          maxAttempts: 3,
          reply: (_body, index) => (index === 0 ? { error: { code: 'server_error', message: 'upstream unavailable' } } : { text: 'parsed' })
        });

        stack.storage.now = () => clock;

        await stack.service.enqueueRunTask({
          key: 'with_file',
          promptKey: TEST_PROMPT_KEY,
          input: 'parse the attached resume',
          files: [{ storagePath: 'resumes/candidate.pdf', filename: 'candidate.pdf' }]
        });

        // `maxPages: 1` models two separate scheduler ticks: without it a single sweep would claim the
        // requeued task again on its next page and retry it immediately, inside the same wall clock.
        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5, maxPages: 1 });
        expect((await stack.taskData('with_file'))?.s).toBe(OpenRouterRunTaskState.QUEUED);

        // Well past any sane signed-url lifetime.
        clock += MS_IN_HOUR * 6;
        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5, maxPages: 1 });

        expect((await stack.taskData('with_file'))?.s).toBe(OpenRouterRunTaskState.COMPLETE);
        expect(stack.storage.signed.length).toBe(2);
        expect(stack.storage.signed[0]).not.toBe(stack.storage.signed[1]);

        const firstUrl = urlsInRequest(stack.fake.requests[0]);
        const secondUrl = urlsInRequest(stack.fake.requests[1]);

        expect(firstUrl).toContain(stack.storage.signed[0]);
        expect(secondUrl).toContain(stack.storage.signed[1]);
        // The stale url is nowhere on the retry — the failure mode this test exists for.
        expect(secondUrl).not.toContain(stack.storage.signed[0]);
      });

      it('should never persist a signed url on the run task', async () => {
        const stack = await buildStack();

        await stack.service.enqueueRunTask({
          key: 'no_stored_url',
          promptKey: TEST_PROMPT_KEY,
          input: 'go',
          files: [{ storagePath: 'resumes/candidate.pdf', filename: 'candidate.pdf' }]
        });

        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        const task = await stack.taskData('no_stored_url');
        expect(JSON.stringify(task?.fp)).not.toContain('storage.example.com');
      });
    });

    // MARK: 8b — Inline (base64) file attachment
    describe('inline file attachment', () => {
      const INLINE_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // "%PDF-1.7"
      const INLINE_PDF_BASE64 = Buffer.from(INLINE_PDF_BYTES).toString('base64');

      it('should send the file as file_data with no file_url at all', async () => {
        // The whole reason inline mode exists: OpenRouter dereferences a `file_url` from the public
        // internet, which cannot reach an object living in the Firebase storage emulator. This asserts
        // against the body the fake fetcher received — i.e. after the SDK's outbound serialization, which
        // is the only place the answer is real.
        const stack = await buildStack({ fileAttachmentMode: 'inlineData' });
        stack.storage.putObject('resumes/candidate.pdf', { bytes: INLINE_PDF_BYTES, contentType: 'application/pdf' });

        await stack.service.enqueueRunTask({
          key: 'inlined',
          promptKey: TEST_PROMPT_KEY,
          input: 'is this a resume?',
          files: [{ storagePath: 'resumes/candidate.pdf', filename: 'candidate.pdf' }]
        });

        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        expect((await stack.taskData('inlined'))?.s).toBe(OpenRouterRunTaskState.COMPLETE);

        const body = JSON.stringify(stack.fake.requests[0]);
        expect(body).toContain(`data:application/pdf;base64,${INLINE_PDF_BASE64}`);
        expect(body).toContain('file_data');
        // Both halves matter: sending a url alongside the data leaves it undefined which one wins, and a
        // url is exactly what does not work here.
        expect(body).not.toContain('file_url');
        expect(stack.storage.signed.length).toBe(0);
      });

      it('should store only the path on the run task, never the base64', async () => {
        // `fp` is written once at enqueue and re-read on every attempt. Inlining there would put the whole
        // file into a document with a 1 MiB ceiling, and re-pay for it on every read.
        const stack = await buildStack({ fileAttachmentMode: 'inlineData' });
        stack.storage.putObject('resumes/candidate.pdf', { bytes: INLINE_PDF_BYTES, contentType: 'application/pdf' });

        await stack.service.enqueueRunTask({
          key: 'inlined_not_stored',
          promptKey: TEST_PROMPT_KEY,
          input: 'go',
          files: [{ storagePath: 'resumes/candidate.pdf', filename: 'candidate.pdf' }]
        });

        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        const task = await stack.taskData('inlined_not_stored');
        expect(task?.fp).toEqual([{ storagePath: 'resumes/candidate.pdf', filename: 'candidate.pdf' }]);
        expect(JSON.stringify(task?.fp)).not.toContain(INLINE_PDF_BASE64);
      });

      it('should keep the base64 out of the conversation a state-accessor save persists', async () => {
        // With tools in play the SDK persists the whole assembled conversation through the state accessor.
        // Unstripped, that writes the file into `msg` on every save — and then replays a stale copy of it
        // on the resume, since `load()` re-points parts it can still find.
        const stack = await buildStack({
          fileAttachmentMode: 'inlineData',
          tools: [deferredTool],
          reply: (_body, index) => (index === 0 ? { toolCalls: [{ callId: 'call_inline', name: DEFERRED_TOOL_NAME, arguments: { subject: 'resume' } }] } : { text: 'reviewed' })
        });

        stack.storage.putObject('resumes/candidate.pdf', { bytes: INLINE_PDF_BYTES, contentType: 'application/pdf' });

        await stack.service.enqueueRunTask({
          key: 'inlined_state',
          promptKey: TEST_PROMPT_KEY,
          input: 'review the attached resume',
          files: [{ storagePath: 'resumes/candidate.pdf', filename: 'candidate.pdf' }]
        });

        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        const parked = await stack.taskData('inlined_state');
        expect(parked?.s).toBe(OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS);
        expect((parked?.msg ?? []).length).toBeGreaterThan(0);
        expect(JSON.stringify(parked?.msg)).not.toContain(INLINE_PDF_BASE64);
        // The filename survives, because that is the key `load()` rejoins the fresh attachment on.
        expect(JSON.stringify(parked?.msg)).toContain('candidate.pdf');

        // …and the resume still carries the file, re-read for the new attempt rather than replayed.
        await stack.service.resolveDeferredTool({ key: 'inlined_state', taskId: 'call_inline', output: { approved: true } });
        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        expect((await stack.taskData('inlined_state'))?.s).toBe(OpenRouterRunTaskState.COMPLETE);
        expect(JSON.stringify(stack.fake.requests[1])).toContain(INLINE_PDF_BASE64);
      });
    });

    // MARK: 9 — Annotation reuse
    describe('annotation reuse', () => {
      it('should resubmit the cached parse instead of the file, so the pdf is not parsed again', async () => {
        const stack = await buildStack();

        await stack.collections.openRouterRunTaskCollection
          .documentAccessor()
          .loadDocumentForId('annotated')
          .accessor.set({
            s: OpenRouterRunTaskState.QUEUED,
            qat: new Date(),
            at: 1,
            pk: TEST_PROMPT_KEY,
            pv: 1,
            in: [{ role: 'user', content: 'summarize the attached resume' }],
            fp: [{ storagePath: 'resumes/candidate.pdf', filename: 'candidate.pdf' }],
            fa: [{ hash: 'sha256:already-parsed', filename: 'candidate.pdf', content: 'PARSED RESUME TEXT' }]
          });

        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        const body = JSON.stringify(stack.fake.requests[0]);
        // The parse rides along as text, which the SDK's request schema preserves…
        expect(body).toContain('PARSED RESUME TEXT');
        expect(body).toContain('sha256:already-parsed');
        // …and the document itself is NOT re-attached, which is the only thing that actually prevents a
        // re-parse: an echo the provider is free to ignore cannot.
        expect(body).not.toContain('input_file');
        expect(body).not.toContain('storage.example.com');
      });

      it('should still attach a file whose parse is not cached', async () => {
        const stack = await buildStack();

        await stack.service.enqueueRunTask({
          key: 'uncached',
          promptKey: TEST_PROMPT_KEY,
          input: 'summarize this',
          files: [{ storagePath: 'resumes/other.pdf', filename: 'other.pdf' }]
        });

        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });
        expect(JSON.stringify(stack.fake.requests[0])).toContain('storage.example.com');
      });
    });

    // MARK: Non-blocking + immediate kickoff
    describe('non-blocking enqueue', () => {
      it('should return from enqueueRunTask in milliseconds with the task still QUEUED', async () => {
        // The whole objective: the owning checkpoint writes one document and returns. If this ever
        // starts waiting on inference, the migration has lost the thing it was for.
        const stack = await buildStack({ reply: { text: 'slow', delayMs: 750 } });

        const startedAt = Date.now();
        const result = await stack.service.enqueueRunTask({ key: 'nonblocking', promptKey: TEST_PROMPT_KEY, input: 'long running work' });
        const elapsed = Date.now() - startedAt;

        expect(result.created).toBe(true);
        expect(result.task.s).toBe(OpenRouterRunTaskState.QUEUED);
        expect(elapsed).toBeLessThan(500);
        expect(stack.fake.callCount).toBe(0);
      });

      it('should reuse an existing run rather than restart it when a checkpoint is re-entered', async () => {
        const stack = await buildStack();

        const first = await stack.service.enqueueRunTask({ key: 'idempotent', promptKey: TEST_PROMPT_KEY, input: 'once' });
        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });
        const second = await stack.service.enqueueRunTask({ key: 'idempotent', promptKey: TEST_PROMPT_KEY, input: 'once' });

        expect(first.created).toBe(true);
        expect(second.created).toBe(false);
        expect(second.task.s).toBe(OpenRouterRunTaskState.COMPLETE);
        expect(stack.fake.callCount).toBe(1);
      });
    });

    describe('immediate kickoff', () => {
      it('should invoke the terminal-state handler as soon as a run finishes', async () => {
        // The in-process replacement for OpenAI's completion webhook: the owning NotificationTask is
        // expedited here, without an inbound round-trip and without waiting for the next natural sweep.
        const stack = await buildStack();

        await stack.service.enqueueRunTask({ key: 'kickoff_ok', promptKey: TEST_PROMPT_KEY, input: 'go' });
        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        expect(stack.terminal.map((x) => x.key)).toEqual(['kickoff_ok']);
        expect(stack.terminal[0].state).toBe(OpenRouterRunTaskState.COMPLETE);
      });

      it('should invoke the terminal-state handler on a definitive failure but not on a retry', async () => {
        const stack = await buildStack({ maxAttempts: 2, reply: { error: { code: 'server_error', message: 'nope' } } });

        await stack.service.enqueueRunTask({ key: 'kickoff_fail', promptKey: TEST_PROMPT_KEY, input: 'go' });

        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5, maxPages: 1 });
        // First attempt requeued — the owning work is not done, so nothing is expedited.
        expect(stack.terminal).toEqual([]);
        expect((await stack.taskData('kickoff_fail'))?.s).toBe(OpenRouterRunTaskState.QUEUED);

        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5, maxPages: 1 });
        expect((await stack.taskData('kickoff_fail'))?.s).toBe(OpenRouterRunTaskState.FAILED);
        expect(stack.terminal.map((x) => x.state)).toEqual([OpenRouterRunTaskState.FAILED]);
      });

      it('should spend exactly maxAttempts attempts before failing', async () => {
        // The claim increments the attempt counter, so an off-by-one here spends the budget a tick early
        // and fails a task with a retry still owed to it.
        const stack = await buildStack({ maxAttempts: 3, reply: { error: { code: 'server_error', message: 'nope' } } });

        await stack.service.enqueueRunTask({ key: 'attempt_budget', promptKey: TEST_PROMPT_KEY, input: 'go' });
        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        const task = await stack.taskData('attempt_budget');
        expect(task?.s).toBe(OpenRouterRunTaskState.FAILED);
        expect(task?.at).toBe(3);
        expect(stack.fake.callCount).toBe(3);
        expect(task?.e?.message).toBe('nope');
      });
    });

    // MARK: Retention
    describe('retention', () => {
      const OVER_AGE = new Date(Date.now() - OPENROUTER_RUN_TASK_MAX_AGE - MS_IN_HOUR);
      const IN_AGE = new Date(Date.now() - MS_IN_HOUR);

      interface SeedTaskConfig {
        readonly stack: TestStack;
        readonly key: string;
        readonly state: OpenRouterRunTaskState;
        readonly qat: Date;
        readonly overrides?: Partial<OpenRouterRunTask>;
      }

      async function seedTask(config: SeedTaskConfig) {
        const { stack, key, state, qat, overrides } = config;

        await stack.collections.openRouterRunTaskCollection
          .documentAccessor()
          .loadDocumentForId(key)
          .accessor.set({ s: state, qat, at: 1, pk: TEST_PROMPT_KEY, pv: 1, in: [], ...overrides });
      }

      it('should delete an over-age task in EVERY state', async () => {
        // The ceiling is the whole requirement. A run task is a short-lived execution record —
        // NotificationTask owns retrying and durable persistence — so nothing outlives the age, and a task
        // still RUNNING a week after it was queued has been lease-reclaimed and re-attempted for a week,
        // which is the clearest case of all for deleting it.
        const stack = await buildStack();

        await seedTask({ stack, key: 'old_queued', state: OpenRouterRunTaskState.QUEUED, qat: OVER_AGE });
        // A FRESH lease, so nothing else in the system would touch this one.
        await seedTask({ stack, key: 'old_running', state: OpenRouterRunTaskState.RUNNING, qat: OVER_AGE, overrides: { lat: new Date(), lo: 'a_live_sweep' } });
        await seedTask({ stack, key: 'old_complete', state: OpenRouterRunTaskState.COMPLETE, qat: OVER_AGE, overrides: { fat: OVER_AGE, o: 'answered' } });
        await seedTask({ stack, key: 'old_awaiting', state: OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS, qat: OVER_AGE, overrides: { ptc: [{ callId: 'c1', name: 't', taskId: 'k1' }] } });

        const result = await openRouterRunTaskExpirationSweep({ service: stack.service });

        expect(result.deleted).toBe(4);
        expect(result.pages).toBe(1);
        expect(await stack.taskData('old_queued')).toBeUndefined();
        expect(await stack.taskData('old_running')).toBeUndefined();
        expect(await stack.taskData('old_complete')).toBeUndefined();
        expect(await stack.taskData('old_awaiting')).toBeUndefined();
      });

      it('should NOT delete a task still inside its retention age', async () => {
        const stack = await buildStack();

        await seedTask({ stack, key: 'recent_queued', state: OpenRouterRunTaskState.QUEUED, qat: IN_AGE });
        await seedTask({ stack, key: 'recent_complete', state: OpenRouterRunTaskState.COMPLETE, qat: IN_AGE, overrides: { fat: IN_AGE } });

        const result = await openRouterRunTaskExpirationSweep({ service: stack.service });

        expect(result.deleted).toBe(0);
        expect(await stack.taskData('recent_queued')).toBeDefined();
        expect(await stack.taskData('recent_complete')).toBeDefined();
      });

      it('should page through more expired tasks than one page holds', async () => {
        // Proves the cursor-less loop terminates. No cursor is needed because the page just deleted no
        // longer matches the query, so re-running it IS the next page.
        const stack = await buildStack();

        for (let i = 0; i < 7; i += 1) {
          await seedTask({ stack, key: `paged_${i}`, state: OpenRouterRunTaskState.COMPLETE, qat: new Date(OVER_AGE.getTime() + i) });
        }

        const result = await openRouterRunTaskExpirationSweep({ service: stack.service, pageSize: 3 });

        expect(result.deleted).toBe(7);
        expect(result.pages).toBe(3);
        const remaining = await Promise.all(Array.from({ length: 7 }, (_, i) => stack.taskData(`paged_${i}`)));
        remaining.forEach((task) => expect(task).toBeUndefined());
      });

      it('should not abort the drain sweep when a running task is deleted mid-flight', async () => {
        // Traced: the delete lands after executeRunTask already read the task, so its null guard does not
        // fire, and the next `document.update()` throws NOT_FOUND — including the write recordFailure()
        // makes while handling the FIRST throw, which is outside any try. Without the guard that rejection
        // propagates through performTasksInParallel and takes the whole sweep down, discarding every result
        // it had already collected. The sweep must RESOLVE with `failed: 1`, not reject.
        const collections = buildCollections();
        const stack = await buildStack({
          reply: async (_body, index) => {
            if (index === 0) {
              await collections.openRouterRunTaskCollection.documentAccessor().loadDocumentForId('deleted_midflight').accessor.delete();
            }

            return { text: 'answered into the void' };
          }
        });

        await stack.service.enqueueRunTask({ key: 'deleted_midflight', promptKey: TEST_PROMPT_KEY, input: 'go' });
        // A distinct `qat`, so claim order — and therefore which task the index-0 reply belongs to — is
        // deterministic rather than a millisecond race.
        await new Promise((resolve) => setTimeout(resolve, 15));
        await stack.service.enqueueRunTask({ key: 'survivor', promptKey: TEST_PROMPT_KEY, input: 'go' });

        // Serial execution, so the index-0 call is the first-queued task's.
        const result = await openRouterRunTaskSweep({ service: stack.service, maxParallelTasks: 1, pageSize: 5, maxPages: 1 });

        expect(result.failed).toBe(1);
        expect(result.executed).toBe(2);
        expect(await stack.taskData('deleted_midflight')).toBeUndefined();
        // The other task's result survived rather than being discarded with the rejection.
        expect((await stack.taskData('survivor'))?.s).toBe(OpenRouterRunTaskState.COMPLETE);
        // The owning NotificationTask still learns the run is not coming.
        expect(stack.terminal.map((x) => x.key).sort()).toEqual(['deleted_midflight', 'survivor']);
      });
    });

    // MARK: file_search passthrough (the half of the spike that needs no credentials)
    describe('file_search hosted tool', () => {
      async function publishWithConfig(promptKey: string, config: Record<string, unknown>) {
        const collections = buildCollections();
        const promptService = openRouterPromptService({ collections });
        const actionsContext = { ...firebaseServerActionsContext(), ...collections, firestoreContext: f.firestoreContext, openRouterPromptService: promptService };
        const actions = openRouterPromptServerActions(actionsContext);

        const promptDocument = await actions.createOpenRouterPrompt({ key: promptKey, name: promptKey });
        const publish = await actions.publishOpenRouterPromptVersion({ key: firestoreModelKey(openRouterPromptIdentity, promptKey), config, activate: true });

        return publish(promptDocument);
      }

      it('should send a hosted file_search tool on the wire, in wire case', async () => {
        // Half the file_search spike needs no credentials: before asking whether OpenRouter HONOURS the
        // tool, establish whether our own stack can even send one. This asserts against the body the fake
        // fetcher received — i.e. after the SDK's own outbound serialization, which is where a hosted
        // entry used to be dropped (no client tools) or throw (with them) inside `callModel`.
        const config = { ...TEST_MODEL_CONFIG, tools: [openRouterFileSearchTool(['vs_test_store'], 5)], include: ['file_search_call.results'] };
        const stack = await buildStack({ promptKey: 'file-search', config: config as OpenRouterModelConfig });

        await stack.service.enqueueRunTask({ key: 'file_search_run', promptKey: 'file-search', input: 'quote one sentence from the knowledge base' });
        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        expect((await stack.taskData('file_search_run'))?.s).toBe(OpenRouterRunTaskState.COMPLETE);

        const body = stack.fake.requests[0];
        expect(body['tools']).toEqual([{ type: 'file_search', vector_store_ids: ['vs_test_store'], max_num_results: 5 }]);
        expect(body['include']).toEqual(['file_search_call.results']);
      });

      it('should merge a hosted tool with a converted client tool rather than choosing one', async () => {
        // The two are NOT mutually exclusive. A client tool has to go through the SDK's converter and a
        // hosted one must not, so the hosted entries are appended AFTER that conversion — which is the
        // one thing `callModel` cannot express, since it owns the `tools` key end to end.
        const config = { ...TEST_MODEL_CONFIG, tools: [openRouterFileSearchTool(['vs_test_store'])] };
        const stack = await buildStack({ promptKey: 'file-search-with-client-tool', config: config as OpenRouterModelConfig, tools: [deferredTool] });

        await stack.service.enqueueRunTask({ key: 'merged_tools_run', promptKey: 'file-search-with-client-tool', input: 'go' });
        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        const sentTools = stack.fake.requests[0]['tools'] as { type: string; name?: string }[];
        expect(sentTools.map((x) => x.type)).toEqual(['function', 'file_search']);
        expect(sentTools[0].name).toBe(DEFERRED_TOOL_NAME);
        expect(sentTools[1]).toEqual({ type: 'file_search', vector_store_ids: ['vs_test_store'] });
      });

      it('should call out a file_search tool authored in wire case specifically', async () => {
        // The SDK names the field `vectorStoreIds` and strips anything else during outbound
        // serialization, so the wire-cased spelling yields a tool that searches nothing.
        await expect(publishWithConfig('bad-file-search', { model: 'openai/gpt-5.1', tools: [{ type: 'file_search', vector_store_ids: ['vs_test_store'] }] })).rejects.toThrow(/vectorStoreIds/);
      });
    });

    // MARK: End-to-end against the live API
    describe.skipIf(!OPENROUTER_LIVE_API_KEY)('live end-to-end', () => {
      it('should drain a real run and resolve its stored generation id', async () => {
        // The plan's end-to-end bullet, minus the one part this repo cannot reach: no app here consumes
        // the models, so there is no model API for the callModel MCP to drive. Everything else is the
        // real thing — `openRouterPromptServerActions` is exactly what that MCP would call, and the
        // client is a live `OpenRouterCore` rather than the fake.
        const client = new OpenRouterClient({ apiKey: OPENROUTER_LIVE_API_KEY as string });
        // The cap is generous on purpose: a hybrid reasoning model spends output tokens on reasoning
        // first, so a tight one truncates the answer away and leaves `o` empty on an otherwise fine run.
        const stack = await buildStack({ promptKey: 'live-e2e', config: { model: LIVE_TEST_MODEL, maxOutputTokens: 2048 }, client });

        await stack.service.enqueueRunTask({ key: 'live_run', promptKey: 'live-e2e', input: 'Reply with exactly: OK' });
        await openRouterRunTaskSweep({ service: stack.service, pageSize: 1 });

        const task = await stack.taskData('live_run');
        expect(task?.s, `The live run did not complete: ${JSON.stringify(task?.e)}`).toBe(OpenRouterRunTaskState.COMPLETE);
        expect(task?.o).toBeTruthy();
        expect(task?.u?.totalTokens ?? 0).toBeGreaterThan(0);
        // Cost is reported even on a free model, where it is 0 — its PRESENCE is the assertion.
        expect(task?.u?.cost).toBeDefined();

        const generationId = (task?.gi ?? [])[0];
        expect(generationId).toBeTruthy();

        // A generation is not queryable the instant its response returns, so this is given a few tries
        // before it counts as a failure rather than as a race.
        const generation = await retryLive(() => openRouterGeneration({ client, id: generationId }));
        expect(generation.id).toBe(generationId);
        expect(generation.model).toContain(LIVE_TEST_MODEL.split(':')[0]);
      }, 120_000);
    });

    // MARK: Trace
    describe('trace metadata', () => {
      it('should carry the run task key as a trace attribute on every request', async () => {
        const stack = await buildStack();

        await stack.service.enqueueRunTask({ key: 'traced', promptKey: TEST_PROMPT_KEY, input: 'go' });
        await openRouterRunTaskSweep({ service: stack.service, pageSize: 5 });

        // This is the correlation handle the broadcast webhook reads back off the OTLP span.
        expect(JSON.stringify(stack.fake.requests[0]['trace'])).toContain('traced');
      });
    });
  });
});

// MARK: Webhook reconciliation
describe('openRouter broadcast reconciliation (firestore emulator)', () => {
  adminFirestoreFactory((f) => {
    let collections: { openRouterRunTaskCollection: ReturnType<typeof openRouterRunTaskFirestoreCollection> };

    beforeEach(() => {
      collections = { openRouterRunTaskCollection: openRouterRunTaskFirestoreCollection(f.firestoreContext) };
    });

    async function seedCompletedTask(key: string) {
      const document = collections.openRouterRunTaskCollection.documentAccessor().loadDocumentForId(key);

      await document.accessor.set({
        s: OpenRouterRunTaskState.COMPLETE,
        qat: new Date(),
        fat: new Date(),
        at: 1,
        pk: TEST_PROMPT_KEY,
        pv: 1,
        in: [],
        o: 'the answer',
        gi: ['gen_local'],
        u: { inputTokens: 1, outputTokens: 1, totalTokens: 2, cost: 0.0001 }
      });

      return document;
    }

    it('should land generation id and usage on the run task named by the trace', async () => {
      const document = await seedCompletedTask('broadcast_target');
      const payload = broadcastPayload({ runTaskKey: 'broadcast_target', generationId: 'gen_upstream', cost: 0.0425, promptTokens: 900, completionTokens: 120, totalTokens: 1020 });

      const handled = await handleBroadcastAtController(payload, collections);
      expect(handled).toBe(1);

      const task = await document.snapshotData();
      expect(task?.gi).toEqual(['gen_local', 'gen_upstream']);
      // Cost is finalised server-side, so the broadcast value is the authoritative one.
      expect(task?.u?.cost).toBe(0.0425);
      expect(task?.u?.inputTokens).toBe(900);
      // State is untouched: this is telemetry, and telemetry never moves control flow.
      expect(task?.s).toBe(OpenRouterRunTaskState.COMPLETE);
      expect(task?.o).toBe('the answer');
    });

    it('should leave every task untouched when the trace names nothing we know', async () => {
      const document = await seedCompletedTask('broadcast_untouched');
      const before = await document.snapshotData();

      const unmatched = await handleBroadcastAtController(broadcastPayload({ runTaskKey: 'some_other_run', generationId: 'gen_x', cost: 9.99 }), collections);
      expect(unmatched).toBe(1);

      const after = await document.snapshotData();
      expect(after?.u?.cost).toBe(before?.u?.cost);
      expect(after?.gi).toEqual(before?.gi);
      expect(after?.s).toBe(OpenRouterRunTaskState.COMPLETE);
    });

    it('should leave the task untouched when the trace is dropped entirely', async () => {
      // A broadcast is enabled account-wide and delivered best-effort. A span with no correlation
      // attribute must be a no-op, never a reason to touch a run.
      const document = await seedCompletedTask('broadcast_no_trace');
      const before = await document.snapshotData();

      await handleBroadcastAtController(broadcastPayload({ generationId: 'gen_y', cost: 9.99 }), collections);

      const after = await document.snapshotData();
      expect(after?.u?.cost).toBe(before?.u?.cost);
      expect(after?.gi).toEqual(before?.gi);
    });

    it('should reject a request whose secret does not match', async () => {
      await expect(handleBroadcastAtController(broadcastPayload({ runTaskKey: 'anything' }), collections, 'the-wrong-secret')).rejects.toThrow();
    });
  });
});

// MARK: Helpers
function urlsInRequest(body: Record<string, unknown>): string {
  return JSON.stringify(body['input'] ?? []);
}

interface BroadcastPayloadConfig {
  readonly runTaskKey?: Maybe<string>;
  readonly generationId?: Maybe<string>;
  readonly cost?: Maybe<number>;
  readonly promptTokens?: Maybe<number>;
  readonly completionTokens?: Maybe<number>;
  readonly totalTokens?: Maybe<number>;
}

/**
 * Builds an OTLP/JSON broadcast payload of the shape OpenRouter posts, carrying a `trace: { runTaskKey }`
 * property as a span attribute.
 */
function broadcastPayload(config: BroadcastPayloadConfig) {
  const attributes: { key: string; value: Record<string, unknown> }[] = [];

  if (config.runTaskKey != null) {
    attributes.push({ key: 'runTaskKey', value: { stringValue: config.runTaskKey } });
  }

  if (config.generationId != null) {
    attributes.push({ key: 'gen_ai.response.id', value: { stringValue: config.generationId } });
  }

  if (config.cost != null) {
    attributes.push({ key: 'gen_ai.usage.cost', value: { doubleValue: config.cost } });
  }

  if (config.promptTokens != null) {
    attributes.push({ key: 'gen_ai.usage.prompt_tokens', value: { intValue: String(config.promptTokens) } });
  }

  if (config.completionTokens != null) {
    attributes.push({ key: 'gen_ai.usage.completion_tokens', value: { intValue: String(config.completionTokens) } });
  }

  if (config.totalTokens != null) {
    attributes.push({ key: 'gen_ai.usage.total_tokens', value: { intValue: String(config.totalTokens) } });
  }

  return {
    resourceSpans: [
      {
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'openrouter' } }] },
        scopeSpans: [{ scope: { name: 'openrouter' }, spans: [{ traceId: 'abc', spanId: 'def', name: 'chat', startTimeUnixNano: '1', endTimeUnixNano: '2', attributes }] }]
      }
    ]
  };
}

const WEBHOOK_SECRET = 'test-webhook-secret';

/**
 * Posts a broadcast payload at the real `@dereekb/nestjs/openrouter` controller, with the reconciler
 * wired in as the span handler.
 *
 * @returns The number of spans the handler claimed.
 */
async function handleBroadcastAtController(payload: ReturnType<typeof broadcastPayload>, collections: Parameters<typeof reconcileOpenRouterRunTaskFromBroadcast>[0]['collections'], secret: string = WEBHOOK_SECRET): Promise<number> {
  const service = new OpenRouterWebhookService({ openrouterWebhook: { webhookSecret: WEBHOOK_SECRET } });
  let handled = 0;

  service.configure(null, (configurer) => {
    configurer.handleAnySpan(async (span) => {
      const key = openRouterRunTaskKeyFromBroadcastAttributes(span.attributes);
      await reconcileOpenRouterRunTaskFromBroadcast({ collections, key, generation: span.generation });
      handled += 1;
      return true;
    });
  });

  const controller = new OpenRouterWebhookController(service);
  const request = { headers: { authorization: `Bearer ${secret}` } } as unknown as Parameters<typeof controller.handleOpenRouterWebhookPost>[0];

  await controller.handleOpenRouterWebhookPost(request, payload);
  return handled;
}
