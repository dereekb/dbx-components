/* eslint-disable @typescript-eslint/no-deprecated -- this spec pins the deprecated @dereekb/openrouter decision aliases */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { itShouldLoadWithoutEvaluating } from '@dereekb/util/test';
import * as entry from './decision';

/**
 * The SDK boundary module. `openrouter.sdk.ts` is the only non-test module that imports `@openrouter/sdk` (pinned
 * below), so it staying unevaluated means the SDK was never loaded.
 */
const SDK_BOUNDARY_MODULE = join(import.meta.dirname, 'lib', 'openrouter.sdk.ts');

describe('@dereekb/openrouter/decision', () => {
  const exported: Record<string, unknown> = entry;

  itShouldLoadWithoutEvaluating({
    title: 'should load without evaluating the SDK, the @dereekb/llm root or arktype',
    modules: [SDK_BOUNDARY_MODULE, '@dereekb/llm', 'arktype'],
    load: () => import('./decision')
  });

  it('should export the decision helpers', () => {
    expect(entry.openRouterDecisionRequestBody).toBeTypeOf('function');
    expect(entry.readOpenRouterDecisionAnswers).toBeTypeOf('function');
    expect(entry.openRouterChoiceQuestion).toBeTypeOf('function');
    expect(entry.isOpenRouterSystemOneModelId).toBeTypeOf('function');
  });

  it('should not carry the transport', () => {
    expect(exported['openRouterDecision']).toBeUndefined();
    expect(exported['systemOneCreate']).toBeUndefined();
  });

  it('should not re-export the @dereekb/llm names', () => {
    // The entry carries the deprecated aliases only; the new names are imported from @dereekb/llm/decision.
    expect(exported['llmChoiceQuestion']).toBeUndefined();
    expect(exported['readLlmDecisionAnswers']).toBeUndefined();
    expect(exported['LlmDecisionAnswerFaultError']).toBeUndefined();
  });

  it('should keep openrouter.sdk.ts the only module importing @openrouter/sdk', () => {
    // The load probe above guards the boundary module, so it only proves "no SDK" while every SDK import
    // goes through that boundary.
    const libDir = join(import.meta.dirname, 'lib');
    const importers = readdirSync(libDir)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
      .filter((file) => /from '@openrouter\/sdk|import\('@openrouter\/sdk/.test(readFileSync(join(libDir, file), 'utf8')));

    expect(importers).toEqual(['openrouter.sdk.ts']);
  });
});
