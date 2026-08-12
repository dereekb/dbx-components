import { type DemoDevelopmentSeedOpenRouterPromptsParams, type DemoDevelopmentSeedOpenRouterPromptsResult } from 'demo-firebase';
import { seedDemoOpenRouterPrompts } from '../../common/model/openrouter/openrouter.seed';
import { type DemoDevelopmentFunction } from '../function.context';

/**
 * Seeds the demo's OpenRouter prompts.
 *
 * A prompt lives in Firestore, so a fresh environment has none until something writes them. Exposed
 * through developer tools rather than a migration because it is idempotent and cheap, and because the
 * emulator starts empty on every run.
 */
export const seedOpenRouterPromptsDevelopmentFunction: DemoDevelopmentFunction<DemoDevelopmentSeedOpenRouterPromptsParams, DemoDevelopmentSeedOpenRouterPromptsResult> = async (request) => {
  const { nest } = request;
  return seedDemoOpenRouterPrompts({ openRouterPromptActions: nest.openRouterPromptActions, demoFirestoreCollections: nest.demoFirestoreCollections });
};
