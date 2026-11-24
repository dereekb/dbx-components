/**
 * `defineLlmDecision` — the DECLARATION gate and the pure projection under it. Proves: `asRequest` is a
 * deterministic function of the input alone (the seam every free spec reads, and what makes a decision's whole
 * billed surface assertable without a backend); the 255-option Choice cap and the 10-level Score cap FAIL AT
 * THE DECLARATION rather than on the wire, naming the question; an empty Choice, a one-level Score, a blank
 * `instructions` on ANY primitive and an EMPTY question map fail the same way (the guard is
 * `validateLlmDecisionQuestions`; the error names the decision); and a STRUCTURED declaration
 * (instructions / criteria / levels / means as JSON) projects VERBATIM while a plain-string declaration projects
 * byte-identically to before structure existed (the no-regression pin).
 */

import { describe, expect, expectTypeOf, it } from 'vitest';
import { defineLlmDecision, type LlmDecision, type LlmDecisionDescriptor } from './llm.decision.descriptor';
import { LLM_DECISION_CHOICE_OPTIONS_MAX, LLM_DECISION_SCORE_LEVELS_MAX, LlmDecisionDeclarationError, llmChoiceQuestion, type LlmDecisionAnswers, type LlmDecisionQuestions, type LlmDecisionScoreLevels, llmNoulQuestion, llmScoreQuestion } from './llm.decision.question';

/**
 * A Choice over `count` synthetic row ids — the shape a catalog decision builds at runtime.
 *
 * @param count - How many options to declare.
 * @returns The option map.
 */
function rows(count: number): Record<string, string> {
  return Object.fromEntries(Array.from({ length: count }, (_value, index) => [`row-${index}`, `the ${index}th row`]));
}

const PICK_ROW = defineLlmDecision({
  decision: 'pick-row',
  describe: 'pick the catalog row a phrase names',
  state: (input: { readonly phrase: string; readonly count: number }) => ({ phrase: input.phrase }),
  questions: (input: { readonly phrase: string; readonly count: number }) => ({
    row: llmChoiceQuestion('which row does the phrase name?', rows(input.count)),
    any: llmNoulQuestion('at least one row above means what the phrase describes.')
  })
});

/**
 * A Score over `count` synthetic levels — the shape a rubric built at runtime takes.
 *
 * @param count - How many levels to declare.
 * @returns The Score question.
 */
function scoreOver(count: number) {
  return llmScoreQuestion('how far along?', Array.from({ length: count }, (_value, index) => `level ${index}`) as unknown as LlmDecisionScoreLevels);
}

describe('defineLlmDecision', () => {
  it('projects an input into a request deterministically, with no backend anywhere near it', () => {
    const first = PICK_ROW.asRequest({ input: { phrase: 'on the pile', count: 3 }, model: 'typesafe/jev-1.14' });
    const second = PICK_ROW.asRequest({ input: { phrase: 'on the pile', count: 3 }, model: 'typesafe/jev-1.14' });

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.state).toEqual({ phrase: 'on the pile' });
    expect(first.model).toBe('typesafe/jev-1.14');
    expect(Object.keys(first.questions)).toEqual(['row', 'any']);
  });

  it('declares exactly the cap without complaint', () => {
    expect(() => PICK_ROW.asRequest({ input: { phrase: 'x', count: LLM_DECISION_CHOICE_OPTIONS_MAX }, model: 'm' })).not.toThrow();
  });

  it('refuses a Choice past the cap AT THE DECLARATION, naming the question', () => {
    let thrown: unknown;

    try {
      PICK_ROW.asRequest({ input: { phrase: 'x', count: LLM_DECISION_CHOICE_OPTIONS_MAX + 1 }, model: 'm' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(LlmDecisionDeclarationError);
    expect((thrown as LlmDecisionDeclarationError).errors).toEqual([expect.stringContaining('`row`')]);
    expect((thrown as LlmDecisionDeclarationError).decision).toBe('pick-row');
    expect((thrown as Error).message).toContain('narrow in two stages');
  });

  it('refuses an EMPTY question map, naming the decision: a consumer with nothing to ask short-circuits first', () => {
    const none = defineLlmDecision({ decision: 'Nothing', describe: 'no questions', state: () => ({ phrase: 'x' }), questions: () => ({}) });

    expect(() => none.asRequest({ input: undefined, model: 'm' })).toThrow(/decision Nothing cannot be asked: No questions were declared/);
  });

  it('refuses a Choice declaring no options: it asks nothing', () => {
    expect(() => PICK_ROW.asRequest({ input: { phrase: 'x', count: 0 }, model: 'm' })).toThrow(LlmDecisionDeclarationError);
  });

  it('refuses a Score with fewer than two levels and a blank Noul', () => {
    const thin = defineLlmDecision({
      decision: 'Thin',
      describe: 'a malformed rubric',
      state: () => 'x',
      questions: () => ({ level: { ...llmScoreQuestion('how?', ['only'] as unknown as ['a', 'b']), levels: ['only'] } as unknown as LlmDecisionQuestions[string] })
    });
    const blank = defineLlmDecision({ decision: 'Blank', describe: 'a blank noul', state: () => 'x', questions: () => ({ ok: llmNoulQuestion('   ') }) });

    expect(() => thin.asRequest({ input: undefined, model: 'm' })).toThrow(LlmDecisionDeclarationError);
    expect(() => blank.asRequest({ input: undefined, model: 'm' })).toThrow(LlmDecisionDeclarationError);
  });

  it('declares a Score of exactly the level cap without complaint', () => {
    const wide = defineLlmDecision({ decision: 'Wide', describe: 'a rubric at the cap', state: () => 'x', questions: () => ({ level: scoreOver(LLM_DECISION_SCORE_LEVELS_MAX) }) });

    expect(LLM_DECISION_SCORE_LEVELS_MAX).toBe(10);
    expect(() => wide.asRequest({ input: undefined, model: 'm' })).not.toThrow();
  });

  it('refuses a Score past the level cap AT THE DECLARATION, naming the cap and saying to merge', () => {
    const wide = defineLlmDecision({ decision: 'Wide', describe: 'a rubric past the cap', state: () => 'x', questions: () => ({ level: scoreOver(LLM_DECISION_SCORE_LEVELS_MAX + 1) }) });
    let thrown: unknown;

    try {
      wide.asRequest({ input: undefined, model: 'm' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(LlmDecisionDeclarationError);
    expect((thrown as LlmDecisionDeclarationError).errors).toEqual([expect.stringContaining('`level`')]);
    expect((thrown as Error).message).toContain('at most 10');
    expect((thrown as Error).message).toContain('merge');
  });

  it('refuses a blank `instructions` on EVERY primitive, structured or not: the id is never sent', () => {
    const declare = (question: LlmDecisionQuestions[string]) => defineLlmDecision({ decision: 'Blank', describe: 'blank', state: () => 'x', questions: () => ({ q: question }) });

    expect(() => declare(llmChoiceQuestion('', { a: 'A', b: 'B' })).asRequest({ input: undefined, model: 'm' })).toThrow(/no instructions/);
    expect(() => declare(llmScoreQuestion('   ', ['low', 'high'])).asRequest({ input: undefined, model: 'm' })).toThrow(/no instructions/);
    expect(() => declare(llmNoulQuestion({})).asRequest({ input: undefined, model: 'm' })).toThrow(/no instructions/);
    expect(() => declare(llmNoulQuestion([])).asRequest({ input: undefined, model: 'm' })).toThrow(/no instructions/);
  });

  it('projects a STRUCTURED declaration verbatim: instructions, contrastive criteria, described levels, means', () => {
    const structured = defineLlmDecision({
      decision: 'Structured',
      describe: 'every surface as JSON',
      state: (input: { readonly ticket: string }) => ({ ticket: input.ticket }),
      questions: () => ({
        team: llmChoiceQuestion(
          { question: 'Which team should handle `ticket`?', focus: "Classify the customer's primary request, not every topic mentioned." },
          {
            billing: { what: 'Charges, invoices, refunds', not_for: 'Order tracking', examples: ['I was charged twice'] },
            orders: { what: 'Order status, delivery', not_for: 'Charges', examples: ['Where is my package?'] }
          }
        ),
        focus: llmScoreQuestion({ question: 'How focused is `ticket` on one change?' }, [
          { what: 'One change, clearly stated', signals: ['a single fix'] },
          { what: 'Several independent changes', signals: ['"also"', '"while I was in there"'] }
        ]),
        credential: llmNoulQuestion({ question: 'Does `ticket` ask for a credential?', inspect: 'ticket' }, { true: { what: 'asks for a password or code', examples: ['Reply with your password'] }, false: { what: 'no credential requested', examples: ['Reset it from settings'] } })
      })
    });
    const request = structured.asRequest({ input: { ticket: 'charged twice' }, model: 'm' });

    expect(JSON.stringify(request.questions)).toBe(
      JSON.stringify({
        team: {
          type: 'choice',
          instructions: { question: 'Which team should handle `ticket`?', focus: "Classify the customer's primary request, not every topic mentioned." },
          options: { billing: { what: 'Charges, invoices, refunds', not_for: 'Order tracking', examples: ['I was charged twice'] }, orders: { what: 'Order status, delivery', not_for: 'Charges', examples: ['Where is my package?'] } }
        },
        focus: {
          type: 'score',
          instructions: { question: 'How focused is `ticket` on one change?' },
          levels: [
            { what: 'One change, clearly stated', signals: ['a single fix'] },
            { what: 'Several independent changes', signals: ['"also"', '"while I was in there"'] }
          ]
        },
        credential: { type: 'noul', instructions: { question: 'Does `ticket` ask for a credential?', inspect: 'ticket' }, means: { true: { what: 'asks for a password or code', examples: ['Reply with your password'] }, false: { what: 'no credential requested', examples: ['Reset it from settings'] } } }
      })
    );
    // The option KEYS still type the answer space: the structure is the description, not the option.
    expect(Object.keys(request.questions.team.options)).toEqual(['billing', 'orders']);
  });

  it('projects a plain-string declaration BYTE-IDENTICALLY to before structure existed (the no-regression pin)', () => {
    expect(JSON.stringify(PICK_ROW.asRequest({ input: { phrase: 'on the pile', count: 3 }, model: 'typesafe/jev-1.14' }))).toBe(
      '{"state":{"phrase":"on the pile"},"questions":{"row":{"type":"choice","instructions":"which row does the phrase name?","options":{"row-0":"the 0th row","row-1":"the 1th row","row-2":"the 2th row"}},"any":{"type":"noul","instructions":"at least one row above means what the phrase describes."}},"model":"typesafe/jev-1.14"}'
    );
  });

  it('runs one decision against a backend through the same projection', async () => {
    const seen: string[] = [];
    const result = await PICK_ROW.decide({
      strategy: {
        id: 'fake',
        describe: 'fake',
        decide: async (request) => {
          seen.push(JSON.stringify(request.state));
          return { model: request.model, answers: { row: { type: 'choice', choice: 'row-1' }, any: { type: 'noul', noul: 0.9 } } as unknown as LlmDecisionAnswers<never> };
        }
      },
      input: { phrase: 'on the pile', count: 2 },
      model: 'm'
    });

    expect(seen).toEqual(['{"phrase":"on the pile"}']);
    expect(result.answers.row.choice).toBe('row-1');
  });
});

/**
 * A host's descriptor extension — the shape a host names through its own define wrapper.
 */
interface HostDecisionDescriptor<I, Q extends LlmDecisionQuestions> extends LlmDecisionDescriptor<I, Q> {
  readonly aspects?: ReadonlyArray<'scale' | 'fit'>;
}

const defineHostDecision = <I, Q extends LlmDecisionQuestions>(descriptor: HostDecisionDescriptor<I, Q>) => defineLlmDecision<I, Q, HostDecisionDescriptor<I, Q>>(descriptor);

interface HolderInput {
  readonly holder: string;
  readonly size: number;
}

describe('defineLlmDecision() types', () => {
  const hostDescriptor: HostDecisionDescriptor<HolderInput, { readonly fits: ReturnType<typeof llmNoulQuestion> }> = {
    decision: 'holder-fit',
    describe: 'does the item fit the holder',
    aspects: ['scale', 'fit'],
    state: (input: HolderInput) => ({ holder: input.holder }),
    questions: (input) => ({ fits: llmNoulQuestion(`the item fits a ${input.size.toFixed(0)}cm holder.`) })
  };

  it('keeps a host descriptor extension on the decision, by identity', () => {
    const decision = defineHostDecision(hostDescriptor);

    expectTypeOf(decision.descriptor.aspects).toEqualTypeOf<ReadonlyArray<'scale' | 'fit'> | undefined>();
    expectTypeOf(decision).toExtend<LlmDecision<HolderInput, { readonly fits: ReturnType<typeof llmNoulQuestion> }>>();
    expect(decision.descriptor).toBe(hostDescriptor);
    expect(decision.descriptor.aspects).toEqual(['scale', 'fit']);
  });

  it('infers the input and the questions through a host wrapper call site with an unannotated questions param', () => {
    const decision = defineHostDecision({
      decision: 'holder-fit',
      describe: 'does the item fit the holder',
      aspects: ['fit'],
      state: (input: HolderInput) => ({ holder: input.holder }),
      questions: (input) => ({ fits: llmNoulQuestion(`the item fits a ${input.size.toFixed(0)}cm holder.`) })
    });

    expectTypeOf<Parameters<typeof decision.asRequest>[0]['input']>().toEqualTypeOf<HolderInput>();
    expectTypeOf(decision.descriptor.aspects).toEqualTypeOf<ReadonlyArray<'scale' | 'fit'> | undefined>();
    expect(decision.asRequest({ input: { holder: 'cup', size: 4 }, model: 'm' }).questions.fits.type).toBe('noul');
  });

  it('infers the input and a Choice literal option union on a bare call', () => {
    const decision = defineLlmDecision({
      decision: 'route-ticket',
      describe: 'route a support ticket',
      state: (input: { readonly ticket: string }) => ({ ticket: input.ticket }),
      questions: () => ({ team: llmChoiceQuestion('which team owns it?', { billing: 'billing', technical: 'technical' }) })
    });

    type Questions = ReturnType<typeof decision.asRequest>['questions'];

    expectTypeOf<Parameters<typeof decision.asRequest>[0]['input']>().toEqualTypeOf<{ readonly ticket: string }>();
    expectTypeOf<LlmDecisionAnswers<Questions>['team']['choice']>().toEqualTypeOf<'billing' | 'technical'>();
    expectTypeOf(decision.descriptor).toEqualTypeOf<LlmDecisionDescriptor<{ readonly ticket: string }, Questions>>();
  });

  it('keeps the excess-property check on a bare call', () => {
    const decision = defineLlmDecision({
      decision: 'holder-fit',
      describe: 'does the item fit the holder',
      // @ts-expect-error a bare call's descriptor is the base type, so a host field is an excess property
      aspects: ['scale'],
      state: (input: HolderInput) => ({ holder: input.holder }),
      questions: () => ({ fits: llmNoulQuestion('the item fits the holder.') })
    });

    expect(decision.descriptor.decision).toBe('holder-fit');
  });
});
