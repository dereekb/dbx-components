import { type DemoDevelopmentSeedOpenRouterPromptsParams, type DemoDevelopmentSeedOpenRouterPromptsResult } from 'demo-firebase';
import { type DemoDevelopmentFunction } from '../function.context';

/**
 * Seeds the demo's OpenRouter prompts.
 *
 * A prompt lives in Firestore, so a fresh environment has none until something writes them. Exposed
 * through developer tools rather than a migration because it is idempotent and cheap, and because the
 * emulator starts empty on every run.
 *
 * The seed itself is package logic: the definitions the prompt service already resolves against carry
 * everything a stored prompt needs, so there is nothing demo-specific left to write here.
 *
 * @param request - The development function request.
 * @returns How many prompts the call published to the store.
 */
export const seedOpenRouterPromptsDevelopmentFunction: DemoDevelopmentFunction<DemoDevelopmentSeedOpenRouterPromptsParams, DemoDevelopmentSeedOpenRouterPromptsResult> = async (request) => {
  const { nest } = request;
  const result = await nest.openRouterPromptActions.seedOpenRouterPrompts({});

  return { promptsSynced: result.versionsPublished };
};
