import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { itShouldLoadWithoutEvaluating } from '@dereekb/util/test';
import * as entry from './template';

/**
 * The SDK boundary module (see decision.spec.ts).
 */
const SDK_BOUNDARY_MODULE = join(import.meta.dirname, 'lib', 'openrouter.sdk.ts');

describe('@dereekb/openrouter/template', () => {
  // not arktype: the template context loads and runs it on purpose
  itShouldLoadWithoutEvaluating({
    title: 'should load without evaluating the SDK or the @dereekb/llm root',
    modules: [SDK_BOUNDARY_MODULE, '@dereekb/llm'],
    load: () => import('./template')
  });

  it('should export the template helpers', () => {
    expect(entry.validateOpenRouterTemplateScript).toBeTypeOf('function');
    expect(entry.compileOpenRouterTemplateScript).toBeTypeOf('function');
    expect(entry.openRouterTemplateContext).toBeTypeOf('function');
    expect(entry.checkOpenRouterTemplateOutputText).toBeTypeOf('function');
    expect(entry.openRouterTemplateReviewPromptDefinition).toBeTypeOf('function');
  });
});
