import { describe, expect, it } from 'vitest';
import { firestoreModelKey } from '@dereekb/firebase';
import { firebaseServerActionsContext } from '@dereekb/firebase-server';
import { adminFirestoreFactory } from '@dereekb/firebase-server/test';
import { type Maybe } from '@dereekb/util';
import { type OpenRouterModelConfig, type OpenRouterPromptDefinition } from '@dereekb/openrouter';
import { type OpenRouterPrompt, type OpenRouterPromptVersion, OpenRouterPromptState, openRouterPromptFirestoreCollection, openRouterPromptIdentity, openRouterPromptVersionFirestoreCollectionFactory, openRouterPromptVersionFirestoreCollectionGroup, openRouterPromptVersionId } from '@dereekb/openrouter/firebase';
import { type OpenRouterPromptServerActions, openRouterPromptServerActions } from './openrouter.action.server';
import { openRouterPromptService } from './openrouter.prompt.service';

const TEST_PROMPT_KEY = 'seed-test-prompt';
const OTHER_PROMPT_KEY = 'seed-test-other-prompt';
const TEST_MODEL_CONFIG: OpenRouterModelConfig = { model: 'openai/gpt-5.1', provider: { only: ['openai'], allowFallbacks: false, requireParameters: true } };

/**
 * Builds a definition declaring a specific version.
 *
 * The declared number is the whole subject of these tests, so it is always passed explicitly rather
 * than defaulted.
 *
 * @param version - The version the definition declares.
 * @param overrides - Fields to replace on the definition.
 * @returns The definition.
 */
function definition(version: number, overrides?: Partial<OpenRouterPromptDefinition>): OpenRouterPromptDefinition {
  return {
    promptKey: TEST_PROMPT_KEY,
    version,
    name: 'Seed Test Prompt',
    description: 'Publishes at its declared version.',
    instructions: 'You are a test.',
    config: TEST_MODEL_CONFIG,
    ...overrides
  };
}

describe('seedOpenRouterPrompts() (firestore emulator)', () => {
  adminFirestoreFactory((f) => {
    function buildCollections() {
      const context = f.firestoreContext;

      return {
        openRouterPromptCollection: openRouterPromptFirestoreCollection(context),
        openRouterPromptVersionCollectionFactory: openRouterPromptVersionFirestoreCollectionFactory(context),
        openRouterPromptVersionCollectionGroup: openRouterPromptVersionFirestoreCollectionGroup(context)
      };
    }

    /**
     * Builds the actions over a prompt service carrying the given definitions.
     *
     * @param definitions - The registry the seed reads.
     * @returns The actions and the collections they write through.
     */
    function buildActions(definitions: OpenRouterPromptDefinition[]) {
      const collections = buildCollections();
      const promptService = openRouterPromptService({ collections, cacheDuration: 1, definitions });
      const actions: OpenRouterPromptServerActions = openRouterPromptServerActions({ ...firebaseServerActionsContext(), ...collections, firestoreContext: f.firestoreContext, openRouterPromptService: promptService });

      return { actions, collections, promptService };
    }

    /**
     * Reads a prompt document back.
     */
    async function readPrompt(collections: ReturnType<typeof buildCollections>, promptKey = TEST_PROMPT_KEY): Promise<Maybe<OpenRouterPrompt>> {
      return collections.openRouterPromptCollection.documentAccessor().loadDocumentForId(promptKey).snapshotData();
    }

    /**
     * Reads one version document back.
     */
    async function readVersion(collections: ReturnType<typeof buildCollections>, version: number, promptKey = TEST_PROMPT_KEY): Promise<Maybe<OpenRouterPromptVersion>> {
      const promptDocument = collections.openRouterPromptCollection.documentAccessor().loadDocumentForId(promptKey);
      return collections.openRouterPromptVersionCollectionFactory(promptDocument).documentAccessor().loadDocumentForId(openRouterPromptVersionId(version)).snapshotData();
    }

    describe('a prompt that does not exist yet', () => {
      it('should publish at the declared number without minting the versions below it', async () => {
        const { actions, collections } = buildActions([definition(3)]);
        const result = await actions.seedOpenRouterPrompts({});

        expect(result.considered).toBe(1);
        expect(result.promptsCreated).toBe(1);
        expect(result.versionsPublished).toBe(1);
        expect(result.upToDate).toBe(0);
        expect(result.skipped).toBe(0);

        const prompt = await readPrompt(collections);
        expect(prompt?.lv).toBe(3);
        expect(prompt?.av).toBe(3);
        expect(prompt?.s).toBe(OpenRouterPromptState.ACTIVE);
        expect(prompt?.n).toBe('Seed Test Prompt');

        const published = await readVersion(collections, 3);
        expect(published?.v).toBe(3);
        expect(published?.i).toBe('You are a test.');
        expect(published?.c).toEqual(TEST_MODEL_CONFIG);
        // The version the allocating create would have minted instead. Its absence is the entire point:
        // the store now sits AT the number the code declares rather than permanently below it.
        expect(await readVersion(collections, 1)).toBeUndefined();
      });

      it('should leave the published head unlocked, so it stays editable', async () => {
        const { actions, collections } = buildActions([definition(3)]);
        await actions.seedOpenRouterPrompts({});

        expect((await readVersion(collections, 3))?.lk).toBeFalsy();
      });
    });

    describe('a second run', () => {
      it('should report upToDate and write nothing', async () => {
        const { actions, collections } = buildActions([definition(3)]);
        await actions.seedOpenRouterPrompts({});

        const published = await readVersion(collections, 3);
        const second = await actions.seedOpenRouterPrompts({});

        expect(second.considered).toBe(1);
        expect(second.promptsCreated).toBe(0);
        expect(second.versionsPublished).toBe(0);
        expect(second.upToDate).toBe(1);
        expect(second.skipped).toBe(0);

        // Same document, untouched — a re-seed is a fixed point rather than a step toward convergence.
        const after = await readVersion(collections, 3);
        expect(after?.cat).toEqual(published?.cat);
        expect(await readVersion(collections, 4)).toBeUndefined();
      });

      it('should not revert an operator rename, even on a run that publishes', async () => {
        const { actions, collections } = buildActions([definition(3)]);
        await actions.seedOpenRouterPrompts({});

        const updateOpenRouterPrompt = await actions.updateOpenRouterPrompt({ key: firestoreModelKey(openRouterPromptIdentity, TEST_PROMPT_KEY), name: 'Renamed By An Operator', description: 'Edited at runtime.' });
        await updateOpenRouterPrompt(collections.openRouterPromptCollection.documentAccessor().loadDocumentForId(TEST_PROMPT_KEY));

        // The version moves, which is the run that actually touches the prompt document — the metadata
        // still has to survive it.
        const { actions: bumped } = buildActions([definition(5)]);
        const result = await bumped.seedOpenRouterPrompts({});
        expect(result.versionsPublished).toBe(1);

        const prompt = await readPrompt(collections);
        expect(prompt?.n).toBe('Renamed By An Operator');
        expect(prompt?.d).toBe('Edited at runtime.');
      });
    });

    describe('a definition that moves ahead of the store', () => {
      it('should lock the outgoing head and leave the new one editable', async () => {
        const { actions, collections } = buildActions([definition(3)]);
        await actions.seedOpenRouterPrompts({});

        const { actions: bumped } = buildActions([definition(5)]);
        const result = await bumped.seedOpenRouterPrompts({});

        expect(result.promptsCreated).toBe(0);
        expect(result.versionsPublished).toBe(1);
        expect(result.upToDate).toBe(0);

        expect((await readVersion(collections, 3))?.lk).toBe(true);
        expect((await readVersion(collections, 5))?.lk).toBeFalsy();

        const prompt = await readPrompt(collections);
        expect(prompt?.lv).toBe(5);
        expect(prompt?.av).toBe(5);
      });
    });

    describe('drift', () => {
      it('should refuse to write a definition the store has advanced past', async () => {
        const { actions, collections } = buildActions([definition(5)]);
        await actions.seedOpenRouterPrompts({});

        const { actions: behind } = buildActions([definition(3)]);
        const result = await behind.seedOpenRouterPrompts({});

        expect(result.considered).toBe(1);
        expect(result.versionsPublished).toBe(0);
        expect(result.upToDate).toBe(0);
        expect(result.skipped).toBe(1);

        // The store keeps serving what it had, and v5 is still the editable head.
        const prompt = await readPrompt(collections);
        expect(prompt?.lv).toBe(5);
        expect(prompt?.av).toBe(5);
        expect((await readVersion(collections, 5))?.lk).toBeFalsy();
        expect(await readVersion(collections, 3)).toBeUndefined();
      });

      it('should skip an ARCHIVED prompt rather than resurrect it', async () => {
        const { actions, collections } = buildActions([definition(3)]);
        await actions.seedOpenRouterPrompts({});

        const updateOpenRouterPrompt = await actions.updateOpenRouterPrompt({ key: firestoreModelKey(openRouterPromptIdentity, TEST_PROMPT_KEY), state: OpenRouterPromptState.ARCHIVED });
        await updateOpenRouterPrompt(collections.openRouterPromptCollection.documentAccessor().loadDocumentForId(TEST_PROMPT_KEY));

        const { actions: bumped } = buildActions([definition(5)]);
        const result = await bumped.seedOpenRouterPrompts({});

        expect(result.versionsPublished).toBe(0);
        expect(result.skipped).toBe(1);

        const prompt = await readPrompt(collections);
        expect(prompt?.s).toBe(OpenRouterPromptState.ARCHIVED);
        expect(prompt?.lv).toBe(3);
        expect(await readVersion(collections, 5)).toBeUndefined();
      });
    });

    describe('promptKeys', () => {
      it('should restrict the run to the named keys', async () => {
        const definitions = [definition(3), definition(2, { promptKey: OTHER_PROMPT_KEY, name: 'Other Prompt' })];
        const { actions, collections } = buildActions(definitions);

        const result = await actions.seedOpenRouterPrompts({ promptKeys: [OTHER_PROMPT_KEY] });

        expect(result.considered).toBe(1);
        expect(result.promptsCreated).toBe(1);
        expect(result.versionsPublished).toBe(1);

        expect(await readPrompt(collections, TEST_PROMPT_KEY)).toBeUndefined();
        expect((await readPrompt(collections, OTHER_PROMPT_KEY))?.lv).toBe(2);
      });

      it('should seed every definition when omitted', async () => {
        const definitions = [definition(3), definition(2, { promptKey: OTHER_PROMPT_KEY, name: 'Other Prompt' })];
        const { actions, collections } = buildActions(definitions);

        const result = await actions.seedOpenRouterPrompts({});

        expect(result.considered).toBe(2);
        expect(result.promptsCreated).toBe(2);
        expect(result.versionsPublished).toBe(2);

        expect((await readPrompt(collections, TEST_PROMPT_KEY))?.av).toBe(3);
        expect((await readPrompt(collections, OTHER_PROMPT_KEY))?.av).toBe(2);
      });
    });

    describe('validation', () => {
      it('should throw before writing anything when a definition names no model', async () => {
        const definitions = [definition(3), definition(2, { promptKey: OTHER_PROMPT_KEY, name: 'Other Prompt', config: {} as OpenRouterModelConfig })];
        const { actions, collections } = buildActions(definitions);

        await expect(actions.seedOpenRouterPrompts({})).rejects.toThrow(new RegExp(`Cannot seed OpenRouterPrompt "${OTHER_PROMPT_KEY}"`));

        // Including the VALID definition ahead of it: half-seeding a registry leaves a state no rerun
        // explains, so nothing is written at all.
        expect(await readPrompt(collections, TEST_PROMPT_KEY)).toBeUndefined();
        expect(await readPrompt(collections, OTHER_PROMPT_KEY)).toBeUndefined();
      });

      it('should throw on a definition whose declared version is not a positive integer', async () => {
        const { actions, collections } = buildActions([definition(0)]);

        await expect(actions.seedOpenRouterPrompts({})).rejects.toThrow(/declares version 0, which is not an integer/);
        expect(await readPrompt(collections)).toBeUndefined();
      });
    });
  });
});
