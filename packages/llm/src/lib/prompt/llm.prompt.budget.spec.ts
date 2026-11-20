import { describe, expect, it } from 'vitest';
import { budgetLlmLiveContextBlocks, DEFAULT_LLM_PROMPT_TOKEN_BUDGET, estimateLlmRequestPromptTokens, estimateLlmTokens, toLlmBudgetTrimSummary, LLM_ESTIMATE_MESSAGE_ENVELOPE_TOKENS, LLM_PROMPT_PREFIX_RESERVE_TOKENS, type LlmBudgetedBlock, type LlmBudgetTrimReport } from './llm.prompt.budget';

// The deterministic shrink-then-drop live-context budget. Pure: hand-built blocks exercise the under-budget
// passthrough, the ascending-priority trim order, the required-never-trimmed guard, and shrink → drop.

const block = (text: string, priority: number, extra?: Partial<LlmBudgetedBlock>): LlmBudgetedBlock => ({ text, priority, ...extra });

describe('estimateLlmTokens()', () => {
  it('is ceil(len / 4)', () => {
    expect(estimateLlmTokens('')).toBe(0);
    expect(estimateLlmTokens('abcd')).toBe(1);
    expect(estimateLlmTokens('abcde')).toBe(2);
  });
});

describe('budgetLlmLiveContextBlocks(); budgeting', () => {
  it('under budget ⇒ every block, joined in render order, no trims', () => {
    const result = budgetLlmLiveContextBlocks({ blocks: [block('alpha', 1), block('beta', 2)], budget: 1000 });
    expect(result.liveContext).toBe('alpha\n\nbeta');
    expect(result.trimmed).toEqual([]);
  });

  it('drops the LOWEST-priority block first when over budget', () => {
    const big = 'x'.repeat(400); // ~100 tokens
    // The budget fits only one big block; the lower-priority one drops.
    const result = budgetLlmLiveContextBlocks({ blocks: [block(big, 5), block(big, 1)], budget: 105 });
    expect(result.liveContext).toBe(big);
    expect(result.trimmed).toHaveLength(1);
    expect(result.trimmed[0]).toMatchObject({ priority: 1, action: 'dropped' });
  });

  it('shrinks before dropping when a smaller variant exists', () => {
    const big = 'x'.repeat(400);
    const small = 'x'.repeat(20);
    const result = budgetLlmLiveContextBlocks({ blocks: [block('keep', 9, { required: true }), block(big, 1, { shrink: [small] })], budget: 20 });
    expect(result.liveContext).toBe(`keep\n\n${small}`);
    expect(result.trimmed[0]).toMatchObject({ priority: 1, action: 'shrunk' });
  });

  it('never trims a required block, even when that overflows the budget (send anyway)', () => {
    const big = 'x'.repeat(4000);
    const result = budgetLlmLiveContextBlocks({ blocks: [block(big, 1, { required: true }), block('extra', 2)], budget: 10 });
    expect(result.liveContext.startsWith(big)).toBe(true);
    expect(result.trimmed.some((t) => t.action === 'dropped' && t.priority === 2)).toBe(true);
  });

  it('reserves the static-prefix estimate against the budget', () => {
    const body = 'x'.repeat(40); // ~10 tokens
    const result = budgetLlmLiveContextBlocks({ blocks: [block(body, 1)], budget: 12, reservedPrefixTokens: 8 });
    expect(result.liveContext).toBe('');
    expect(result.trimmed[0]).toMatchObject({ action: 'dropped' });
  });

  it('defaults to the 12k budget', () => {
    expect(DEFAULT_LLM_PROMPT_TOKEN_BUDGET).toBe(12_000);
    const result = budgetLlmLiveContextBlocks({ blocks: [block('small', 1)] });
    expect(result.liveContext).toBe('small');
    expect(result.trimmed).toEqual([]);
  });
});

// Which blocks SURVIVE, what they are keyed by, and that a dropped / empty one is gone rather than joined as a blank
// line (an interior empty block injects a stray `\n\n`, which would land in the sent bytes).
describe('budgetLlmLiveContextBlocks(); blocks', () => {
  it('under budget ⇒ every non-empty block survives, keyed by its own key', () => {
    const result = budgetLlmLiveContextBlocks({ blocks: [block('alpha', 1, { key: 'subject' }), block('beta', 2, { key: 'members' })], budget: 1000 });
    expect(result.blocks.map((entry) => entry.key)).toEqual(['subject', 'members']);
    expect(result.blocks.map((entry) => entry.text)).toEqual(['alpha', 'beta']);
    expect(result.liveContext).toBe('alpha\n\nbeta');
    expect(result.trimmed).toEqual([]);
  });

  it('keys an unkeyed block by its render POSITION', () => {
    const result = budgetLlmLiveContextBlocks({ blocks: [block('alpha', 1), block('beta', 2)], budget: 1000 });
    expect(result.blocks.map((entry) => entry.key)).toEqual(['block-0', 'block-1']);
  });

  it('keys by the ORIGINAL index even after an earlier block is removed', () => {
    const result = budgetLlmLiveContextBlocks({ blocks: [block('', 1), block('beta', 2)], budget: 1000 });
    expect(result.blocks.map((entry) => entry.key)).toEqual(['block-1']);
  });

  it('DROPS an empty block rather than joining it', () => {
    const result = budgetLlmLiveContextBlocks({ blocks: [block('alpha', 1, { key: 'subject' }), block('', 2, { key: 'members' }), block('gamma', 3, { key: 'history' })], budget: 1000 });
    expect(result.blocks.map((entry) => entry.key)).toEqual(['subject', 'history']);
    expect(result.liveContext).toBe('alpha\n\ngamma');
  });

  it('a dropped block is absent from the survivors, and the trim report still names it', () => {
    const big = 'x'.repeat(400);
    const result = budgetLlmLiveContextBlocks({ blocks: [block(big, 5, { key: 'keep' }), block(big, 1, { key: 'drop' })], budget: 105 });
    expect(result.blocks.map((entry) => entry.key)).toEqual(['keep']);
    expect(result.trimmed).toHaveLength(1);
    expect(result.trimmed[0]).toMatchObject({ priority: 1, action: 'dropped' });
  });

  it('a SHRUNK block survives carrying its current variant text and a reason naming the shrink', () => {
    const big = 'x'.repeat(400);
    const small = 'x'.repeat(20);
    const result = budgetLlmLiveContextBlocks({ blocks: [block('keep', 9, { key: 'keep', required: true }), block(big, 1, { key: 'history', shrink: [small], reason: 'the recent history' })], budget: 20 });
    const history = result.blocks.find((entry) => entry.key === 'history');
    expect(history?.text).toBe(small);
    expect(history?.reason).toBe('shrunk to variant 1 under the 20-token live-context budget');
  });

  it('an un-shrunk block keeps its authored reason', () => {
    const result = budgetLlmLiveContextBlocks({ blocks: [block('alpha', 1, { key: 'subject', reason: 'the subject brief' })], budget: 1000 });
    expect(result.blocks[0]?.reason).toBe('the subject brief');
  });

  it('carries a block’s volatile declaration through to the survivors', () => {
    const result = budgetLlmLiveContextBlocks({ blocks: [block('alpha', 1, { key: 'heading', volatile: false }), block('beta', 2, { key: 'history', volatile: true }), block('gamma', 3, { key: 'options' })], budget: 1000 });
    expect(result.blocks.map((entry) => entry.volatile)).toEqual([false, true, undefined]);
  });

  it('carries it through a SHRINK too', () => {
    const big = 'x'.repeat(400);
    const small = 'x'.repeat(20);
    const result = budgetLlmLiveContextBlocks({ blocks: [block('keep', 9, { key: 'keep', required: true }), block(big, 1, { key: 'history', shrink: [small], volatile: false })], budget: 20 });
    expect(result.blocks.find((entry) => entry.key === 'history')?.volatile).toBe(false);
  });

  // What a block COSTS and how OFTEN it changes are different questions: trimming ranks on `priority` alone.
  it('does NOT let the declaration change what gets trimmed', () => {
    const big = 'x'.repeat(400);
    const config = (volatile: boolean) => ({ blocks: [block(big, 5, { key: 'keep', volatile }), block(big, 1, { key: 'drop', volatile })], budget: 105 });
    expect(budgetLlmLiveContextBlocks(config(false)).blocks.map((entry) => entry.key)).toEqual(['keep']);
    expect(budgetLlmLiveContextBlocks(config(true)).blocks.map((entry) => entry.key)).toEqual(['keep']);
  });
});

describe('toLlmBudgetTrimSummary()', () => {
  const trim = (action: LlmBudgetTrimReport['action'], savedTokens: number, priority = 1): LlmBudgetTrimReport => ({ priority, action, savedTokens });

  it('folds the report into flat counts', () => {
    expect(toLlmBudgetTrimSummary([trim('dropped', 100), trim('shrunk', 40), trim('shrunk', 20, 2)])).toEqual({ blocks: 3, dropped: 1, shrunk: 2, savedTokens: 160 });
  });

  it('sums an empty report to zeros', () => {
    expect(toLlmBudgetTrimSummary([])).toEqual({ blocks: 0, dropped: 0, shrunk: 0, savedTokens: 0 });
  });
});

describe('estimateLlmRequestPromptTokens()', () => {
  it('counts the response schema, which is billed and lives outside the prompt', () => {
    const prompt = 'x'.repeat(4000);
    const schema = { type: 'object', properties: { line: { type: 'string' } }, required: ['line'], additionalProperties: false };
    const bare = estimateLlmRequestPromptTokens({ prompt });
    const withSchema = estimateLlmRequestPromptTokens({ prompt, responseSchemaHint: schema });

    expect(bare).toBe(1000 + LLM_ESTIMATE_MESSAGE_ENVELOPE_TOKENS);
    expect(withSchema - bare).toBe(estimateLlmTokens(JSON.stringify(schema)));
    expect(withSchema - bare).toBe(27);
  });

  it('counts a chained turn as the WHOLE conversation the provider re-reads', () => {
    const prompt = 'the correction';
    const thread = [{ content: 'y'.repeat(8000) }, { content: 'z'.repeat(2000) }];
    const alone = estimateLlmRequestPromptTokens({ prompt });
    const chained = estimateLlmRequestPromptTokens({ prompt, thread });

    expect(chained - alone).toBe(2508);
    expect(chained).toBe(2516);
  });

  it('is the bare estimate plus one envelope for a request that sends no schema and no thread', () => {
    expect(estimateLlmRequestPromptTokens({ prompt: 'say one line' })).toBe(7);
  });
});

describe('LLM_PROMPT_PREFIX_RESERVE_TOKENS', () => {
  it('is 2,000', () => {
    expect(LLM_PROMPT_PREFIX_RESERVE_TOKENS).toBe(2_000);
  });

  it('is subtracted from the budget the blocks are fitted against', () => {
    const blocks = [block('x'.repeat(4000), 1)];
    expect(budgetLlmLiveContextBlocks({ blocks, budget: 1200 }).trimmed).toEqual([]);
    expect(budgetLlmLiveContextBlocks({ blocks, budget: 1200, reservedPrefixTokens: 400 }).trimmed).toHaveLength(1);
  });
});
