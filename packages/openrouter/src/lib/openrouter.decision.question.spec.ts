import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type OpenRouterDecisionChoiceAnswer,
  type OpenRouterDecisionEntry,
  type OpenRouterDecisionQuestions,
  type OpenRouterDecisionScoreLevels,
  type OpenRouterDecisionStructuredCriterion,
  type OpenRouterDecisionStructuredInstructions,
  type OpenRouterDecisionStructuredLevel,
  OPENROUTER_DECISION_CHOICE_OPTIONS_MAX,
  OPENROUTER_DECISION_SCORE_LEVELS_MAX,
  asOpenRouterDecisionConfidenceBand,
  isBlankOpenRouterDecisionEntry,
  mapOpenRouterDecisionChoiceRows,
  openRouterChoiceQuestion,
  openRouterDecisionChoiceOptionNames,
  openRouterDecisionChoiceRanking,
  openRouterDecisionStatePaths,
  openRouterNoulQuestion,
  openRouterScoreQuestion,
  validateOpenRouterDecisionQuestions
} from './openrouter.decision.question';

/**
 * Builds a Choice declaring `count` options, for the transport-cap boundary.
 *
 * @param count - How many options to declare.
 * @returns The question.
 */
function choiceWithOptions(count: number) {
  const options: Record<string, string> = {};

  for (let i = 0; i < count; i += 1) {
    options[`option-${i}`] = `the ${i}th option`;
  }

  return openRouterChoiceQuestion('which one?', options);
}

describe('isBlankOpenRouterDecisionEntry()', () => {
  it('should read a blank string, an empty array and a keyless object as asking nothing', () => {
    expect(isBlankOpenRouterDecisionEntry('')).toBe(true);
    expect(isBlankOpenRouterDecisionEntry('   ')).toBe(true);
    expect(isBlankOpenRouterDecisionEntry([])).toBe(true);
    expect(isBlankOpenRouterDecisionEntry({})).toBe(true);
    expect(isBlankOpenRouterDecisionEntry(null)).toBe(true);
  });

  it('should read any actual guidance as not blank', () => {
    expect(isBlankOpenRouterDecisionEntry('is it urgent?')).toBe(false);
    expect(isBlankOpenRouterDecisionEntry({ what: 'billing' })).toBe(false);
    expect(isBlankOpenRouterDecisionEntry(['a'])).toBe(false);
  });
});

describe('validateOpenRouterDecisionQuestions()', () => {
  it('should refuse a question whose instructions ask nothing', () => {
    const validation = validateOpenRouterDecisionQuestions({ urgency: openRouterNoulQuestion('') });
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('`urgency`');
    expect(validation.errors[0]).toContain('asks nothing');
  });

  it('should refuse a declaration with no questions at all', () => {
    expect(validateOpenRouterDecisionQuestions({}).valid).toBe(false);
    expect(validateOpenRouterDecisionQuestions(null).valid).toBe(false);
  });

  it('should refuse a Choice declaring no options', () => {
    const validation = validateOpenRouterDecisionQuestions({ pick: openRouterChoiceQuestion('which one?', {}) });
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('no options');
  });

  it('should accept a Choice at the transport cap and refuse one past it', () => {
    // The cap is a hard transport limit, so the boundary is the thing worth pinning.
    expect(validateOpenRouterDecisionQuestions({ pick: choiceWithOptions(OPENROUTER_DECISION_CHOICE_OPTIONS_MAX) }).valid).toBe(true);

    const validation = validateOpenRouterDecisionQuestions({ pick: choiceWithOptions(OPENROUTER_DECISION_CHOICE_OPTIONS_MAX + 1) });
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('narrow in two stages');
  });

  it('should accept a Score at ten levels and refuse one at eleven', () => {
    // The trap this guards: a 0..8 band is NINE levels and legal, a 0..10 scale is eleven and is not.
    const ten = Array.from({ length: OPENROUTER_DECISION_SCORE_LEVELS_MAX }, (_, i) => `level ${i}`) as unknown as OpenRouterDecisionScoreLevels;
    const eleven = Array.from({ length: OPENROUTER_DECISION_SCORE_LEVELS_MAX + 1 }, (_, i) => `level ${i}`) as unknown as OpenRouterDecisionScoreLevels;

    expect(validateOpenRouterDecisionQuestions({ heat: openRouterScoreQuestion('how hot?', ten) }).valid).toBe(true);

    const validation = validateOpenRouterDecisionQuestions({ heat: openRouterScoreQuestion('how hot?', eleven) });
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('merge the levels');
  });

  it('should report every bad question, not only the first', () => {
    const validation = validateOpenRouterDecisionQuestions({ a: openRouterNoulQuestion(''), b: openRouterChoiceQuestion('pick', {}) });
    expect(validation.errors).toHaveLength(2);
  });
});

describe('openRouterNoulQuestion()', () => {
  it('should omit `means` entirely when none was given', () => {
    // Omitted rather than undefined: the wire mapping branches on its presence.
    expect('means' in openRouterNoulQuestion('is it urgent?')).toBe(false);
  });

  it('should carry both sides when given', () => {
    const question = openRouterNoulQuestion('is it urgent?', { true: 'needs action today', false: 'can wait' });
    expect(question.means?.true).toBe('needs action today');
  });
});

describe('asOpenRouterDecisionConfidenceBand()', () => {
  it('should read an absent confidence as low rather than throwing', () => {
    // The model is not required to report one, and "did not say" is not "sure".
    expect(asOpenRouterDecisionConfidenceBand(null)).toBe('low');
    expect(asOpenRouterDecisionConfidenceBand(undefined)).toBe('low');
  });

  it('should band at the documented thresholds', () => {
    expect(asOpenRouterDecisionConfidenceBand(0.75)).toBe('high');
    expect(asOpenRouterDecisionConfidenceBand(0.74)).toBe('medium');
    expect(asOpenRouterDecisionConfidenceBand(0.5)).toBe('medium');
    expect(asOpenRouterDecisionConfidenceBand(0.49)).toBe('low');
  });

  it('should read a non-finite confidence as low rather than medium', () => {
    // NaN fails every threshold comparison, so without a guard it would fall through to `medium`.
    expect(asOpenRouterDecisionConfidenceBand(Number.NaN)).toBe('low');
    expect(asOpenRouterDecisionConfidenceBand(Number.POSITIVE_INFINITY)).toBe('low');
    expect(asOpenRouterDecisionConfidenceBand(Number.NEGATIVE_INFINITY)).toBe('low');
  });
});

describe('structured declaration shapes', () => {
  // Typed through their own names, as a caller declaring a taxonomy in code would type them. The shapes
  // are `type` aliases so that each is assignable to the object arm of `OpenRouterDecisionEntry`; an
  // `interface` has no implicit index signature and these declarations would stop compiling.
  const instructions: OpenRouterDecisionStructuredInstructions = { question: 'which team owns this ticket?', inspect: ['ticket.body'] };
  const billing: OpenRouterDecisionStructuredCriterion = { what: 'charges, invoices, refunds', not_for: 'plan changes' };
  const sales: OpenRouterDecisionStructuredCriterion = { what: 'plan changes and upgrades' };
  const minor: OpenRouterDecisionStructuredLevel = { what: 'cosmetic, no workaround needed' };
  const major: OpenRouterDecisionStructuredLevel = { what: 'broken feature, a workaround exists', signals: ['error messages'] };

  it('should be assignable to OpenRouterDecisionEntry', () => {
    expectTypeOf<OpenRouterDecisionStructuredInstructions>().toExtend<OpenRouterDecisionEntry>();
    expectTypeOf<OpenRouterDecisionStructuredCriterion>().toExtend<OpenRouterDecisionEntry>();
    expectTypeOf<OpenRouterDecisionStructuredLevel>().toExtend<OpenRouterDecisionEntry>();

    const entries: OpenRouterDecisionEntry[] = [instructions, billing, minor];
    expect(entries).toHaveLength(3);
  });

  it('should be accepted by the question builders and passed through by identity', () => {
    const choice = openRouterChoiceQuestion(instructions, { billing, sales });
    const score = openRouterScoreQuestion(instructions, [minor, major]);
    const noul = openRouterNoulQuestion(instructions, { true: billing, false: sales });

    expect(choice.instructions).toBe(instructions);
    expect(choice.options.billing).toBe(billing);
    expect(score.levels[1]).toBe(major);
    expect(noul.means?.true).toBe(billing);
    expect(validateOpenRouterDecisionQuestions({ choice, score, noul }).valid).toBe(true);
  });
});

describe('openRouterDecisionChoiceRanking()', () => {
  it('should return an empty ranking when no distribution came back', () => {
    // An absent distribution is a real reply, not a fault.
    expect(openRouterDecisionChoiceRanking({ type: 'choice', choice: 'a' })).toEqual([]);
  });

  it('should rank most probable first', () => {
    const answer: OpenRouterDecisionChoiceAnswer = { type: 'choice', choice: 'b', probabilities: { a: 0.2, b: 0.7, c: 0.1 } };
    expect(openRouterDecisionChoiceRanking(answer).map((x) => x.option)).toEqual(['b', 'a', 'c']);
  });

  it('should keep declaration order on a tie', () => {
    const answer: OpenRouterDecisionChoiceAnswer = { type: 'choice', choice: 'a', probabilities: { a: 0.5, b: 0.5 } };
    expect(openRouterDecisionChoiceRanking(answer).map((x) => x.option)).toEqual(['a', 'b']);
  });
});

describe('mapOpenRouterDecisionChoiceRows()', () => {
  it('should resolve the distribution back to the caller rows and drop what does not resolve', () => {
    const questions = { pick: openRouterChoiceQuestion('which?', { a: 'the a', b: 'the b' }) } as const;
    const answers = { pick: { type: 'choice', choice: 'a', probabilities: { a: 0.6, b: 0.4 } } } as never;
    const rows = mapOpenRouterDecisionChoiceRows<typeof questions, 'pick', string>({ answers, question: 'pick', rowOf: (option) => (option === 'a' ? 'ROW-A' : null) });

    expect(rows).toEqual([{ row: 'ROW-A', probability: 0.6 }]);
  });
});

describe('openRouterDecisionChoiceOptionNames()', () => {
  it('should report the options in declaration order', () => {
    expect(openRouterDecisionChoiceOptionNames(openRouterChoiceQuestion('which?', { z: 'z', a: 'a' }))).toEqual(['z', 'a']);
  });
});

describe('openRouterDecisionStatePaths()', () => {
  it('should read backticked dot and index paths out of prose', () => {
    expect(openRouterDecisionStatePaths('Does `ticket.sender.email` match `messages[0].text`?')).toEqual(['ticket.sender.email', 'messages[0].text']);
  });

  it('should walk a structured entry and deduplicate', () => {
    const entry: OpenRouterDecisionEntry = { question: 'compare `phrase`', inspect: ['`phrase`', '`rows[2].gloss`'] };
    expect(openRouterDecisionStatePaths(entry)).toEqual(['phrase', 'rows[2].gloss']);
  });

  it('should find nothing in an entry that names nothing', () => {
    expect(openRouterDecisionStatePaths('is it urgent?')).toEqual([]);
  });
});

describe('question maps', () => {
  it('should type the answers off the questions', () => {
    // A compile-level assertion: the value is unused, but the declaration would not compile if the
    // answer type were not derived from the question map.
    const questions = { urgency: openRouterNoulQuestion('is it urgent?') } satisfies OpenRouterDecisionQuestions;
    expect(questions.urgency.type).toBe('noul');
  });
});
