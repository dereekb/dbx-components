import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { type LlmRequest } from '@dereekb/llm';
import { hashLlmTapePrompt, isLlmTapeStrategyError, LLM_TAPE_STRATEGY_ID, LlmTapeStrategyError, type LlmTapeTurn, llmTapeTurnOf, makeLlmTapeStrategy } from './llm.test.tape';

/**
 * Build a request for a capability + prompt (the two halves of the tape match key).
 *
 * @param capability - The capability the request resolves.
 * @param prompt - The assembled prompt.
 * @returns The request.
 */
function requestOf(capability: string, prompt: string): LlmRequest {
  return { capability, prompt };
}

/**
 * Build a tape turn whose `promptSha` is the default digest of the given prompt — the shape a host's tape reader
 * produces.
 *
 * @param capability - The recorded capability.
 * @param prompt - The recorded prompt.
 * @param text - The recorded completion.
 * @returns The turn.
 */
function turnOf(capability: string, prompt: string, text: string): LlmTapeTurn {
  return { capability, promptSha: hashLlmTapePrompt(prompt), text };
}

describe('hashLlmTapePrompt()', () => {
  const nodeDigestOf = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 12);

  it('should equal the node:crypto digest, so tapes recorded either way still match by hash', () => {
    for (const text of ['', 'PROMPT ONE', 'naïve — 日本語 🎭 prompt', '\uD800']) {
      expect(hashLlmTapePrompt(text)).toBe(nodeDigestOf(text));
    }
  });

  it('should match the pinned vector', () => {
    expect(hashLlmTapePrompt('PROMPT ONE')).toBe('5f6b03b4d2e8');
  });
});

describe('makeLlmTapeStrategy()', () => {
  it('should serve a byte-identical prompt by HASH and report the match', async () => {
    const strategy = makeLlmTapeStrategy({ turns: [turnOf('summarize', 'PROMPT A', 'line A'), turnOf('summarize', 'PROMPT B', 'line B')] });

    const first = await strategy.complete(requestOf('summarize', 'PROMPT A'));
    const second = await strategy.complete(requestOf('summarize', 'PROMPT B'));

    expect(first.text).toBe('line A');
    expect(second.text).toBe('line B');
    expect(first.strategyId).toBe(LLM_TAPE_STRATEGY_ID);
    expect(first.strategyKind).toBe('tape');
    expect(strategy.matches().map((match) => match.kind)).toEqual(['hash', 'hash']);
    expect(strategy.matches().map((match) => match.turnIndex)).toEqual([0, 1]);
    expect(strategy.unconsumed()).toEqual([]);
  });

  it('should match by hash regardless of DISPATCH ORDER (hash-first, not cursor-first)', async () => {
    const strategy = makeLlmTapeStrategy({ turns: [turnOf('summarize', 'PROMPT A', 'line A'), turnOf('summarize', 'PROMPT B', 'line B')] });

    const second = await strategy.complete(requestOf('summarize', 'PROMPT B'));
    const first = await strategy.complete(requestOf('summarize', 'PROMPT A'));

    expect(second.text).toBe('line B');
    expect(first.text).toBe('line A');
    expect(strategy.matches().map((match) => match.kind)).toEqual(['hash', 'hash']);
    expect(strategy.matches().map((match) => match.turnIndex)).toEqual([1, 0]);
  });

  it('should fall back to an ORDER match when the prompt drifted, and still serve the tape text', async () => {
    const strategy = makeLlmTapeStrategy({ turns: [turnOf('summarize', 'PROMPT A', 'line A'), turnOf('summarize', 'PROMPT B', 'line B')] });

    const drifted = await strategy.complete(requestOf('summarize', 'PROMPT A + a newly rendered block'));

    expect(drifted.text).toBe('line A');
    const [match] = strategy.matches();
    expect(match?.kind).toBe('order');
    expect(match?.turnIndex).toBe(0);
    expect(match?.tapePromptSha).toBe(hashLlmTapePrompt('PROMPT A'));
    expect(match?.requestPromptSha).toBe(hashLlmTapePrompt('PROMPT A + a newly rendered block'));
    // A reporter diffs against this without re-dispatching.
    expect(match?.requestPrompt).toBe('PROMPT A + a newly rendered block');
  });

  it('should throw `capability-drift` when unconsumed turns remain but none is the requested capability', async () => {
    const strategy = makeLlmTapeStrategy({ turns: [turnOf('summarize', 'PROMPT A', 'line A')] });

    await expect(strategy.complete(requestOf('classify', 'PROMPT A'))).rejects.toThrow(LlmTapeStrategyError);
    await expect(strategy.complete(requestOf('classify', 'PROMPT A'))).rejects.toThrow(/capability drift/i);
    // Nothing was consumed by the failed dispatches; both refusals were recorded.
    expect(strategy.unconsumed()).toEqual([0]);
    expect(strategy.failures().map((failure) => failure.kind)).toEqual(['capability-drift', 'capability-drift']);
  });

  it('should name the TRUNCATION call on a refusal and never declare the replay worthless', async () => {
    // The strategy reports what it could not serve and where the consumed window ends. Whether that window is worth
    // reading is the reporter's call, not the strategy's.
    const strategy = makeLlmTapeStrategy({ turns: [turnOf('summarize', 'PROMPT A', 'line A'), turnOf('summarize', 'PROMPT B', 'line B')] });

    await strategy.complete(requestOf('summarize', 'PROMPT A'));

    const drift = (await strategy.complete(requestOf('classify', 'PROMPT X')).catch((error: unknown) => error)) as LlmTapeStrategyError;
    expect(drift.message).toContain('at call 2');
    expect(drift.message).toContain('TRUNCATED');
    expect(drift.message).toContain('calls 1..1');
    expect(drift.message).not.toMatch(/confirms nothing/i);

    await strategy.complete(requestOf('summarize', 'PROMPT B'));
    const exhausted = (await strategy.complete(requestOf('summarize', 'PROMPT C')).catch((error: unknown) => error)) as LlmTapeStrategyError;
    expect(exhausted.kind).toBe('tape-exhausted');
    expect(exhausted.message).toContain('exhausted at call 3');
    expect(exhausted.message).toContain('calls 1..2');
    expect(exhausted.message).not.toMatch(/confirms nothing/i);
  });

  it('should throw `tape-exhausted` when the replay makes more calls than the tape recorded', async () => {
    const strategy = makeLlmTapeStrategy({ turns: [turnOf('summarize', 'PROMPT A', 'line A')] });

    await strategy.complete(requestOf('summarize', 'PROMPT A'));

    const caught = await strategy.complete(requestOf('summarize', 'PROMPT B')).catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(LlmTapeStrategyError);
    expect((caught as LlmTapeStrategyError).kind).toBe('tape-exhausted');
  });

  it('should report the turns a short replay never consumed', async () => {
    const strategy = makeLlmTapeStrategy({ turns: [turnOf('summarize', 'PROMPT A', 'line A'), turnOf('summarize', 'PROMPT B', 'line B'), turnOf('summarize', 'PROMPT C', 'line C')] });

    await strategy.complete(requestOf('summarize', 'PROMPT B'));

    expect(strategy.unconsumed()).toEqual([0, 2]);
  });

  it('should keep the recorded token counts but FORCE cost to zero', async () => {
    const turn: LlmTapeTurn = { ...turnOf('summarize', 'PROMPT A', 'line A'), model: 'vendor/model-flash', usage: { promptTokens: 1375, completionTokens: 44, totalTokens: 1419, cost: 0.000123 }, finishReason: 'stop' };
    const strategy = makeLlmTapeStrategy({ turns: [turn] });

    const result = await strategy.complete(requestOf('summarize', 'PROMPT A'));

    expect(result.usage?.promptTokens).toBe(1375);
    expect(result.usage?.completionTokens).toBe(44);
    expect(result.usage?.cost).toBe(0);
    expect(result.model).toBe('vendor/model-flash');
    expect(result.finishReason).toBe('stop');
    expect(result.latencyMs).toBe(0);
    expect(result.schemaEnforced).toBe(false);
  });

  it('should echo the request meta and carry no attempts count (the dispatcher sets that)', async () => {
    const strategy = makeLlmTapeStrategy({ turns: [turnOf('summarize', 'PROMPT A', 'line A')] });

    const result = await strategy.complete({ ...requestOf('summarize', 'PROMPT A'), meta: { entityId: 'e1' } });

    expect(result.meta).toEqual({ entityId: 'e1' });
    expect('attempts' in result).toBe(false);
  });

  it('should be health-ready with no credential of any kind', async () => {
    const strategy = makeLlmTapeStrategy({ turns: [] });

    await expect(strategy.healthCheck?.()).resolves.toEqual({ ready: true, issues: [] });
    // No credential probe at all — there is no credential to probe.
    expect(strategy.credentialProbe).toBeUndefined();
    expect(strategy.caching).toBe('none');
    expect(strategy.kind).toBe(LLM_TAPE_STRATEGY_ID);
  });

  it('should recognise a tape refusal through the name + kind shape, not the prototype', async () => {
    // `instanceof` would answer wrongly across a duplicated module instance, so the guard reads the shape a tape refusal
    // always carries.
    const strategy = makeLlmTapeStrategy({ turns: [turnOf('summarize', 'PROMPT A', 'line A')] });
    const caught = await strategy.complete(requestOf('classify', 'PROMPT A')).catch((error: unknown) => error);

    expect(isLlmTapeStrategyError(caught)).toBe(true);
    expect(isLlmTapeStrategyError(new Error('an ordinary scenario failure'))).toBe(false);
    expect(isLlmTapeStrategyError(null)).toBe(false);
    expect(isLlmTapeStrategyError({ name: 'LlmTapeStrategyError', kind: 'capability-drift' })).toBe(false);
    expect(isLlmTapeStrategyError(Object.assign(new Error('look-alike'), { name: 'LlmTapeStrategyError' }))).toBe(false);
  });

  it('should honour an injected hash seam on BOTH sides of the match', async () => {
    // A degenerate digest that ignores its input: every prompt collides, so a drifted prompt still matches by "hash" —
    // exactly the observable that proves the seam is the one being consulted.
    const strategy = makeLlmTapeStrategy({ turns: [{ capability: 'summarize', promptSha: 'x', text: 'line A' }], hash: () => 'x' });

    const result = await strategy.complete(requestOf('summarize', 'a completely different prompt'));

    expect(result.text).toBe('line A');
    expect(strategy.matches()[0]?.kind).toBe('hash');
  });
});

describe('llmTapeTurnOf()', () => {
  const KINDS: ReadonlySet<string> = new Set(['vendor-decisions']);
  const USAGE = { promptTokens: 120, completionTokens: 8, totalTokens: 128, cost: 0.0004 };
  const FLAT = { capability: 'summarize', prompt: 'PROMPT ONE', text: 'It washes clean.', model: 'vendor/model-flash', usage: USAGE, finishReason: 'stop' };

  it('should turn an I/O-carrying flat payload into a turn, keys in order', () => {
    const turn = llmTapeTurnOf(FLAT);

    expect(turn).toEqual({ capability: 'summarize', promptSha: hashLlmTapePrompt('PROMPT ONE'), text: 'It washes clean.', model: 'vendor/model-flash', usage: USAGE, finishReason: 'stop' });
    expect(Object.keys(turn ?? {})).toEqual(['capability', 'promptSha', 'text', 'model', 'usage', 'finishReason']);
  });

  it('should hash the joined prompt of a segments-only payload', () => {
    const promptSegments = [
      { id: 'instructions', promptSegment: 'B-CAP\n\n', origin: { kind: 'template' } },
      { id: 'live', promptSegment: 'LIVE-D', origin: { kind: 'generated' } }
    ];
    const turn = llmTapeTurnOf({ capability: 'summarize', promptSegments, text: 'reply' });

    expect(turn?.promptSha).toBe(hashLlmTapePrompt('B-CAP\n\nLIVE-D'));
    expect(Object.keys(turn ?? {})).toEqual(['capability', 'promptSha', 'text']);
  });

  it('should not turn a capture-off row, a non-string text or a non-object into a turn', () => {
    expect(llmTapeTurnOf({ capability: 'summarize', model: 'vendor/model-flash', usage: USAGE })).toBeUndefined();
    expect(llmTapeTurnOf({ ...FLAT, text: 42 })).toBeUndefined();
    expect(llmTapeTurnOf(undefined)).toBeUndefined();
    expect(llmTapeTurnOf('PROMPT ONE')).toBeUndefined();
  });

  it('should skip decision rows', () => {
    expect(llmTapeTurnOf({ ...FLAT, strategyKind: 'vendor-decisions' }, { decisionStrategyKinds: KINDS })).toBeUndefined();
    expect(llmTapeTurnOf({ ...FLAT, strategyId: 'vendor-decisions' }, { decisionStrategyKinds: KINDS })).toBeUndefined();
    expect(llmTapeTurnOf({ ...FLAT, decision: 'pick-route' })).toBeUndefined();
    expect(llmTapeTurnOf({ ...FLAT, strategyKind: 'vendor' }, { decisionStrategyKinds: KINDS })).toBeDefined();
  });

  it('should round-trip through the tape strategy as a hash match', async () => {
    const turn = llmTapeTurnOf(FLAT) as LlmTapeTurn;
    const strategy = makeLlmTapeStrategy({ turns: [turn] });
    const result = await strategy.complete(requestOf('summarize', 'PROMPT ONE'));

    expect(result.text).toBe('It washes clean.');
    expect(strategy.matches()[0]?.kind).toBe('hash');
  });

  it('should round-trip with a custom hash passed to both sides', async () => {
    const hash = (text: string) => `len-${text.length}`;
    const turn = llmTapeTurnOf(FLAT, { hash }) as LlmTapeTurn;
    const strategy = makeLlmTapeStrategy({ turns: [turn], hash });
    const result = await strategy.complete(requestOf('summarize', 'PROMPT ONE'));

    expect(turn.promptSha).toBe('len-10');
    expect(result.text).toBe('It washes clean.');
    expect(strategy.matches()[0]?.kind).toBe('hash');
  });
});
