/**
 * The pure segment helpers: joining is a plain concatenation (a segment carries its own separator), the cache split
 * is positional at the first volatile segment, spans are cumulative and gapless, and the persisted-payload guards are
 * structural and forward-compatible with origin kinds they do not know.
 */

import { describe, expect, it } from 'vitest';
import { type LlmPromptSegment, type LlmPromptSegmentId, isLlmPromptSegment, isLlmPromptSegmentArray, joinLlmPromptSegments, splitLlmPromptCacheSegments, llmPromptSegmentSpans } from './llm.prompt.segment';

describe('joinLlmPromptSegments / splitLlmPromptCacheSegments / llmPromptSegmentSpans', () => {
  const seg = (id: LlmPromptSegmentId, promptSegment: string, volatileSegment?: boolean): LlmPromptSegment => ({ id, promptSegment, origin: { kind: 'generated' }, ...(volatileSegment == null ? {} : { volatile: volatileSegment }) });

  it('joins by PLAIN concatenation: a segment carries its own separator', () => {
    expect(joinLlmPromptSegments([seg('A', 'A\n\n'), seg('B', 'B')])).toBe('A\n\nB');
    expect(joinLlmPromptSegments([])).toBe('');
  });

  it('splits the cache at the FIRST volatile segment, by position', () => {
    const segments = [seg('A', 'A\n\n'), seg('D', 'D\n\n', true), seg('C-post', 'POST')];
    expect(splitLlmPromptCacheSegments(segments)).toEqual({ cachePrefix: 'A\n\n', volatileSuffix: 'D\n\nPOST' });
    // No volatile segment at all ⇒ everything is prefix (and the invariant still holds).
    expect(splitLlmPromptCacheSegments([seg('A', 'A')])).toEqual({ cachePrefix: 'A', volatileSuffix: '' });
  });

  it('derives cumulative, gapless spans', () => {
    expect(llmPromptSegmentSpans([seg('A', 'ab'), seg('B', 'cde')]).map(({ start, end }) => [start, end])).toEqual([
      [0, 2],
      [2, 5]
    ]);
    expect(llmPromptSegmentSpans([])).toEqual([]);
  });

  it('returns the caller’s own segment objects on each span', () => {
    const a = seg('A', 'ab');
    const b = seg('B', 'cde');
    const spans = llmPromptSegmentSpans([a, b]);
    expect(spans[0].segment).toBe(a);
    expect(spans[1].segment).toBe(b);
  });

  it('guards an untyped payload', () => {
    expect(isLlmPromptSegment({ id: 'A', promptSegment: 'x', origin: { kind: 'generated' } })).toBe(true);
    expect(isLlmPromptSegment({ id: 'A', promptSegment: 'x' })).toBe(false);
    expect(isLlmPromptSegment({ promptSegment: 'x', origin: { kind: 'generated' } })).toBe(false);
    expect(isLlmPromptSegment(undefined)).toBe(false);
    // An EMPTY array is rejected: a record with zero segments carries no prompt, and reading it as one would
    // make a reader answer `''` where it must answer "unknown".
    expect(isLlmPromptSegmentArray([])).toBe(false);
    expect(isLlmPromptSegmentArray([{ id: 'D', promptSegment: 'x', origin: { kind: 'live-context' } }])).toBe(true);
  });

  it('accepts an origin kind it does not know (forward-compatible)', () => {
    expect(isLlmPromptSegment({ id: 'A', promptSegment: 'x', origin: { kind: 'some-future-kind', extra: 1 } })).toBe(true);
  });

  it('rejects a non-string id', () => {
    expect(isLlmPromptSegment({ id: 7, promptSegment: 'x', origin: { kind: 'generated' } })).toBe(false);
  });
});
