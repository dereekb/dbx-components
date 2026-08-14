import { firestoreModelKey } from '@dereekb/firebase';
import { type OpenRouterPromptVersionNumber } from '@dereekb/openrouter';
import { type OpenRouterPromptFirestoreCollections, openRouterPromptIdentity } from '@dereekb/openrouter/firebase';
import { type OpenRouterPromptServerActions } from '@dereekb/openrouter/firebase-server';
import { demoResumeCheckPromptDefinitionForEnv } from './openrouter.definitions';

/**
 * Context {@link seedDemoOpenRouterPrompts} needs.
 */
export interface SeedDemoOpenRouterPromptsContext {
  readonly openRouterPromptActions: OpenRouterPromptServerActions;
  readonly demoFirestoreCollections: OpenRouterPromptFirestoreCollections;
}

/**
 * Result of seeding.
 */
export interface SeedDemoOpenRouterPromptsResult {
  /**
   * Whether the prompt document was created by this call.
   */
  readonly created: boolean;
  /**
   * The version that is now active.
   */
  readonly version: OpenRouterPromptVersionNumber;
  /**
   * Any warnings the config validator raised on publish.
   */
  readonly warnings: string[];
}

/**
 * Seeds the demo's OpenRouter prompts.
 *
 * Optional now rather than required: {@link demoResumeCheckPromptDefinitionForEnv} is wired into the
 * prompt service, so an unseeded environment already serves these prompts from code. Seeding is what
 * moves a prompt into the store, where it can be edited at runtime instead of by deploy.
 *
 * Idempotent: an existing prompt is reused, and a version is published only when the prompt has no
 * active one. Minting a version locks the one before it, so re-seeding must not mint a new one on every
 * call — that would leave the prompt with an ever-growing history of identical versions.
 *
 * Publishes from the same definitions the service resolves against, so the stored version cannot drift
 * from the code that would otherwise stand in for it.
 *
 * @param context - The prompt actions and the prompt collections.
 * @returns What the seed did.
 */
export async function seedDemoOpenRouterPrompts(context: SeedDemoOpenRouterPromptsContext): Promise<SeedDemoOpenRouterPromptsResult> {
  const { openRouterPromptActions, demoFirestoreCollections } = context;
  const definition = demoResumeCheckPromptDefinitionForEnv();
  const promptDocument = demoFirestoreCollections.openRouterPromptCollection.documentAccessor().loadDocumentForId(definition.promptKey);
  const existing = await promptDocument.snapshotData();
  const created = existing == null;

  if (created) {
    await openRouterPromptActions.createOpenRouterPrompt({ key: definition.promptKey, name: definition.name, description: definition.description });
  }

  const activeVersion = (await promptDocument.snapshotData())?.av;

  let version: OpenRouterPromptVersionNumber;
  let warnings: string[] = [];

  if (activeVersion == null) {
    const createVersion = await openRouterPromptActions.createOpenRouterPromptVersion({
      prompt: firestoreModelKey(openRouterPromptIdentity, definition.promptKey),
      instructions: definition.instructions,
      config: definition.config as Record<string, unknown>,
      notes: 'Seeded by seedDemoOpenRouterPrompts().',
      activate: true
    });

    const result = await createVersion(promptDocument);
    version = result.version;
    warnings = result.warnings;
  } else {
    version = activeVersion;
  }

  return { created, version, warnings };
}
