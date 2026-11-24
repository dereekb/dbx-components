import { describe } from 'vitest';
import { itShouldLoadWithoutEvaluating } from '@dereekb/util/test';

/**
 * The runtime half of the `@dereekb/llm/test` entry boundary: loading the entry evaluates no SDK.
 *
 * The static half is lint (`llmEntryBoundaryConfig` in `../eslint.config.mjs`).
 */
describe('@dereekb/llm/test entry', () => {
  itShouldLoadWithoutEvaluating({ modules: ['openai', '@openrouter/sdk'], load: () => import('./index') });
});
