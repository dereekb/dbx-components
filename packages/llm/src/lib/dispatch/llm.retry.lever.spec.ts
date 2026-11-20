/**
 * The RETRY LEVER LADDER — one case per ladder row, plus the availability rules that are the whole point of the
 * module: a rung that cannot change a sent byte is never taken, and the `'none'` it falls back to says why.
 *
 * Pure inputs, no dispatcher and no strategy — the ladder is a decision function, and this is where the decision
 * is pinned.
 */

import { describe, expect, it } from 'vitest';
import { applyLlmRetryLever, chooseLlmRetryLever, LLM_RETRY_REASONING_LOW_HEADROOM_FACTOR, type ChooseLlmRetryLeverConfig, type LlmRetryLever, type LlmRetryLeverKind } from './llm.retry.lever';
import type { LlmRequest } from '../strategy/llm.strategy';

/**
 * The baseline failed attempt: a 4 k budget well under the ceiling, reasoning OFF (the global floor), structured
 * output ON, and an escalation tier resolving to a DIFFERENT slug. Every case below moves one field off this.
 *
 * @param overrides - The fields this case changes.
 * @returns The chooser input.
 */
function input(overrides: Partial<ChooseLlmRetryLeverConfig> = {}): ChooseLlmRetryLeverConfig {
  return {
    cause: 'parse-error',
    lengthCapped: false,
    reasoningOnly: false,
    model: 'x/flash',
    escalateModel: 'x/pro',
    reasoningEnabled: false,
    reasoningSupported: true,
    structured: true,
    outputBudget: 4_096,
    budgetCeiling: 32_768,
    spent: new Set<LlmRetryLeverKind>(),
    ...overrides
  };
}

describe('chooseLlmRetryLever', () => {
  it('a LENGTH-CAPPED reply takes the budget rung first, whatever its failure class', () => {
    const lever = chooseLlmRetryLever(input({ cause: 'length-truncation', lengthCapped: true }));
    expect(lever).toMatchObject({ lever: 'budget', from: '4096', to: '16384' });
    // Even a parse-error the cap ended: the provider says it cut the reply off, so "unparseable" is a symptom.
    expect(chooseLlmRetryLever(input({ cause: 'parse-error', lengthCapped: true })).lever).toBe('budget');
  });

  it('a REASONING-ONLY empty reply turns reasoning OFF ahead of the budget, which would only buy more thinking', () => {
    const lever = chooseLlmRetryLever(input({ cause: 'empty-result', reasoningOnly: true, reasoningEnabled: true, lengthCapped: true }));
    expect(lever).toMatchObject({ lever: 'reasoning-off', from: 'on', to: 'off' });
  });

  it('a genuinely BLANK reply is a model problem first', () => {
    expect(chooseLlmRetryLever(input({ cause: 'empty-result' })).lever).toBe('model');
  });

  it('a PARSE-ERROR escalates the model, then drops strict structured output, then buys reasoning', () => {
    expect(chooseLlmRetryLever(input()).lever).toBe('model');
    expect(chooseLlmRetryLever(input({ spent: new Set<LlmRetryLeverKind>(['model']) })).lever).toBe('structured-off');
    expect(chooseLlmRetryLever(input({ spent: new Set<LlmRetryLeverKind>(['model', 'structured-off']) })).lever).toBe('reasoning-low');
  });

  it('a SCHEMA-VALIDATION miss buys a low reasoning band BEFORE it buys a different slug (the answer was wrong, not the model)', () => {
    const lever = chooseLlmRetryLever(input({ cause: 'schema-validation' }));
    expect(lever).toMatchObject({ lever: 'reasoning-low', from: 'off', to: 'low' });
    // …and a critique rejection is the same shape: a well-formed answer that was not good enough.
    expect(chooseLlmRetryLever(input({ cause: 'critique' })).lever).toBe('reasoning-low');
  });

  // THE RUNG BUYS ITS OWN ROOM. Reasoning tokens come out of `maxOutputTokens`, so raising the band at an
  // unchanged cap asks for LESS ANSWER than the attempt that just failed had: a re-ask can spend the whole 4096 on
  // reasoning and return an empty string.
  it('raises the completion cap as PART of the reasoning-low rung, and says so', () => {
    const lever = chooseLlmRetryLever(input({ cause: 'schema-validation' }));

    expect(lever.headroom).toBe(8_192);
    // Factor 2, not the `budget` rung's 4: 2× gives the reasoning its own 4096 and leaves 4096 for the answer.
    expect(lever.headroom).toBe(4_096 * LLM_RETRY_REASONING_LOW_HEADROOM_FACTOR);
    expect(lever.reason).toContain('the completion cap raised 4096 → 8192 so the thinking does not eat the answer');
    // The lever is still ONE lever — the doctrine is amended, not broken.
    expect(lever).toMatchObject({ lever: 'reasoning-low', from: 'off', to: 'low' });
  });

  it('CLAMPS the headroom to the ceiling, and omits it entirely once the budget is already there', () => {
    expect(chooseLlmRetryLever(input({ cause: 'schema-validation', outputBudget: 20_000 })).headroom).toBe(32_768);

    const atCeiling = chooseLlmRetryLever(input({ cause: 'schema-validation', outputBudget: 32_768 }));
    expect(atCeiling.lever).toBe('reasoning-low');
    expect('headroom' in atCeiling).toBe(false);
    expect(atCeiling.reason).not.toContain('completion cap raised');
  });

  it('a TIMEOUT moves reasoning off, or NOTHING: never the model (a client deadline says nothing about competence)', () => {
    expect(chooseLlmRetryLever(input({ cause: 'timeout', reasoningEnabled: true })).lever).toBe('reasoning-off');
    const none = chooseLlmRetryLever(input({ cause: 'timeout', reasoningEnabled: false }));
    expect(none.lever).toBe('none');
    expect(none.reason).toContain('reasoning is already off');
  });

  it('refuses the MODEL rung when the escalation tier resolves to the slug that just failed (the same-slug tier map)', () => {
    const lever = chooseLlmRetryLever(input({ escalateModel: 'x/flash' }));
    expect(lever.lever).toBe('structured-off'); // the next rung down, not a re-roll on the identical slug.
  });

  it('refuses the MODEL rung when no escalation tier resolves at all, and names that in the reason when nothing is left', () => {
    const lever = chooseLlmRetryLever(input({ cause: 'empty-result', escalateModel: undefined, reasoningSupported: false }));
    expect(lever.lever).toBe('none');
    expect(lever.reason).toContain('no decode-retry tier resolves');
    expect(lever.reason).toContain('the provider rejects reasoning params');
  });

  it('refuses the BUDGET rung at the ceiling, and clamps a raise that would overshoot it', () => {
    expect(chooseLlmRetryLever(input({ cause: 'length-truncation', lengthCapped: true, outputBudget: 16_384 })).to).toBe('32768');
    const capped = chooseLlmRetryLever(input({ cause: 'length-truncation', lengthCapped: true, outputBudget: 32_768 }));
    expect(capped.lever).toBe('model'); // the next rung down
    const exhausted = chooseLlmRetryLever(input({ cause: 'length-truncation', lengthCapped: true, outputBudget: 32_768, escalateModel: 'x/flash', structured: false }));
    expect(exhausted.lever).toBe('none');
    expect(exhausted.reason).toContain('ceiling');
  });

  it('never picks a spent rung twice, EXCEPT budget, whose every pick sends a larger number', () => {
    // A second `model` swap would re-ask the model already escalated to, so the ladder walks DOWN instead.
    expect(chooseLlmRetryLever(input({ spent: new Set<LlmRetryLeverKind>(['model']) })).lever).toBe('structured-off');
    // A second budget raise is not a repetition: 16384 is a different request than 4096.
    expect(chooseLlmRetryLever(input({ cause: 'length-truncation', lengthCapped: true, outputBudget: 16_384, spent: new Set<LlmRetryLeverKind>(['budget']) })).lever).toBe('budget');
  });

  it('takes NEITHER reasoning rung on a provider that rejects the param', () => {
    expect(chooseLlmRetryLever(input({ cause: 'schema-validation', reasoningSupported: false })).lever).toBe('model');
    expect(chooseLlmRetryLever(input({ cause: 'timeout', reasoningEnabled: true, reasoningSupported: false })).lever).toBe('none');
  });

  it('a `none` lever reports its from/to as unchanged, so a reader never mistakes it for a move', () => {
    const lever = chooseLlmRetryLever(input({ cause: 'timeout' }));
    expect(lever.from).toBe(lever.to);
  });
});

describe('applyLlmRetryLever', () => {
  const base: LlmRequest = { prompt: 'P', capability: 'summarize', meta: { requestId: 'r1' }, maxOutputTokens: 4_096, reasoning: { enabled: false }, responseSchemaHint: { type: 'object' } };

  it('moves exactly the one field its lever names', () => {
    expect(applyLlmRetryLever(base, { lever: 'budget', from: '4096', to: '16384', reason: '' }).maxOutputTokens).toBe(16_384);
    expect(applyLlmRetryLever(base, { lever: 'model', from: 'x/flash', to: 'x/pro', reason: '' }).model).toBe('x/pro');
    expect(applyLlmRetryLever(base, { lever: 'reasoning-low', from: 'off', to: 'low', reason: '' }).reasoning).toEqual({ enabled: true, effort: 'low' });
    expect(applyLlmRetryLever(base, { lever: 'reasoning-off', from: 'on', to: 'off', reason: '' }).reasoning).toEqual({ enabled: false });
  });

  it('applies the reasoning-low headroom to the cap, and leaves it alone when the rung carries none', () => {
    const raised = applyLlmRetryLever(base, { lever: 'reasoning-low', from: 'off', to: 'low', reason: '', headroom: 8_192 });
    expect(raised.reasoning).toEqual({ enabled: true, effort: 'low' });
    expect(raised.maxOutputTokens).toBe(8_192);
    // No headroom (the budget was already at the ceiling) ⇒ byte-identical to what the rung always did.
    expect(applyLlmRetryLever(base, { lever: 'reasoning-low', from: 'off', to: 'low', reason: '' }).maxOutputTokens).toBe(4_096);
  });

  it('DROPS the response-schema key rather than sending undefined, so the re-ask is an unconstrained dispatch', () => {
    const moved = applyLlmRetryLever(base, { lever: 'structured-off', from: 'strict', to: 'free', reason: '' });
    expect('responseSchemaHint' in moved).toBe(false);
  });

  it('is the IDENTITY for `none`: the transport lane provably resends the same request', () => {
    expect(applyLlmRetryLever(base, { lever: 'none', from: 'x/flash', to: 'x/flash', reason: '' })).toBe(base);
  });

  it("keeps the request's meta on every rung", () => {
    const levers: ReadonlyArray<LlmRetryLever> = [
      { lever: 'budget', from: '4096', to: '16384', reason: '' },
      { lever: 'model', from: 'x/flash', to: 'x/pro', reason: '' },
      { lever: 'reasoning-off', from: 'on', to: 'off', reason: '' },
      { lever: 'reasoning-low', from: 'off', to: 'low', reason: '', headroom: 8_192 },
      { lever: 'structured-off', from: 'strict', to: 'free', reason: '' },
      { lever: 'none', from: 'x/flash', to: 'x/flash', reason: '' }
    ];

    for (const lever of levers) {
      expect(applyLlmRetryLever(base, lever).meta).toBe(base.meta);
    }
  });
});
