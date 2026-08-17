import { describe, expect, it } from 'vitest';
import { assertSnapshotData } from '@dereekb/firebase-server';
import { describeCallableRequestTest, expectFailAssertHttpErrorServerErrorCode } from '@dereekb/firebase-server/test';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { BAD_REQUEST_ERROR_CODE, FORBIDDEN_ERROR_CODE, MODEL_NOT_AVAILABLE_ERROR_CODE, type OnCallQueryModelResult, firestoreModelKey, onCallCreateModelParams, onCallQueryModelParams, onCallUpdateModelParams } from '@dereekb/firebase';
import { type OpenRouterModelConfig } from '@dereekb/openrouter';
import { type CreateOpenRouterPromptVersionParams, type CreateOpenRouterPromptVersionResult, type OpenRouterPrompt, type OpenRouterPromptDocument, OpenRouterPromptState, type QueryOpenRouterPromptsParams, type UpdateOpenRouterPromptParams, type UpdateOpenRouterPromptVersionParams, type UpdateOpenRouterPromptVersionResult, openRouterPromptIdentity, openRouterPromptVersionId, openRouterPromptVersionIdentity } from '@dereekb/openrouter/firebase';
import { demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext } from '../../../test/fixture';
import { demoCallModel } from '../model/crud.functions';

const TEST_PROMPT_KEY = 'crud-test-prompt';
const TEST_MODEL_CONFIG: OpenRouterModelConfig = { model: 'openai/gpt-5.1', provider: { only: ['openai'], allowFallbacks: false, requireParameters: true } };

demoApiFunctionContextFactory((f) => {
  /**
   * Creates a prompt through the server action.
   *
   * A prompt has no `create` on the model API — it comes into existence server-side — so setup goes
   * through the action rather than a callable.
   */
  async function createPrompt(key = TEST_PROMPT_KEY, name = 'CRUD Test Prompt'): Promise<OpenRouterPromptDocument> {
    return f.openRouterPromptServerActions.createOpenRouterPrompt({ key, name });
  }

  /**
   * Reads a prompt document back.
   */
  async function readPrompt(key = TEST_PROMPT_KEY): Promise<OpenRouterPrompt> {
    return assertSnapshotData(f.demoFirestoreCollections.openRouterPromptCollection.documentAccessor().loadDocumentForId(key));
  }

  describeCallableRequestTest('openrouter.crud', { f, fns: { demoCallModel } }, ({ demoCallModelWrappedFn }) => {
    demoAuthorizedUserAdminContext({ f }, (au) => {
      // No specifier on any of these: crud.functions.ts registers the openrouter operations bare, so the
      // params carry a model type and nothing more.
      const callCreateVersion = (data: CreateOpenRouterPromptVersionParams) => au.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(openRouterPromptVersionIdentity, data)) as Promise<CreateOpenRouterPromptVersionResult>;
      const callUpdateVersion = (data: UpdateOpenRouterPromptVersionParams) => au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(openRouterPromptVersionIdentity, data)) as Promise<UpdateOpenRouterPromptVersionResult>;
      const callUpdatePrompt = (data: UpdateOpenRouterPromptParams) => au.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(openRouterPromptIdentity, data)) as Promise<void>;
      const callQueryPrompts = (data: QueryOpenRouterPromptsParams) => au.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(openRouterPromptIdentity, data)) as Promise<OnCallQueryModelResult<OpenRouterPrompt>>;

      describe('openRouterPromptVersion.create', () => {
        it('should publish the first version and promote it when asked', async () => {
          await createPrompt();

          const result = await callCreateVersion({ prompt: firestoreModelKey(openRouterPromptIdentity, TEST_PROMPT_KEY), instructions: 'You are a test.', config: TEST_MODEL_CONFIG as Record<string, unknown>, activate: true });

          expect(result.version).toBe(1);
          expect(result.activated).toBe(true);
          expect(result.warnings).toEqual([]);
          // The version document's own path, not the prompt's — a create reports what it created.
          expect(result.modelKeys[0]).toContain(openRouterPromptVersionId(1));

          const prompt = await readPrompt();
          expect(prompt.lv).toBe(1);
          expect(prompt.av).toBe(1);
          expect(prompt.s).toBe(OpenRouterPromptState.ACTIVE);
        });

        it('should not promote the version when activate is omitted', async () => {
          await createPrompt();
          await callCreateVersion({ prompt: firestoreModelKey(openRouterPromptIdentity, TEST_PROMPT_KEY), instructions: 'You are a test.', config: TEST_MODEL_CONFIG as Record<string, unknown> });

          const prompt = await readPrompt();
          expect(prompt.lv).toBe(1);
          expect(prompt.av).toBeUndefined();
          expect(prompt.s).toBe(OpenRouterPromptState.DRAFT);
        });

        it('should lock the version it succeeds', async () => {
          await createPrompt();

          const first = await callCreateVersion({ prompt: firestoreModelKey(openRouterPromptIdentity, TEST_PROMPT_KEY), instructions: 'v1', config: TEST_MODEL_CONFIG as Record<string, unknown> });
          const second = await callCreateVersion({ prompt: firestoreModelKey(openRouterPromptIdentity, TEST_PROMPT_KEY), instructions: 'v2', config: TEST_MODEL_CONFIG as Record<string, unknown> });

          expect(second.version).toBe(2);

          const versions = f.demoFirestoreCollections.openRouterPromptVersionCollectionGroup.documentAccessor();
          expect((await versions.loadDocumentForKey(first.modelKeys[0]).snapshotData())?.lk).toBe(true);
          expect((await versions.loadDocumentForKey(second.modelKeys[0]).snapshotData())?.lk).toBeFalsy();
        });

        itShouldFail('when the config names no model', async () => {
          await createPrompt();

          // A plain Error rather than an HttpsError: the action refuses on its own terms, so there is no
          // server error code to assert against.
          await expectFail(() => callCreateVersion({ prompt: firestoreModelKey(openRouterPromptIdentity, TEST_PROMPT_KEY), instructions: 'You are a test.', config: {} }));
        });

        itShouldFail('with MODEL_NOT_AVAILABLE for a prompt that does not exist', async () => {
          await expectFail(() => callCreateVersion({ prompt: firestoreModelKey(openRouterPromptIdentity, 'no-such-prompt'), instructions: 'You are a test.', config: TEST_MODEL_CONFIG as Record<string, unknown> }), expectFailAssertHttpErrorServerErrorCode(MODEL_NOT_AVAILABLE_ERROR_CODE));
        });

        demoAuthorizedUserContext({ f }, (u) => {
          itShouldFail('with FORBIDDEN for a non-admin', async () => {
            await createPrompt();

            // A prompt has no owner to relate a role to, so the role map grants a non-admin nothing.
            await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallCreateModelParams(openRouterPromptVersionIdentity, { prompt: firestoreModelKey(openRouterPromptIdentity, TEST_PROMPT_KEY), instructions: 'You are a test.', config: TEST_MODEL_CONFIG as Record<string, unknown> })), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
          });
        });
      });

      describe('openRouterPromptVersion.update', () => {
        it('should edit the head version in place, keyed by what the create returned', async () => {
          await createPrompt();

          const created = await callCreateVersion({ prompt: firestoreModelKey(openRouterPromptIdentity, TEST_PROMPT_KEY), instructions: 'You are a test.', config: TEST_MODEL_CONFIG as Record<string, unknown> });
          const result = await callUpdateVersion({ key: created.modelKeys[0], instructions: 'You are an edited test.', notes: 'Reworded.' });

          expect(result.warnings).toEqual([]);

          const version = await assertSnapshotData(f.demoFirestoreCollections.openRouterPromptVersionCollectionGroup.documentAccessor().loadDocumentForKey(created.modelKeys[0]));
          expect(version.i).toBe('You are an edited test.');
          expect(version.nt).toBe('Reworded.');
          // Untouched fields are left as they were rather than cleared.
          expect(version.c).toEqual(TEST_MODEL_CONFIG);
        });

        itShouldFail('when the version has been locked by a newer one', async () => {
          await createPrompt();

          const first = await callCreateVersion({ prompt: firestoreModelKey(openRouterPromptIdentity, TEST_PROMPT_KEY), instructions: 'v1', config: TEST_MODEL_CONFIG as Record<string, unknown> });
          await callCreateVersion({ prompt: firestoreModelKey(openRouterPromptIdentity, TEST_PROMPT_KEY), instructions: 'v2', config: TEST_MODEL_CONFIG as Record<string, unknown> });

          await expectFail(() => callUpdateVersion({ key: first.modelKeys[0], instructions: 'edited after the lock' }));
        });

        itShouldFail('with BAD_REQUEST when no key is supplied', async () => {
          await expectFail(() => callUpdateVersion({ instructions: 'nowhere to land' }), expectFailAssertHttpErrorServerErrorCode(BAD_REQUEST_ERROR_CODE));
        });

        demoAuthorizedUserContext({ f }, (u) => {
          itShouldFail('with FORBIDDEN for a non-admin', async () => {
            await createPrompt();
            const created = await callCreateVersion({ prompt: firestoreModelKey(openRouterPromptIdentity, TEST_PROMPT_KEY), instructions: 'v1', config: TEST_MODEL_CONFIG as Record<string, unknown> });

            await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(openRouterPromptVersionIdentity, { key: created.modelKeys[0], instructions: 'not yours' })), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
          });
        });
      });

      describe('openRouterPrompt.update', () => {
        it('should update the metadata and lifecycle state', async () => {
          const document = await createPrompt();

          await callUpdatePrompt({ key: document.key, name: 'Renamed', description: 'What it is for.', tags: ['demo', 'resume'], state: OpenRouterPromptState.ARCHIVED });

          const prompt = await readPrompt();
          expect(prompt.n).toBe('Renamed');
          expect(prompt.d).toBe('What it is for.');
          expect(prompt.t).toEqual(['demo', 'resume']);
          expect(prompt.s).toBe(OpenRouterPromptState.ARCHIVED);
        });

        it('should promote a version that exists', async () => {
          const document = await createPrompt();

          await callCreateVersion({ prompt: firestoreModelKey(openRouterPromptIdentity, TEST_PROMPT_KEY), instructions: 'v1', config: TEST_MODEL_CONFIG as Record<string, unknown> });
          await callUpdatePrompt({ key: document.key, activeVersion: 1, state: OpenRouterPromptState.ACTIVE });

          const prompt = await readPrompt();
          expect(prompt.av).toBe(1);
          expect(prompt.s).toBe(OpenRouterPromptState.ACTIVE);
        });

        itShouldFail('when promoting to a version that was never published', async () => {
          const document = await createPrompt();

          // Promoting to a missing version would leave every unpinned caller failing to resolve.
          await expectFail(() => callUpdatePrompt({ key: document.key, activeVersion: 7 }));
        });

        itShouldFail('with BAD_REQUEST when no key is supplied', async () => {
          await expectFail(() => callUpdatePrompt({ name: 'nowhere to land' }), expectFailAssertHttpErrorServerErrorCode(BAD_REQUEST_ERROR_CODE));
        });

        demoAuthorizedUserContext({ f }, (u) => {
          itShouldFail('with FORBIDDEN for a non-admin', async () => {
            const document = await createPrompt();

            await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallUpdateModelParams(openRouterPromptIdentity, { key: document.key, name: 'not yours' })), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
          });
        });
      });

      describe('openRouterPrompt.query', () => {
        it('should return the prompts and their keys', async () => {
          await createPrompt('crud-query-a', 'A');
          await createPrompt('crud-query-b', 'B');

          const result = await callQueryPrompts({});

          expect(result.count).toBe(2);
          expect(result.hasMore).toBe(false);
          expect(result.results.map((x) => x.n).sort()).toEqual(['A', 'B']);
          expect(result.keys).toHaveLength(2);
        });

        it('should filter on state', async () => {
          const active = await createPrompt('crud-query-a', 'A');
          await createPrompt('crud-query-b', 'B');

          await callUpdatePrompt({ key: active.key, state: OpenRouterPromptState.ACTIVE });

          const result = await callQueryPrompts({ state: OpenRouterPromptState.ACTIVE });

          expect(result.count).toBe(1);
          expect(result.results[0].n).toBe('A');

          // The prompts that were left DRAFT are still reachable through the other side of the filter.
          const drafts = await callQueryPrompts({ state: OpenRouterPromptState.DRAFT });
          expect(drafts.count).toBe(1);
          expect(drafts.results[0].n).toBe('B');
        });

        it('should page with limit and cursorDocumentKey', async () => {
          await createPrompt('crud-query-a', 'A');
          await createPrompt('crud-query-b', 'B');
          await createPrompt('crud-query-c', 'C');

          const firstPage = await callQueryPrompts({ limit: 2 });

          expect(firstPage.count).toBe(2);
          expect(firstPage.hasMore).toBe(true);
          expect(firstPage.cursorDocumentKey).toBeDefined();

          const secondPage = await callQueryPrompts({ limit: 2, cursorDocumentKey: firstPage.cursorDocumentKey });

          expect(secondPage.count).toBe(1);
          expect(secondPage.hasMore).toBe(false);
          expect(secondPage.results.map((x) => x.n)).not.toContain(firstPage.results[0].n);
        });

        demoAuthorizedUserContext({ f }, (u) => {
          itShouldFail('with FORBIDDEN for a non-admin', async () => {
            await createPrompt();

            await expectFail(() => u.callWrappedFunction(demoCallModelWrappedFn, onCallQueryModelParams(openRouterPromptIdentity, {})), expectFailAssertHttpErrorServerErrorCode(FORBIDDEN_ERROR_CODE));
          });
        });
      });
    });
  });
});
