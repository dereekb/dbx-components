import { type OpenRouterPromptDefinition } from '@dereekb/openrouter';
import { DEMO_RESUME_CHECK_DEFAULT_MODEL_ID, DEMO_SUPPORT_TRIAGE_DEFAULT_MODEL_ID, demoResumeCheckPromptDefinition, demoSupportTriagePromptDefinition } from 'demo-firebase';

/**
 * The demo's resume-check prompt definition, with the model id taken from the environment.
 *
 * The model id comes from `OPENROUTER_TEST_MODEL_ID` when set, which is the same knob the openrouter
 * package's own live specs read. It is read HERE rather than in demo-firebase because that component is
 * shared with the browser build.
 *
 * @returns The definition.
 */
export function demoResumeCheckPromptDefinitionForEnv(): OpenRouterPromptDefinition {
  const modelId = process.env['OPENROUTER_TEST_MODEL_ID'] ?? DEMO_RESUME_CHECK_DEFAULT_MODEL_ID;
  return demoResumeCheckPromptDefinition(modelId);
}

/**
 * The demo's support-triage DECISION definition, with the model id taken from the environment.
 *
 * Its own env knob rather than sharing `OPENROUTER_TEST_MODEL_ID`, because the two arms cannot take the
 * same value: a System One slug here and a chat slug there, and each is refused on the other's arm.
 *
 * @returns The definition.
 */
export function demoSupportTriagePromptDefinitionForEnv(): OpenRouterPromptDefinition {
  const modelId = process.env['OPENROUTER_TEST_DECISION_MODEL_ID'] ?? DEMO_SUPPORT_TRIAGE_DEFAULT_MODEL_ID;
  return demoSupportTriagePromptDefinition(modelId);
}

/**
 * The demo's code-defined OpenRouter prompts.
 *
 * Passed to the prompt service so the app can serve its prompts before anything has been seeded, and
 * read by the seeder so seeding publishes these exact values rather than a second copy of them.
 *
 * @returns The prompt definitions.
 */
export function demoOpenRouterPromptDefinitions(): OpenRouterPromptDefinition[] {
  return [demoResumeCheckPromptDefinitionForEnv(), demoSupportTriagePromptDefinitionForEnv()];
}
