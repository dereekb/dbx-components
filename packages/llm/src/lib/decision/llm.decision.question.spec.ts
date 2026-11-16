import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type LlmDecisionChoiceAnswer,
  type LlmDecisionEntry,
  type LlmDecisionQuestions,
  type LlmDecisionScoreLevels,
  type LlmDecisionStructuredCriterion,
  type LlmDecisionStructuredInstructions,
  type LlmDecisionStructuredLevel,
  LLM_DECISION_CHOICE_OPTIONS_MAX,
  LLM_DECISION_SCORE_LEVELS_MAX,
  asLlmDecisionConfidenceBand,
  LlmDecisionDeclarationError,
  isBlankLlmDecisionEntry,
  mapLlmDecisionChoiceRows,
  llmChoiceQuestion,
  llmDecisionChoiceOptionNames,
  llmDecisionChoiceRanking,
  llmDecisionStatePaths,
  llmNoulQuestion,
  llmScoreQuestion,
  validateLlmDecisionQuestions
} from './llm.decision.question';

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

  return llmChoiceQuestion('which one?', options);
}

describe('isBlankLlmDecisionEntry()', () => {
  it('should read a blank string, an empty array and a keyless object as asking nothing', () => {
    expect(isBlankLlmDecisionEntry('')).toBe(true);
    expect(isBlankLlmDecisionEntry('   ')).toBe(true);
    expect(isBlankLlmDecisionEntry([])).toBe(true);
    expect(isBlankLlmDecisionEntry({})).toBe(true);
    expect(isBlankLlmDecisionEntry(null)).toBe(true);
  });

  it('should read any actual guidance as not blank', () => {
    expect(isBlankLlmDecisionEntry('is it urgent?')).toBe(false);
    expect(isBlankLlmDecisionEntry({ what: 'billing' })).toBe(false);
    expect(isBlankLlmDecisionEntry(['a'])).toBe(false);
  });
});

describe('validateLlmDecisionQuestions()', () => {
  it('should return the { valid, errors, warnings } validation shape', () => {
    const validation = validateLlmDecisionQuestions({ urgency: llmNoulQuestion('`ticket` is urgent.') });
    expect(validation).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('should refuse a question whose instructions ask nothing', () => {
    const validation = validateLlmDecisionQuestions({ urgency: llmNoulQuestion('') });
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('`urgency`');
    expect(validation.errors[0]).toContain('asks nothing');
  });

  it('should refuse a declaration with no questions at all', () => {
    expect(validateLlmDecisionQuestions({}).valid).toBe(false);
    expect(validateLlmDecisionQuestions(null).valid).toBe(false);
  });

  it('should refuse a Choice declaring no options', () => {
    const validation = validateLlmDecisionQuestions({ pick: llmChoiceQuestion('which one?', {}) });
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('no options');
  });

  it('should accept a Choice at the transport cap and refuse one past it', () => {
    // The cap is a hard transport limit, so the boundary is the thing worth pinning.
    expect(validateLlmDecisionQuestions({ pick: choiceWithOptions(LLM_DECISION_CHOICE_OPTIONS_MAX) }).valid).toBe(true);

    const validation = validateLlmDecisionQuestions({ pick: choiceWithOptions(LLM_DECISION_CHOICE_OPTIONS_MAX + 1) });
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('narrow in two stages');
  });

  it('should accept a Score at ten levels and refuse one at eleven', () => {
    // The trap this guards: a 0..8 band is NINE levels and legal, a 0..10 scale is eleven and is not.
    const ten = Array.from({ length: LLM_DECISION_SCORE_LEVELS_MAX }, (_, i) => `level ${i}`) as unknown as LlmDecisionScoreLevels;
    const eleven = Array.from({ length: LLM_DECISION_SCORE_LEVELS_MAX + 1 }, (_, i) => `level ${i}`) as unknown as LlmDecisionScoreLevels;

    expect(validateLlmDecisionQuestions({ heat: llmScoreQuestion('how hot?', ten) }).valid).toBe(true);

    const validation = validateLlmDecisionQuestions({ heat: llmScoreQuestion('how hot?', eleven) });
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('merge the levels');
  });

  it('should report every bad question, not only the first', () => {
    const validation = validateLlmDecisionQuestions({ a: llmNoulQuestion(''), b: llmChoiceQuestion('pick', {}) });
    expect(validation.errors).toHaveLength(2);
  });
});

describe('llmNoulQuestion()', () => {
  it('should omit `means` entirely when none was given', () => {
    // Omitted rather than undefined: the wire mapping branches on its presence.
    expect('means' in llmNoulQuestion('is it urgent?')).toBe(false);
  });

  it('should carry both sides when given', () => {
    const question = llmNoulQuestion('is it urgent?', { true: 'needs action today', false: 'can wait' });
    expect(question.means?.true).toBe('needs action today');
  });
});

describe('asLlmDecisionConfidenceBand()', () => {
  it('should read an absent confidence as low rather than throwing', () => {
    // The model is not required to report one, and "did not say" is not "sure".
    expect(asLlmDecisionConfidenceBand(null)).toBe('low');
    expect(asLlmDecisionConfidenceBand(undefined)).toBe('low');
  });

  it('should band at the documented thresholds', () => {
    expect(asLlmDecisionConfidenceBand(0.75)).toBe('high');
    expect(asLlmDecisionConfidenceBand(0.74)).toBe('medium');
    expect(asLlmDecisionConfidenceBand(0.5)).toBe('medium');
    expect(asLlmDecisionConfidenceBand(0.49)).toBe('low');
  });

  it('should read a non-finite confidence as low rather than medium', () => {
    // NaN fails every threshold comparison, so without a guard it would fall through to `medium`.
    expect(asLlmDecisionConfidenceBand(Number.NaN)).toBe('low');
    expect(asLlmDecisionConfidenceBand(Number.POSITIVE_INFINITY)).toBe('low');
    expect(asLlmDecisionConfidenceBand(Number.NEGATIVE_INFINITY)).toBe('low');
  });
});

describe('structured declaration shapes', () => {
  // Typed through their own names, as a caller declaring a taxonomy in code would type them. The shapes
  // are `type` aliases so that each is assignable to the object arm of `LlmDecisionEntry`; an
  // `interface` has no implicit index signature and these declarations would stop compiling.
  const instructions: LlmDecisionStructuredInstructions = { question: 'which team owns this ticket?', inspect: ['ticket.body'] };
  const billing: LlmDecisionStructuredCriterion = { what: 'charges, invoices, refunds', not_for: 'plan changes' };
  const sales: LlmDecisionStructuredCriterion = { what: 'plan changes and upgrades' };
  const minor: LlmDecisionStructuredLevel = { what: 'cosmetic, no workaround needed' };
  const major: LlmDecisionStructuredLevel = { what: 'broken feature, a workaround exists', signals: ['error messages'] };

  it('should be assignable to LlmDecisionEntry', () => {
    expectTypeOf<LlmDecisionStructuredInstructions>().toExtend<LlmDecisionEntry>();
    expectTypeOf<LlmDecisionStructuredCriterion>().toExtend<LlmDecisionEntry>();
    expectTypeOf<LlmDecisionStructuredLevel>().toExtend<LlmDecisionEntry>();

    const entries: LlmDecisionEntry[] = [instructions, billing, minor];
    expect(entries).toHaveLength(3);
  });

  it('should be accepted by the question builders and passed through by identity', () => {
    const choice = llmChoiceQuestion(instructions, { billing, sales });
    const score = llmScoreQuestion(instructions, [minor, major]);
    const noul = llmNoulQuestion(instructions, { true: billing, false: sales });

    expect(choice.instructions).toBe(instructions);
    expect(choice.options.billing).toBe(billing);
    expect(score.levels[1]).toBe(major);
    expect(noul.means?.true).toBe(billing);
    expect(validateLlmDecisionQuestions({ choice, score, noul }).valid).toBe(true);
  });
});

describe('llmDecisionChoiceRanking()', () => {
  it('should return an empty ranking when no distribution came back', () => {
    // An absent distribution is a real reply, not a fault.
    expect(llmDecisionChoiceRanking({ type: 'choice', choice: 'a' })).toEqual([]);
  });

  it('should rank most probable first', () => {
    const answer: LlmDecisionChoiceAnswer = { type: 'choice', choice: 'b', probabilities: { a: 0.2, b: 0.7, c: 0.1 } };
    expect(llmDecisionChoiceRanking(answer).map((x) => x.option)).toEqual(['b', 'a', 'c']);
  });

  it('should keep declaration order on a tie', () => {
    const answer: LlmDecisionChoiceAnswer = { type: 'choice', choice: 'a', probabilities: { a: 0.5, b: 0.5 } };
    expect(llmDecisionChoiceRanking(answer).map((x) => x.option)).toEqual(['a', 'b']);
  });
});

describe('mapLlmDecisionChoiceRows()', () => {
  it('should resolve the distribution back to the caller rows and drop what does not resolve', () => {
    const questions = { pick: llmChoiceQuestion('which?', { a: 'the a', b: 'the b' }) } as const;
    const answers = { pick: { type: 'choice', choice: 'a', probabilities: { a: 0.6, b: 0.4 } } } as never;
    const rows = mapLlmDecisionChoiceRows<typeof questions, 'pick', string>({ answers, question: 'pick', rowOf: (option) => (option === 'a' ? 'ROW-A' : null) });

    expect(rows).toEqual([{ row: 'ROW-A', probability: 0.6 }]);
  });
});

describe('llmDecisionChoiceOptionNames()', () => {
  it('should report the options in declaration order', () => {
    expect(llmDecisionChoiceOptionNames(llmChoiceQuestion('which?', { z: 'z', a: 'a' }))).toEqual(['z', 'a']);
  });
});

describe('llmDecisionStatePaths()', () => {
  it('should read backticked dot and index paths out of prose', () => {
    expect(llmDecisionStatePaths('Does `ticket.sender.email` match `messages[0].text`?')).toEqual(['ticket.sender.email', 'messages[0].text']);
  });

  it('should walk a structured entry and deduplicate', () => {
    const entry: LlmDecisionEntry = { question: 'compare `phrase`', inspect: ['`phrase`', '`rows[2].gloss`'] };
    expect(llmDecisionStatePaths(entry)).toEqual(['phrase', 'rows[2].gloss']);
  });

  it('should find nothing in an entry that names nothing', () => {
    expect(llmDecisionStatePaths('is it urgent?')).toEqual([]);
  });
});

describe('question maps', () => {
  it('should type the answers off the questions', () => {
    // A compile-level assertion: the value is unused, but the declaration would not compile if the
    // answer type were not derived from the question map.
    const questions = { urgency: llmNoulQuestion('is it urgent?') } satisfies LlmDecisionQuestions;
    expect(questions.urgency.type).toBe('noul');
  });
});

describe('LlmDecisionDeclarationError', () => {
  it('should name the declaration problem when no decision asked', () => {
    const error = new LlmDecisionDeclarationError(['No questions were declared.']);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('LlmDecisionDeclarationError');
    expect(error.errors).toEqual(['No questions were declared.']);
    expect(error.decision).toBeUndefined();
    expect(error.message).toBe('This decision cannot be asked as declared: No questions were declared.');
  });

  it('should name the decision that asked when one did', () => {
    const error = new LlmDecisionDeclarationError(['Question `a` cannot be asked: x.', 'Question `b` cannot be asked: y.'], 'pick-row');
    expect(error.decision).toBe('pick-row');
    expect(error.message).toBe('decision pick-row cannot be asked: Question `a` cannot be asked: x. Question `b` cannot be asked: y.');
  });
});
