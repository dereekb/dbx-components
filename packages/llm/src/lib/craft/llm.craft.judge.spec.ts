/**
 * The craft JUDGE: one decision call per dispatch over the judged notes, scripted — kept / cut at the floor, an
 * unavailable lane, no `decide`, a fault, a transport throw, the judge cap, and a state of only the referenced inputs.
 * One case runs a real dispatcher whose consuming capability has a completion route (the craft-judge path of B4).
 */

import { describe, expect, it } from 'vitest';
import { makeLlmScriptedDecisionStrategy, makeLlmScriptedStrategy } from '@dereekb/llm/test';
import { LlmDecisionAnswerFaultError } from '../decision/llm.decision.answer';
import { type LlmDecisionDispatchRequest } from '../decision/llm.decision.descriptor';
import { isLlmDecisionModelId } from '../decision/llm.decision.model';
import { type LlmDecisionAnswers, type LlmDecisionQuestions } from '../decision/llm.decision.question';
import { type LlmDecisionRequest, type LlmDecisionResult } from '../decision/llm.decision.strategy';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmDispatcher } from '../dispatch/llm.dispatcher';
import { makeLlmDispatcher } from '../dispatch/llm.dispatcher.pipeline';
import { makeLlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { composeLlmCapabilityPrompt } from '../prompt/llm.prompt.assembly';
import { type LlmPromptSite } from '../prompt/llm.prompt.site';
import { makeLlmTieredPromptTemplateResolver } from '../prompt/llm.prompt.template';
import { makeLlmCraftPromptContributor } from './llm.craft.contributor';
import { toLlmCraftJudgeInput, makeLlmCraftJudge } from './llm.craft.judge';
import { type LlmCraftNote } from './llm.craft.note';
import { DEFAULT_LLM_CRAFT_SITE_LIMITS, makeLlmCraftSiteRegistry } from './llm.craft.site';

const SITES = makeLlmCraftSiteRegistry({
  sites: {
    'product-page': { facts: { category: 'closed', brand: 'open', bundle: 'boolean' }, inputs: ['brief', 'notes'] },
    'support-reply': { facts: { channel: 'closed', tags: 'open' }, inputs: ['message'], limits: { maxChars: 2400, judgeInputMax: 20 } },
    'release-notes': { facts: { audience: 'closed' }, inputs: ['summary'] }
  }
});

const PAGE = { kind: 'product-page', facts: { category: 'apparel', brand: 'acme', bundle: true }, inputs: { brief: 'a winter coat with no logo' } } as const;

const ASK_BRIEF = '`brief` asks for a garment with no logo.';
const ASK_NOTES = '`notes` names a care label.';

/**
 * A loaded note with defaults (judged when `ask` is given).
 *
 * @param id - Its id.
 * @param overrides - Fields to override.
 * @returns The note.
 */
function note(id: string, overrides: Partial<LlmCraftNote> = {}): LlmCraftNote {
  return { id, title: id, sites: ['product-page'], where: { category: ['apparel'] }, floor: 0.6, unserved: 'omit', priority: 4, enabled: true, body: `${id.toUpperCase()} BODY`, tier: 'builtin', ...overrides };
}

const noul = (value: number) => ({ type: 'noul' as const, noul: value });

interface FakeDispatcherConfig {
  readonly answer?: (request: LlmDecisionRequest) => Readonly<Record<string, unknown>>;
  readonly throws?: Error;
}

/**
 * A dispatcher whose `decide` records each request, projects it and answers scripted Nouls.
 *
 * @param config - The script.
 * @returns The dispatcher and its sinks.
 */
function fakeDispatcher(config: FakeDispatcherConfig = {}) {
  const decided: LlmDecisionDispatchRequest[] = [];
  const projected: LlmDecisionRequest[] = [];
  const answer = config.answer ?? ((request: LlmDecisionRequest) => Object.fromEntries(Object.keys(request.questions).map((key) => [key, noul(0.9)])));
  const dispatcher: Pick<LlmDispatcher, 'decide'> = {
    decide: async <I, Q extends LlmDecisionQuestions>(request: LlmDecisionDispatchRequest<I, Q>): Promise<LlmDecisionResult<Q>> => {
      decided.push(request as unknown as LlmDecisionDispatchRequest);

      if (config.throws != null) {
        throw config.throws;
      }

      const asked = request.decision.asRequest({ input: request.input, model: 'vendor/decide-1' });
      projected.push(asked);
      return { model: 'vendor/decide-1', answers: answer(asked) as LlmDecisionAnswers<Q> };
    }
  };
  return { dispatcher, decided, projected };
}

/**
 * Compose a product-page site over `notes`.
 *
 * @param notes - The notes.
 * @param site - The site (its judge set).
 * @returns The composed prompt.
 */
function composeWith(notes: ReadonlyArray<LlmCraftNote>, site: LlmPromptSite) {
  const request: LlmDispatchRequest = { capability: 'summarize', renderLiveContext: () => [{ key: 'facts', text: 'facts: here' }], site };
  return composeLlmCapabilityPrompt({ request, descriptorOf: () => undefined, templateResolver: makeLlmTieredPromptTemplateResolver({ tiers: [] }), contributors: [makeLlmCraftPromptContributor({ sites: SITES, tiers: [notes] })] });
}

describe('toLlmCraftJudgeInput()', () => {
  it('carries only the inputs an asked note names, each clipped, and skips a note whose inputs the site lacks', () => {
    const long = 'x'.repeat(DEFAULT_LLM_CRAFT_SITE_LIMITS.judgeInputMax + 50);
    const input = toLlmCraftJudgeInput({ request: { kind: 'product-page', asked: [note('a', { ask: ASK_BRIEF }), note('b', { ask: ASK_NOTES })], inputs: { brief: long, summary: 'an input no ask names' } }, sites: SITES });

    expect(input?.notes.map((entry) => entry.id)).toEqual(['a']);
    expect(Object.keys(input?.inputs ?? {})).toEqual(['brief']);
    expect(input?.inputs['brief']).toHaveLength(DEFAULT_LLM_CRAFT_SITE_LIMITS.judgeInputMax);
    expect(input?.inputs['brief']?.endsWith('…')).toBe(true);
    expect(toLlmCraftJudgeInput({ request: { kind: 'product-page', asked: [note('b', { ask: ASK_NOTES })], inputs: { brief: 'here' } }, sites: SITES })).toBeUndefined();
  });

  it("clips to a site's own judgeInputMax, and answers nothing for an unknown kind", () => {
    const input = toLlmCraftJudgeInput({ request: { kind: 'support-reply', asked: [note('a', { sites: ['support-reply'], ask: '`message` is angry.' })], inputs: { message: 'my order arrived broken again' } }, sites: SITES });
    expect(input?.inputs['message']).toBe('my order arrived br…');
    expect(toLlmCraftJudgeInput({ request: { kind: 'poster', asked: [note('a', { ask: ASK_BRIEF })], inputs: { brief: 'x' } }, sites: SITES })).toBeUndefined();
  });
});

describe('makeLlmCraftJudge() through the craft contributor', () => {
  it('keeps a note AT its floor and cuts one under it, in ONE call with one Noul per note, stamped asked / kept', async () => {
    const { dispatcher, decided, projected } = fakeDispatcher({ answer: () => ({ n0: noul(0.6), n1: noul(0.59) }) });
    const notes = [note('kept', { ask: ASK_BRIEF, priority: 6 }), note('dropped', { ask: ASK_BRIEF })];
    const composed = await composeWith(notes, { ...PAGE, judge: makeLlmCraftJudge({ sites: SITES, dispatcher }) });

    expect(projected).toHaveLength(1);
    expect(Object.keys(projected[0].questions)).toEqual(['n0', 'n1']);
    expect(projected[0].state).toEqual({ brief: PAGE.inputs.brief });
    expect(decided[0].capability).toBe('summarize');
    expect(decided[0].stamp?.({ n0: noul(0.6), n1: noul(0.59) } as never)).toEqual({ craft: { asked: ['kept', 'dropped'], kept: ['kept'] } });
    expect(composed.contributions.filter((row) => row.origin.kind === 'craft').map((row) => [row.key, row.by, row.p])).toEqual([['kept', 'judge', 0.6]]);
    expect(composed.cut.map((row) => [row.key, row.cut, row.p])).toEqual([['dropped', 'floor', 0.59]]);
  });

  it('is served by the decision default model when the consuming capability has a COMPLETION route (a real dispatcher)', async () => {
    const requests: LlmDecisionRequest[] = [];
    const decisionStrategy = makeLlmScriptedDecisionStrategy({
      requests,
      script: (request) => {
        // the gateway's decision route refuses a completion model's slug
        if (!isLlmDecisionModelId(request.model)) {
          throw new Error(`the decision route refused '${request.model}'`);
        }

        return Object.fromEntries(Object.keys(request.questions).map((key) => [key, noul(0.9)]));
      }
    });
    const dispatcher = makeLlmDispatcher({
      strategies: makeLlmStrategyRegistry([makeLlmScriptedStrategy({ id: 'cap', replies: [] })]),
      defaultStrategyId: 'cap',
      defaultMaxOutputTokens: 1024,
      modelTiers: { fast: 'vendor/fast-text-model' },
      capabilityRoutes: new Map([['summarize', { model: 'vendor/routed-text-model' }]]),
      descriptorOf: () => undefined,
      templateResolver: makeLlmTieredPromptTemplateResolver({ tiers: [] }),
      decisions: { strategies: makeLlmStrategyRegistry([decisionStrategy]), defaultModel: 'typesafe/jev-1.14' }
    });
    const swallowed: string[] = [];
    const composed = await composeWith([note('kept', { ask: ASK_BRIEF })], { ...PAGE, judge: makeLlmCraftJudge({ sites: SITES, dispatcher, swallow: (site) => swallowed.push(site) }) });

    expect(requests.map((request) => request.model)).toEqual(['typesafe/jev-1.14']);
    expect(swallowed).toEqual([]);
    expect(composed.contributions.filter((row) => row.origin.kind === 'craft').map((row) => [row.key, row.by])).toEqual([['kept', 'judge']]);
  });

  it('asks nothing when unavailable: onUnavailable fires once and every judged note takes its unserved posture', async () => {
    const { dispatcher, decided } = fakeDispatcher();
    let unavailable = 0;
    const judge = makeLlmCraftJudge({ sites: SITES, dispatcher, available: () => false, onUnavailable: () => (unavailable += 1) });
    const composed = await composeWith([note('include', { ask: ASK_BRIEF, unserved: 'include' }), note('omit', { ask: ASK_BRIEF })], { ...PAGE, judge });

    expect(decided).toHaveLength(0);
    expect(unavailable).toBe(1);
    expect(composed.contributions.filter((row) => row.origin.kind === 'craft').map((row) => [row.key, row.by])).toEqual([['include', 'unserved']]);
    expect(composed.cut.map((row) => [row.key, row.cut])).toEqual([['omit', 'unserved']]);
  });

  it('asks nothing with no decide (or no dispatcher): unserved, and onUnavailable fires', async () => {
    for (const dispatcher of [{}, undefined]) {
      let unavailable = 0;
      const composed = await composeWith([note('a', { ask: ASK_BRIEF })], { ...PAGE, judge: makeLlmCraftJudge({ sites: SITES, dispatcher, onUnavailable: () => (unavailable += 1) }) });

      expect(composed.cut.map((row) => row.cut)).toEqual(['unserved']);
      expect(unavailable).toBe(1);
    }
  });

  it('swallows a fault or a transport throw and answers nothing (unserved)', async () => {
    for (const error of [new LlmDecisionAnswerFaultError([{ kind: 'answer-missing', question: 'n0', detail: 'scripted fault' }]), new Error('the socket went away')]) {
      const { dispatcher } = fakeDispatcher({ throws: error });
      const swallowed: string[] = [];
      const composed = await composeWith([note('a', { ask: ASK_BRIEF, unserved: 'include' })], { ...PAGE, judge: makeLlmCraftJudge({ sites: SITES, dispatcher, swallow: (site) => swallowed.push(site) }) });

      expect(swallowed).toEqual(['llm/craft-judge.decide']);
      expect(composed.contributions.filter((row) => row.origin.kind === 'craft').map((row) => row.by)).toEqual(['unserved']);
    }
  });

  it(`asks at most ${DEFAULT_LLM_CRAFT_SITE_LIMITS.judgeMax} notes; the rest are cut judge-cap and never asked`, async () => {
    const { dispatcher, projected } = fakeDispatcher();
    const judgeMax = DEFAULT_LLM_CRAFT_SITE_LIMITS.judgeMax;
    const notes = Array.from({ length: judgeMax + 2 }, (_, at) => note(`judged-${String(at).padStart(2, '0')}`, { ask: ASK_BRIEF, body: 'B' }));
    const composed = await composeWith(notes, { ...PAGE, judge: makeLlmCraftJudge({ sites: SITES, dispatcher }) });

    expect(Object.keys(projected[0].questions)).toHaveLength(judgeMax);
    expect(composed.cut.filter((row) => row.cut === 'judge-cap').map((row) => row.key)).toEqual(['judged-08', 'judged-09']);
  });

  it('makes no call when no note is judged, or no judged note names an input the site carries', async () => {
    const { dispatcher, decided } = fakeDispatcher();
    await composeWith([note('stable')], { ...PAGE, judge: makeLlmCraftJudge({ sites: SITES, dispatcher }) });
    await composeWith([note('notes', { ask: ASK_NOTES })], { ...PAGE, judge: makeLlmCraftJudge({ sites: SITES, dispatcher }) });
    expect(decided).toHaveLength(0);
  });
});
