/**
 * The Choice certainty reader ({@link llmChoiceCertaintyOf}) — the sure edges, the missing-data rules, the contenders
 * and the four unsure classes, over hand-built distributions.
 */

import { describe, expect, it } from 'vitest';
import { type LlmChoiceCertaintyFloors, llmChoiceCertaintyOf } from './llm.decision.certainty';
import type { LlmDecisionChoiceAnswer } from './llm.decision.question';

const FLOORS: LlmChoiceCertaintyFloors = { sureConfidence: 0.5, sureMargin: 0.2, contenderMass: 0.6, contendersMax: 4 };

function choiceOf(probabilities: Readonly<Record<string, number>>, confidence?: number): LlmDecisionChoiceAnswer {
  const choice = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'a';
  return { type: 'choice', choice, probabilities, ...(confidence == null ? {} : { confidence }) };
}

describe('llmChoiceCertaintyOf', () => {
  it('reads sure exactly at the confidence and margin edges', () => {
    const read = llmChoiceCertaintyOf(choiceOf({ a: 0.5, b: 0.3, c: 0.2 }, 0.5), { floors: FLOORS });
    expect(read.certainty).toBe('sure');
    expect(read.band).toBe('medium');
    expect(read.margin).toBeCloseTo(0.2);
    expect(read.contenders).toEqual([{ option: 'a', probability: 0.5 }]);
  });

  it('reads unsure just under the confidence edge', () => {
    expect(llmChoiceCertaintyOf(choiceOf({ a: 0.49, b: 0.2, c: 0.31 }, 0.49), { floors: FLOORS }).certainty).not.toBe('sure');
  });

  it('reads unsure just under the margin edge', () => {
    expect(llmChoiceCertaintyOf(choiceOf({ a: 0.55, b: 0.36, c: 0.09 }, 0.55), { floors: FLOORS }).certainty).toBe('split');
  });

  it("uses the winner's share when the confidence is absent", () => {
    const read = llmChoiceCertaintyOf(choiceOf({ a: 0.8, b: 0.2 }), { floors: FLOORS });
    expect(read.certainty).toBe('sure');
    expect(read.confidence).toBe(0.8);
  });

  it('reads the band alone with no distribution', () => {
    expect(llmChoiceCertaintyOf({ type: 'choice', choice: 'a', confidence: 0.9 }, { floors: FLOORS })).toMatchObject({ certainty: 'sure', confidence: 0.9 });
    expect(llmChoiceCertaintyOf({ type: 'choice', choice: 'a', confidence: 0.3 }, { floors: FLOORS }).certainty).toBe('diffuse');
  });

  it('reads unread with neither a distribution nor a confidence', () => {
    expect(llmChoiceCertaintyOf({ type: 'choice', choice: 'a' }, { floors: FLOORS }).certainty).toBe('unread');
  });

  it('stops the contenders at the mass, keeping at least two', () => {
    const read = llmChoiceCertaintyOf(choiceOf({ a: 0.31, b: 0.25, c: 0.24, d: 0.2 }, 0.31), { floors: FLOORS });
    expect(read.certainty).toBe('split');
    expect(read.contenders.map((contender) => contender.option)).toEqual(['a', 'b', 'c']);
    expect(read.mass).toBeCloseTo(0.8);
  });

  it('keeps two contenders even when the first already holds the mass', () => {
    const read = llmChoiceCertaintyOf(choiceOf({ a: 0.62, b: 0.36, c: 0.02 }, 0.45), { floors: FLOORS });
    expect(read.contenders).toHaveLength(2);
  });

  it('stops at the cap and reads diffuse when the mass was never reached', () => {
    const read = llmChoiceCertaintyOf(choiceOf({ a: 0.12, b: 0.08, c: 0.06, d: 0.05, ...Object.fromEntries(Array.from({ length: 23 }, (_, index) => [`r${index}`, 0.03])) }, 0.1), { floors: FLOORS });
    expect(read.certainty).toBe('diffuse');
    expect(read.contenders).toHaveLength(4);
    expect(read.margin).toBeCloseTo(0.04);
  });

  it('reads nested when the caller says the contenders cohere', () => {
    const answer = choiceOf({ a: 0.28, b: 0.22, c: 0.22, d: 0.14, e: 0.14 }, 0.25);
    const read = llmChoiceCertaintyOf(answer, { floors: FLOORS, coherent: (contenders) => ['a', 'b', 'c'].every((option) => contenders.includes(option)) });
    expect(read.certainty).toBe('nested');
    expect(read.contenders.map((contender) => contender.option)).toEqual(['a', 'b', 'c']);
    expect(llmChoiceCertaintyOf(answer, { floors: FLOORS }).certainty).toBe('split');
  });

  it('keeps declaration order on a tie', () => {
    const read = llmChoiceCertaintyOf(choiceOf({ a: 0.4, b: 0.4, c: 0.2 }, 0.4), { floors: FLOORS });
    expect(read.contenders.map((contender) => contender.option)).toEqual(['a', 'b']);
  });

  it('is pure: the same answer reads the same', () => {
    const answer = choiceOf({ a: 0.36, b: 0.33, c: 0.31 }, 0.36);
    expect(llmChoiceCertaintyOf(answer, { floors: FLOORS })).toEqual(llmChoiceCertaintyOf(answer, { floors: FLOORS }));
  });
});
