import { describe, expect, it } from 'vitest';
import { llmPromptCachePrefixSegments, makeLlmPromptCachePrefixWatch } from './llm.prompt.cache.watch';
import { LLM_PROMPT_CACHE_HASH_LENGTH, llmPromptCacheHash } from './llm.prompt.hash';
import { joinLlmPromptSegments, llmPromptCacheSegmentsOf, type LlmPromptSegment, type LlmPromptSegmentId } from './llm.prompt.segment';

/**
 * A stable prompt segment.
 *
 * @param id - The segment id.
 * @param body - Its bytes.
 * @returns The segment.
 */
function stable(id: LlmPromptSegmentId, body: string): LlmPromptSegment {
  return { id, promptSegment: body, origin: { kind: 'template' } };
}

/**
 * A volatile segment (a live block) — everything from here on is the volatile suffix.
 *
 * @param id - The segment id.
 * @param body - Its bytes.
 * @returns The segment.
 */
function volatileSegment(id: LlmPromptSegmentId, body: string): LlmPromptSegment {
  return { id, promptSegment: body, origin: { kind: 'live-context' }, volatile: true };
}

describe('llmPromptCachePrefixSegments()', () => {
  it('splits at the FIRST volatile segment, by position and not by kind', () => {
    const segments = [stable('A0', 'A'), stable('C-pre', 'C'), volatileSegment('D', 'D'), stable('C-post', 'POST')];
    expect(llmPromptCachePrefixSegments(segments).map((segment) => segment.id)).toEqual(['A0', 'C-pre']);
  });

  it('treats a wholly stable prompt as all-prefix', () => {
    expect(llmPromptCachePrefixSegments([stable('A0', 'A')]).map((segment) => segment.id)).toEqual(['A0']);
  });
});

describe('llmPromptCachePrefixSegments(); the cache split', () => {
  it('joins to exactly the cachePrefix llmPromptCacheSegmentsOf derives', () => {
    const shapes: ReadonlyArray<ReadonlyArray<LlmPromptSegment>> = [[stable('A0', 'A'), stable('B', 'B')], [volatileSegment('D', 'D'), stable('C-post', 'POST')], [stable('A0', 'A'), volatileSegment('D', 'D'), stable('C-post', 'POST')], []];

    for (const segments of shapes) {
      expect(joinLlmPromptSegments(llmPromptCachePrefixSegments(segments))).toBe(llmPromptCacheSegmentsOf(segments).cachePrefix);
    }
  });
});

describe('makeLlmPromptCachePrefixWatch()', () => {
  const partitioned = { capability: 'summarize', partition: 7 };

  it("reports NO change on a partition's first dispatch, and carries the hash regardless", () => {
    const watch = makeLlmPromptCachePrefixWatch();
    const first = watch.observe({ ...partitioned, segments: [stable('A0', 'A'), volatileSegment('D', 'D1')] });
    expect(first.changed).toBe(false);
    expect(first.previousHash).toBeUndefined();
    expect(first.hash).toHaveLength(LLM_PROMPT_CACHE_HASH_LENGTH);
    expect(first.prefixChars).toBe(1);
  });

  it('reports NO change when only the VOLATILE suffix moved (the whole point of the split)', () => {
    const watch = makeLlmPromptCachePrefixWatch();
    watch.observe({ ...partitioned, segments: [stable('A0', 'A'), volatileSegment('D', 'D1')] });
    const second = watch.observe({ ...partitioned, segments: [stable('A0', 'A'), volatileSegment('D', 'D2-quite-different')] });
    expect(second.changed).toBe(false);
    expect(second.previousHash).toBe(second.hash);
  });

  it('names the FIRST segment whose bytes moved', () => {
    const watch = makeLlmPromptCachePrefixWatch();
    watch.observe({ ...partitioned, segments: [stable('A0', 'A'), stable('B', 'B'), stable('C-pre', 'C'), volatileSegment('D', 'D')] });
    const second = watch.observe({ ...partitioned, segments: [stable('A0', 'A'), stable('B', 'B!'), stable('C-pre', 'C!'), volatileSegment('D', 'D')] });
    expect(second.changed).toBe(true);
    expect(second.firstDifferingSegmentId).toBe('B');
    expect(second.appendedSegmentId).toBeUndefined();
    expect(second.previousHash).not.toBe(second.hash);
  });

  it('names a RELABELLED slot ahead of a later rewritten one: identity moves first', () => {
    const watch = makeLlmPromptCachePrefixWatch();
    watch.observe({ ...partitioned, segments: [stable('A0', 'A'), stable('B', 'X'), stable('C-pre', 'Y'), volatileSegment('D', 'D')] });
    const second = watch.observe({ ...partitioned, segments: [stable('A0', 'A'), stable('B1', 'X'), stable('C-pre', 'Z'), volatileSegment('D', 'D')] });
    expect(second.changed).toBe(true);
    expect(second.firstDifferingSegmentId).toBe('B1');
  });

  it('does NOT call an id-only relabel a change: the cache breaks on BYTES, and these are identical', () => {
    const watch = makeLlmPromptCachePrefixWatch();
    watch.observe({ ...partitioned, segments: [stable('A0', 'A'), stable('B', 'X'), volatileSegment('D', 'D')] });
    const second = watch.observe({ ...partitioned, segments: [stable('A0', 'A'), stable('B1', 'X'), volatileSegment('D', 'D')] });
    expect(second.changed).toBe(false);
    expect(second.firstDifferingSegmentId).toBeUndefined();
  });

  it('separates a pure APPEND from a mid-prefix rewrite', () => {
    const watch = makeLlmPromptCachePrefixWatch();
    watch.observe({ ...partitioned, segments: [stable('A0', 'A'), volatileSegment('D', 'D')] });
    const second = watch.observe({ ...partitioned, segments: [stable('A0', 'A'), stable('model-addendum', 'X'), volatileSegment('D', 'D')] });
    expect(second.changed).toBe(true);
    expect(second.appendedSegmentId).toBe('model-addendum');
    expect(second.firstDifferingSegmentId).toBeUndefined();
  });

  it('names the first DROPPED segment when the prefix shrank', () => {
    const watch = makeLlmPromptCachePrefixWatch();
    watch.observe({ ...partitioned, segments: [stable('A0', 'A'), stable('B1', 'X'), volatileSegment('D', 'D')] });
    const second = watch.observe({ ...partitioned, segments: [stable('A0', 'A'), volatileSegment('D', 'D')] });
    expect(second.changed).toBe(true);
    expect(second.firstDifferingSegmentId).toBe('B1');
  });

  it('keeps a baseline PER (capability, partition): two partitions do not report each other as changes', () => {
    const watch = makeLlmPromptCachePrefixWatch();
    watch.observe({ capability: 'summarize', partition: 1, segments: [stable('A0', 'ONE'), volatileSegment('D', 'D')] });
    watch.observe({ capability: 'summarize', partition: 2, segments: [stable('A0', 'TWO'), volatileSegment('D', 'D')] });
    const backToOne = watch.observe({ capability: 'summarize', partition: 1, segments: [stable('A0', 'ONE'), volatileSegment('D', 'D')] });
    const otherCapability = watch.observe({ capability: 'classify', partition: 1, segments: [stable('A0', 'ONE'), volatileSegment('D', 'D')] });
    expect(backToOne.changed).toBe(false);
    expect(otherCapability.changed).toBe(false);
    expect(otherCapability.previousHash).toBeUndefined();
  });

  it('folds a dispatch with no partition under its capability alone', () => {
    const watch = makeLlmPromptCachePrefixWatch();
    watch.observe({ capability: 'extract', segments: [stable('A0', 'A'), volatileSegment('D', 'D')] });
    const second = watch.observe({ capability: 'extract', segments: [stable('A0', 'A!'), volatileSegment('D', 'D')] });
    expect(second.changed).toBe(true);
    expect(second.partition).toBeUndefined();
  });

  it('reset() makes the next dispatch read as a first dispatch again', () => {
    const watch = makeLlmPromptCachePrefixWatch();
    watch.observe({ ...partitioned, segments: [stable('A0', 'A'), volatileSegment('D', 'D')] });
    watch.reset();
    const after = watch.observe({ ...partitioned, segments: [stable('A0', 'MOVED'), volatileSegment('D', 'D')] });
    expect(after.changed).toBe(false);
    expect(after.previousHash).toBeUndefined();
  });
});

// Once a capability orders its live blocks slow→fast, several live blocks ride the cache PREFIX — and every one of
// them answers `firstDifferingSegmentId: 'D'`. The block KEY is what makes the report actionable: it names
// which block the capability's stability claim turned out to be wrong about.
describe('makeLlmPromptCachePrefixWatch(); a prefix carrying stable live blocks', () => {
  const PARTITION = 7;
  const block = (key: string, body: string, isVolatile = false): LlmPromptSegment => ({ id: 'D', promptSegment: body, origin: { kind: 'live-context' }, key, volatile: isVolatile });
  const dispatch = (ledger: string) => [stable('A', 'A-PROTOCOL\n\n'), block('heading', '## Live context\n\n'), block('members', 'MEMBERS\n\n'), block('ledger', `${ledger}\n\n`), block('history', 'RECENT-HISTORY', true)];

  it('names the live BLOCK that moved, not just the layer', () => {
    const watch = makeLlmPromptCachePrefixWatch();
    watch.observe({ capability: 'summarize', partition: PARTITION, segments: dispatch('Balance: 4') });
    const second = watch.observe({ capability: 'summarize', partition: PARTITION, segments: dispatch('Balance: 1') });

    expect(second.changed).toBe(true);
    expect(second.firstDifferingSegmentId).toBe('D');
    expect(second.firstDifferingSegmentKey).toBe('ledger');
  });

  it('reports NO change when only the volatile blocks move, which is the whole point of declaring the rest stable', () => {
    const watch = makeLlmPromptCachePrefixWatch();
    const withHistory = (history: string) => [...dispatch('Balance: 4').slice(0, 4), block('history', history, true)];
    watch.observe({ capability: 'summarize', partition: PARTITION, segments: withHistory('TICK-N') });
    const second = watch.observe({ capability: 'summarize', partition: PARTITION, segments: withHistory('TICK-N+1') });

    expect(second.changed).toBe(false);
    expect(second.firstDifferingSegmentKey).toBeUndefined();
    expect(second.prefixChars).toBe(50);
  });

  it('carries no key for a segment that has none', () => {
    const watch = makeLlmPromptCachePrefixWatch();
    watch.observe({ capability: 'summarize', segments: [{ id: 'contract', promptSegment: 'ONE\n\n', origin: { kind: 'generated' } }, volatileSegment('D', 'D')] });
    const second = watch.observe({ capability: 'summarize', segments: [{ id: 'contract', promptSegment: 'TWO\n\n', origin: { kind: 'generated' } }, volatileSegment('D', 'D')] });

    expect(second.firstDifferingSegmentId).toBe('contract');
    expect(second.firstDifferingSegmentKey).toBeUndefined();
  });
});

describe('makeLlmPromptCachePrefixWatch(); D6', () => {
  it('hashes the prefix with the library hash', () => {
    const observation = makeLlmPromptCachePrefixWatch().observe({ capability: 'summarize', segments: [stable('A0', 'abc')] });
    expect(observation.hash).toBe('ba7816bf8f01cfea');
    expect(observation.hash).toBe(llmPromptCacheHash('abc'));
  });

  it('echoes a numeric or string partition', () => {
    const watch = makeLlmPromptCachePrefixWatch();
    expect(watch.observe({ capability: 'summarize', partition: 7, segments: [stable('A0', 'A')] }).partition).toBe(7);
    expect(watch.observe({ capability: 'summarize', partition: 'user-7', segments: [stable('A0', 'A')] }).partition).toBe('user-7');
  });
});
