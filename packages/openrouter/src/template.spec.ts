import { describe, expect, it, vi } from 'vitest';

/**
 * Whether the SDK boundary module was evaluated. See decision.spec.ts.
 */
const probe = vi.hoisted(() => ({ sdkBoundaryLoaded: false }));

vi.mock('./lib/openrouter.sdk', () => {
  probe.sdkBoundaryLoaded = true;
  return {};
});

describe('@dereekb/openrouter/template', () => {
  it('should load without evaluating the SDK', async () => {
    const entry = await import('./template');

    expect(entry.validateOpenRouterTemplateScript).toBeTypeOf('function');
    expect(entry.compileOpenRouterTemplateScript).toBeTypeOf('function');
    expect(entry.openRouterTemplateContext).toBeTypeOf('function');
    expect(entry.checkOpenRouterTemplateOutputText).toBeTypeOf('function');
    expect(entry.openRouterTemplateReviewPromptDefinition).toBeTypeOf('function');
    expect(probe.sdkBoundaryLoaded).toBe(false);
  });
});
