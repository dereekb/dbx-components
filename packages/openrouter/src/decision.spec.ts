import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * Whether the SDK boundary module was evaluated. `openrouter.sdk.ts` is the only non-test module that
 * imports `@openrouter/sdk` (pinned below), so it being untouched means the SDK was never loaded.
 */
const probe = vi.hoisted(() => ({ sdkBoundaryLoaded: false }));

vi.mock('./lib/openrouter.sdk', () => {
  probe.sdkBoundaryLoaded = true;
  return {};
});

describe('@dereekb/openrouter/decision', () => {
  it('should load without evaluating the SDK', async () => {
    const entry = await import('./decision');

    expect(entry.openRouterDecisionRequestBody).toBeTypeOf('function');
    expect(entry.readOpenRouterDecisionAnswers).toBeTypeOf('function');
    expect(entry.openRouterChoiceQuestion).toBeTypeOf('function');
    expect(entry.isOpenRouterSystemOneModelId).toBeTypeOf('function');
    expect(probe.sdkBoundaryLoaded).toBe(false);
  });

  it('should not carry the transport', async () => {
    const entry: Record<string, unknown> = await import('./decision');

    expect(entry['openRouterDecision']).toBeUndefined();
    expect(entry['systemOneCreate']).toBeUndefined();
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
