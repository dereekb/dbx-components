import { describe, expect, it } from 'vitest';
import { itShouldLoadWithoutEvaluating } from '@dereekb/util/test';
import * as root from './index';
import * as decisionEntry from './decision';
import * as craftEntry from './craft';

/**
 * The runtime half of the boundaries of `@dereekb/llm`, `@dereekb/llm/decision` and `@dereekb/llm/craft` (all compile
 * from this `src`): loading them evaluates no SDK, the decision lane is one copy, and craft ships only from `/craft`.
 *
 * The static half is lint (`llmEntryBoundaryConfig` in `../eslint.config.mjs`). The entries are imported statically
 * above, so the export-surface checks pay no cold import inside a test's time budget.
 */
describe('@dereekb/llm entries', () => {
  itShouldLoadWithoutEvaluating({
    title: 'should load the root, /decision and /craft entries without evaluating an SDK',
    modules: ['openai', '@openrouter/sdk'],
    load: async () => {
      await import('./index');
      await import('./decision');
      await import('./craft');
    }
  });

  it('should serve the decision lane from the root and /decision entries as one copy', () => {
    expect(decisionEntry.LlmDecisionAnswerFaultError).toBe(root.LlmDecisionAnswerFaultError);
    expect(decisionEntry.LlmDecisionDeclarationError).toBe(root.LlmDecisionDeclarationError);
    expect(decisionEntry.llmChoiceQuestion).toBe(root.llmChoiceQuestion);
    expect(Object.keys(decisionEntry).length).toBeGreaterThan(0);
    expect(Object.keys(root)).toEqual(expect.arrayContaining(Object.keys(decisionEntry)));
  });

  it('should ship craft only from /craft', () => {
    expect(Object.keys(root).filter((name) => name in craftEntry)).toEqual([]);
    expect(craftEntry.makeLlmCraftPromptContributor).toBeTypeOf('function');
    expect(craftEntry.makeLlmCraftJudge).toBeTypeOf('function');
    expect(craftEntry.makeLlmCraftSiteRegistry).toBeTypeOf('function');
  });
});
