import { describe, expect, it } from 'vitest';
import { DEFAULT_LLM_PROMPT_CACHE_PREFIX_WATCH_MAX_PARTITIONS, llmPromptCachePrefixSegments, makeLlmPromptCachePrefixWatch } from './llm.prompt.cache.watch';
import { LLM_PROMPT_CACHE_HASH_LENGTH, llmPromptCacheHash } from './llm.prompt.hash';
import { joinLlmPromptSegments, splitLlmPromptCacheSegments, type LlmPromptSegment, type LlmPromptSegmentId } from './llm.prompt.segment';

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
  it('joins to exactly the cachePrefix splitLlmPromptCacheSegments derives', () => {
    const shapes: ReadonlyArray<ReadonlyArray<LlmPromptSegment>> = [[stable('A0', 'A'), stable('B', 'B')], [volatileSegment('D', 'D'), stable('C-post', 'POST')], [stable('A0', 'A'), volatileSegment('D', 'D'), stable('C-post', 'POST')], []];

    for (const segments of shapes) {
      expect(joinLlmPromptSegments(llmPromptCachePrefixSegments(segments))).toBe(splitLlmPromptCacheSegments(segments).cachePrefix);
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

describe('makeLlmPromptCachePrefixWatch(); maxPartitions', () => {
  const SEGMENTS = [stable('A0', 'A'), volatileSegment('D', 'D')];
  const MOVED = [stable('A0', 'MOVED'), volatileSegment('D', 'D')];

  it('defaults to DEFAULT_LLM_PROMPT_CACHE_PREFIX_WATCH_MAX_PARTITIONS baselines', () => {
    const watch = makeLlmPromptCachePrefixWatch();

    for (let partition = 0; partition <= DEFAULT_LLM_PROMPT_CACHE_PREFIX_WATCH_MAX_PARTITIONS; partition += 1) {
      watch.observe({ capability: 'summarize', partition, segments: SEGMENTS });
    }

    // partition 0 was the least recently observed when partition 1000 took the table past its cap
    expect(watch.observe({ capability: 'summarize', partition: 0, segments: MOVED }).previousHash).toBeUndefined();
    expect(watch.observe({ capability: 'summarize', partition: DEFAULT_LLM_PROMPT_CACHE_PREFIX_WATCH_MAX_PARTITIONS, segments: MOVED }).changed).toBe(true);
  });

  it('observes an evicted partition seen again as a first dispatch, still hashing and recording it', () => {
    const watch = makeLlmPromptCachePrefixWatch({ maxPartitions: 2 });
    const first = watch.observe({ capability: 'summarize', partition: 'a', segments: SEGMENTS });
    watch.observe({ capability: 'summarize', partition: 'b', segments: SEGMENTS });
    watch.observe({ capability: 'summarize', partition: 'c', segments: SEGMENTS });

    const again = watch.observe({ capability: 'summarize', partition: 'a', segments: MOVED });
    expect(again.changed).toBe(false);
    expect(again.previousHash).toBeUndefined();
    expect(again.firstDifferingSegmentId).toBeUndefined();
    expect(again.hash).toHaveLength(LLM_PROMPT_CACHE_HASH_LENGTH);
    expect(again.hash).not.toBe(first.hash);

    // recorded: the next dispatch of 'a' compares against it
    const next = watch.observe({ capability: 'summarize', partition: 'a', segments: SEGMENTS });
    expect(next.previousHash).toBe(again.hash);
    expect(next.changed).toBe(true);
  });

  it('keeps the most recently observed partitions, dropping the least recently observed', () => {
    const watch = makeLlmPromptCachePrefixWatch({ maxPartitions: 2 });
    watch.observe({ capability: 'summarize', partition: 'a', segments: SEGMENTS });
    watch.observe({ capability: 'summarize', partition: 'b', segments: SEGMENTS });
    // 'a' is observed again, so 'b' is now the least recent
    watch.observe({ capability: 'summarize', partition: 'a', segments: SEGMENTS });
    watch.observe({ capability: 'summarize', partition: 'c', segments: SEGMENTS });

    expect(watch.observe({ capability: 'summarize', partition: 'a', segments: MOVED }).changed).toBe(true);
    expect(watch.observe({ capability: 'summarize', partition: 'b', segments: MOVED }).previousHash).toBeUndefined();
  });

  it('counts each (capability, partition) pair against the cap', () => {
    const watch = makeLlmPromptCachePrefixWatch({ maxPartitions: 1 });
    watch.observe({ capability: 'summarize', partition: 'a', segments: SEGMENTS });
    watch.observe({ capability: 'extract', partition: 'a', segments: SEGMENTS });

    expect(watch.observe({ capability: 'summarize', partition: 'a', segments: MOVED }).previousHash).toBeUndefined();
  });

  it('throws when maxPartitions is not a positive integer', () => {
    expect(() => makeLlmPromptCachePrefixWatch({ maxPartitions: 0 })).toThrow(RangeError);
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

describe('makeLlmPromptCachePrefixWatch() hash', () => {
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
