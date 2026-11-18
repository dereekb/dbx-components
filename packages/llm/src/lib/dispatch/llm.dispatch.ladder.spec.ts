import { describe, expect, it } from 'vitest';
import { makeLlmCallContext } from '../record/llm.call.context';
import { type LlmDispatchResult, type LlmRequest } from '../strategy/llm.strategy';
import { llmDecodeRetryModelOf, makeLlmDispatchRetryLadder } from './llm.dispatch.ladder';

const FAILED: LlmDispatchResult = { text: 'prose', strategyId: 's', capability: 'c', finishReason: 'stop' };
const CAPPED: LlmDispatchResult = { text: '{"a":', strategyId: 's', capability: 'c', finishReason: 'length' };

function ladderOf(baseRequest: LlmRequest = { capability: 'c', prompt: 'p' }, escalateModel?: string) {
  const callContext = makeLlmCallContext({ label: 'c', timing: true });
  const ladder = makeLlmDispatchRetryLadder({ capability: 'c', baseRequest, baseOutputBudget: 1024, resolvedModel: 'm/fast', escalateModel, reasoningSupported: true, callContext });
  const diags = () => callContext.profile().diags ?? [];
  return { ladder, diags };
}

describe('llmDecodeRetryModelOf()', () => {
  const modelTiers = { fast: 'm/fast', strong: { model: 'm/strong' } };

  it('should resolve off, explicit and implicit tiers', () => {
    expect(llmDecodeRetryModelOf({ modelTiers, decodeRetryTier: 'off' })).toBeUndefined();
    expect(llmDecodeRetryModelOf({ modelTiers, decodeRetryTier: 'fast' })).toBe('m/fast');
    expect(llmDecodeRetryModelOf({ modelTiers })).toBe('m/strong');
    expect(llmDecodeRetryModelOf({ modelTiers: { fast: 'm/fast' } })).toBeUndefined();
  });

  it('should fail loud on an explicit typo', () => {
    expect(() => llmDecodeRetryModelOf({ modelTiers, decodeRetryTier: 'strnog' })).toThrow();
  });
});

describe('makeLlmDispatchRetryLadder()', () => {
  it('should take the budget rung on a truncation, persist the raise and file its breadcrumbs', () => {
    const { ladder, diags } = ladderOf();
    const lever = ladder.take({ cause: 'length-truncation', failed: CAPPED, attempt: 1 });

    expect(lever).toMatchObject({ lever: 'budget', from: '1024', to: '4096' });
    expect(ladder.apply({ capability: 'c', prompt: 'p2' })).toEqual({ capability: 'c', prompt: 'p2', maxOutputTokens: 4096 });
    expect(diags().map((diag) => diag.code)).toEqual(['output-budget-raise', 'retry-lever']);
    expect(diags()[1]).toMatchObject({ fields: { attempt: 2, cause: 'length-truncation', lever: 'budget' }, message: 'retry moves the budget lever' });
    expect(ladder.take({ cause: 'length-truncation', failed: CAPPED, attempt: 2 })).toMatchObject({ lever: 'budget', from: '4096', to: '16384' });
  });

  it('should escalate the model with a decode-escalate breadcrumb, then walk down the ladder', () => {
    const { ladder, diags } = ladderOf(undefined, 'm/strong');

    expect(ladder.take({ cause: 'parse-error', failed: FAILED, attempt: 1 })).toMatchObject({ lever: 'model', to: 'm/strong' });
    expect(diags()[0]).toMatchObject({ code: 'decode-escalate', fields: { attempt: 2, model: 'm/strong' } });
    expect(ladder.take({ cause: 'parse-error', failed: FAILED, attempt: 2 }).lever).not.toBe('model');
  });

  it('should raise the budget with reasoning-low headroom, and drop the schema with structured-off', () => {
    const { ladder } = ladderOf({ capability: 'c', prompt: 'p', responseSchemaHint: { type: 'object' } });
    const low = ladder.take({ cause: 'schema-validation', failed: FAILED, attempt: 1 });

    expect(low).toMatchObject({ lever: 'reasoning-low', headroom: 2048 });
    expect(ladder.pending()).toEqual({ lever: 'reasoning-low', from: 'off', to: 'low', cause: 'schema-validation', headroom: 2048 });

    const next = ladder.take({ cause: 'schema-validation', failed: FAILED, attempt: 2 });
    const applied = ladder.apply({ capability: 'c', prompt: 'p', responseSchemaHint: { type: 'object' } });

    expect(applied).toMatchObject({ reasoning: { enabled: true, effort: 'low' }, maxOutputTokens: 2048 });
    expect(next.lever === 'structured-off' ? applied.responseSchemaHint : undefined).toBeUndefined();
  });

  it('should read and clear the pending decision', () => {
    const { ladder } = ladderOf();

    expect(ladder.pending()).toBeUndefined();
    ladder.take({ cause: 'transport', failed: FAILED, attempt: 1 });
    expect(ladder.takePending()).toMatchObject({ lever: 'none', cause: 'transport' });
    expect(ladder.pending()).toBeUndefined();
    expect(ladder.apply({ capability: 'c', prompt: 'p' })).toEqual({ capability: 'c', prompt: 'p' });
  });

  it('should grant the bonus lever with its stamps', () => {
    const { ladder, diags } = ladderOf({ capability: 'c', prompt: 'p', reasoning: { enabled: true, effort: 'low' } });
    const lever = ladder.takeBonus({ cause: 'empty-result', attempt: 2 });

    expect(lever).toMatchObject({ lever: 'reasoning-off', from: 'low', to: 'off', induced: 'reasoning-low' });
    expect(ladder.pending()).toEqual({ lever: 'reasoning-off', from: 'low', to: 'off', cause: 'empty-result', bonus: true, induced: 'reasoning-low' });
    expect(ladder.apply({ capability: 'c', prompt: 'p' }).reasoning).toEqual({ enabled: false });
    expect(diags()[0]).toMatchObject({ code: 'retry-lever', fields: { attempt: 3, bonus: true, induced: 'reasoning-low' } });
  });
});
