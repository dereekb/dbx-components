import { firestoreModelKey } from '@dereekb/firebase';
import { type OpenRouterPromptVersionNumber } from '@dereekb/openrouter';
import { type OpenRouterPromptFirestoreCollections, openRouterPromptIdentity } from '@dereekb/openrouter/firebase';
import { type OpenRouterPromptServerActions } from '@dereekb/openrouter/firebase-server';
import { DEMO_RESUME_CHECK_DEFAULT_MODEL_ID, DEMO_RESUME_CHECK_INSTRUCTIONS, DEMO_RESUME_CHECK_PROMPT_KEY, DEMO_RESUME_CHECK_PROMPT_NAME, demoResumeCheckPromptConfig } from 'demo-firebase';

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
 * Idempotent: an existing prompt is reused, and a version is published only when the prompt has no
 * active one. A version is immutable once published, so re-seeding must not mint a new one on every
 * call — that would leave a run pinned at enqueue time pointing at an ever-growing history of
 * identical versions.
 *
 * The model id comes from `OPENROUTER_TEST_MODEL_ID` when set, which is the same knob the openrouter
 * package's own live specs read. It is read HERE rather than in demo-firebase because that component
 * is shared with the browser build.
 *
 * @param context - The prompt actions and the prompt collections.
 * @returns What the seed did.
 */
export async function seedDemoOpenRouterPrompts(context: SeedDemoOpenRouterPromptsContext): Promise<SeedDemoOpenRouterPromptsResult> {
  const { openRouterPromptActions, demoFirestoreCollections } = context;
  const promptDocument = demoFirestoreCollections.openRouterPromptCollection.documentAccessor().loadDocumentForId(DEMO_RESUME_CHECK_PROMPT_KEY);
  const existing = await promptDocument.snapshotData();
  const created = existing == null;

  if (created) {
    await openRouterPromptActions.createOpenRouterPrompt({ key: DEMO_RESUME_CHECK_PROMPT_KEY, name: DEMO_RESUME_CHECK_PROMPT_NAME, description: 'Decides whether an attached document is a resume.' });
  }

  const modelId = process.env['OPENROUTER_TEST_MODEL_ID'] ?? DEMO_RESUME_CHECK_DEFAULT_MODEL_ID;
  const activeVersion = (await promptDocument.snapshotData())?.av;

  let version: OpenRouterPromptVersionNumber;
  let warnings: string[] = [];

  if (activeVersion == null) {
    const publish = await openRouterPromptActions.publishOpenRouterPromptVersion({
      key: firestoreModelKey(openRouterPromptIdentity, DEMO_RESUME_CHECK_PROMPT_KEY),
      instructions: DEMO_RESUME_CHECK_INSTRUCTIONS,
      config: demoResumeCheckPromptConfig(modelId) as Record<string, unknown>,
      notes: 'Seeded by seedDemoOpenRouterPrompts().',
      activate: true
    });

    const result = await publish(promptDocument);
    version = result.version;
    warnings = result.warnings;
  } else {
    version = activeVersion;
  }

  return { created, version, warnings };
}
