/**
 * The dispatcher's DECISION LANE — the only path a decision reaches the recorder by. `decide` is left undefined when no
 * decision backend is registered (how a consumer branches back onto its text arm rather than throwing); one decision
 * records exactly one start and one call record under the CONSUMING capability and the decision strategy; the model
 * ladder is the capability ladder with only its bottom rung swapped for the decision default model.
 *
 * Not ported: the host's ledger fold of a decision call, and the host consumers that read the decision arm.
 */

import { describe, expect, it } from 'vitest';
import { makeScriptedLlmDecisionStrategy, makeScriptedLlmStrategy, type ScriptedLlmDecisionScript } from '@dereekb/llm/test';
import { llmDecisionChoiceAnswerOf, llmDecisionNoulAnswerOf } from '../decision/llm.decision.answer.builder';
import { defineLlmDecision } from '../decision/llm.decision.descriptor';
import { llmDecisionModelIssue } from '../decision/llm.decision.model';
import { llmChoiceQuestion, llmNoulQuestion } from '../decision/llm.decision.question';
import { type LlmDecisionRequest, type LlmDecisionStrategy, makeLlmDecisionStrategyRegistry } from '../decision/llm.decision.strategy';
import { type LlmModelTierMap } from '../model/llm.model.tier';
import { DEFAULT_LLM_PROMPT_LAYOUT } from '../prompt/llm.prompt.layout';
import { type LlmPromptTemplate, tieredLlmPromptTemplateResolver } from '../prompt/llm.prompt.template';
import { type LlmCallContext, makeLlmCallContext } from '../record/llm.call.context';
import { type LlmCallRecord, type LlmCallStartRecord } from '../record/llm.call.record';
import { makeLlmDispatchTapRegistry } from '../record/llm.dispatch.tap';
import { type LlmSwallowSiteId } from '../record/llm.swallow';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
import { makeLlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { LLM_DECIDE_STAMP_SWALLOW_SITE } from './llm.dispatch.decision';
import { type LlmDispatchRequest } from './llm.dispatch.request';
import { type LlmDispatcherConfig, type LlmDispatcherDecisionConfig, type LlmDispatchRecorder } from './llm.dispatcher.config';
import { makeLlmDispatcher } from './llm.dispatcher.pipeline';

// MARK: Fixtures
const TEMPLATES: ReadonlyArray<LlmPromptTemplate> = [
  { key: 'instructions', role: 'instructions', text: 'B-CAP' },
  { key: 'context', role: 'context', text: 'C-CTX\n{{liveContext}}' }
];

const RESOLVER = tieredLlmPromptTemplateResolver({ tiers: [{ source: 'defaults', templates: TEMPLATES }] });

const TIERS: LlmModelTierMap = { fast: 'some/fast-text-model', strong: 'some/strong-text-model' };

const DECISION_MODEL = 'typesafe/jev-1.14';

const PICK_ROW = defineLlmDecision({
  decision: 'PickRow',
  describe: 'pick the row a phrase names',
  state: (input: { readonly phrase: string }) => ({ phrase: input.phrase }),
  questions: () => ({ row: llmChoiceQuestion('which row?', { 'row-a': null, 'row-b': null }), any: llmNoulQuestion('does any row fit?') })
});

const SCRIPT: ScriptedLlmDecisionScript = () => ({ row: llmDecisionChoiceAnswerOf({ options: ['row-a', 'row-b'], choice: 'row-b', confidence: 0.82 }), any: llmDecisionNoulAnswerOf(0.93) });

interface HostFields {
  readonly host?: string;
}

interface SetupConfig extends Partial<LlmDispatcherConfig<LlmDispatchRequest, LlmDispatchResult, HostFields>> {
  /**
   * The decision backends; absent ⇒ one scripted `account-a`. `null` ⇒ no `decisions` block at all.
   */
  readonly backends?: ReadonlyArray<LlmDecisionStrategy> | null;
  /**
   * Overrides of the `decisions` block.
   */
  readonly decisionsConfig?: Partial<LlmDispatcherDecisionConfig<HostFields>>;
}

function setup(config: SetupConfig = {}) {
  const { backends, decisionsConfig, ...rest } = config;
  const requests: LlmDecisionRequest[] = [];
  const starts: LlmCallStartRecord<HostFields>[] = [];
  const calls: LlmCallRecord<HostFields>[] = [];
  const recorder: LlmDispatchRecorder<LlmDispatchRequest, HostFields> = { recordCallStart: (record) => starts.push(record), recordCall: (record) => calls.push(record) };
  const strategies = backends === undefined ? [makeScriptedLlmDecisionStrategy({ id: 'account-a', requests, script: SCRIPT })] : backends;
  const dispatcher = makeLlmDispatcher<LlmDispatchRequest, LlmDispatchResult, HostFields>({
    strategies: makeLlmStrategyRegistry([makeScriptedLlmStrategy({ id: 'cap', replies: [] })]),
    defaultStrategyId: 'cap',
    defaultMaxOutputTokens: 1024,
    modelTiers: TIERS,
    descriptorOf: () => undefined,
    templateResolver: RESOLVER,
    transportBackoff: () => 0,
    recorder,
    ...(strategies == null ? {} : { decisions: { strategies: makeLlmDecisionStrategyRegistry(strategies), defaultModel: DECISION_MODEL, ...decisionsConfig } }),
    ...rest
  });
  return { dispatcher, requests, starts, calls };
}

/**
 * A scripted backend that records which instance served each call.
 */
function namedBackend(id: string, servedBy: string[]): LlmDecisionStrategy {
  return makeScriptedLlmDecisionStrategy({
    id,
    script: (request) => {
      servedBy.push(id);
      return SCRIPT(request);
    }
  });
}

function pauseGate(paused: boolean) {
  let isPaused = paused;
  let resume: () => void = () => undefined;
  let waited = 0;
  const gate = {
    isPaused: () => isPaused,
    waitUntilResumed: (signal?: AbortSignal) =>
      new Promise<void>((resolve) => {
        waited += 1;
        resume = resolve;
        signal?.addEventListener('abort', () => resolve(), { once: true });
      })
  };
  return {
    gate,
    resume: () => {
      isPaused = false;
      resume();
    },
    waited: () => waited
  };
}

function spanNamesOf(context: LlmCallContext): ReadonlyArray<string> {
  const profile = context.profile();
  const all: string[] = [];
  const walk = (node: typeof profile) => {
    all.push(...node.spans.map((span) => span.name));
    node.children.forEach(walk);
  };
  walk(profile);
  return all;
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// MARK: Specs
describe('makeLlmDispatcher() decision lane', () => {
  describe('decide', () => {
    it('should leave decide and the counters undefined with no decisions block or an empty registry', () => {
      const without = setup({ backends: null }).dispatcher;
      const empty = setup({ backends: [] }).dispatcher;

      for (const dispatcher of [without, empty]) {
        expect(dispatcher).not.toHaveProperty('decide');
        expect(dispatcher).not.toHaveProperty('decisionsSpent');
        expect(dispatcher).not.toHaveProperty('resetDecisionsSpent');
        expect(dispatcher).not.toHaveProperty('claimDecisionBudgetWarning');
      }
    });

    it("should answer a declared decision through the declaration's own projection", async () => {
      const { dispatcher, requests } = setup();
      const result = await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'on the pile' } });

      expect(result?.answers.row.choice).toBe('row-b');
      expect(result?.answers.any.noul).toBe(0.93);
      expect(requests[0].state).toEqual({ phrase: 'on the pile' });
    });

    it('should route to the FIRST registered backend by default, to a pinned one when pinned, and leave no lane for a missing pin', async () => {
      const servedBy: string[] = [];
      const backends = [namedBackend('first', servedBy), namedBackend('second', servedBy), namedBackend('third', servedBy)];
      const preferred = setup({ backends }).dispatcher;
      const pinned = setup({ backends, decisionsConfig: { strategyId: 'third' } }).dispatcher;
      const missing = setup({ backends, decisionsConfig: { strategyId: 'fourth' } }).dispatcher;

      await preferred.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });
      await pinned.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(servedBy).toEqual(['first', 'third']);
      expect(missing).not.toHaveProperty('decide');
    });

    it('should fall the model ladder through to the decision default model, never to the text tier map', async () => {
      const { dispatcher, requests } = setup();
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(requests[0].model).toBe(DECISION_MODEL);
    });

    it('should refuse a default model that is not a decision model, at construction', () => {
      const build = (defaultModel: string) => () => setup({ decisionsConfig: { defaultModel } });

      expect(build('openai/gpt-5.1')).toThrow(`llm dispatcher: ${llmDecisionModelIssue('openai/gpt-5.1')}.`);
      expect(build('typesafe/jev-latest')).not.toThrow();
    });

    it('should honour every rung ABOVE the bottom one exactly as a capability does', async () => {
      const { dispatcher, requests } = setup();
      const pinnedModel = defineLlmDecision({ ...PICK_ROW.descriptor, model: 'typesafe/jev-pinned' });

      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' }, model: 'typesafe/jev-next' });
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' }, tier: 'strong' });
      await dispatcher.decide?.({ capability: 'PickCap', decision: pinnedModel, input: { phrase: 'x' } });

      expect(requests.map((request) => request.model)).toEqual(['typesafe/jev-next', 'some/strong-text-model', 'typesafe/jev-pinned']);
    });
  });

  describe('records', () => {
    it('should record ONE start and ONE call record under the CONSUMING capability and the decision strategy', async () => {
      const { dispatcher, starts, calls } = setup();
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'on the pile' } });

      expect(starts).toHaveLength(1);
      expect(calls).toHaveLength(1);
      expect(starts[0]).toMatchObject({ capability: 'PickCap', model: DECISION_MODEL, strategyId: 'account-a', strategyKind: 'scripted-decision' });
      expect(calls[0].capability).toBe('PickCap');
      expect(calls[0].result).toMatchObject({ capability: 'PickCap', strategyId: 'account-a', strategyKind: 'scripted-decision', usage: { cost: 0 } });
    });

    it('should record the decision STATE and its QUESTIONS as two live-slot segments, and the decision key', async () => {
      const { dispatcher, calls } = setup();
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'on the pile' } });
      const segments = calls[0].segments ?? [];

      expect(segments.map((segment) => segment.id)).toEqual(['live', 'live']);
      expect(segments.map((segment) => segment.origin)).toEqual([
        { kind: 'decision', decision: 'PickRow', part: 'state' },
        { kind: 'decision', decision: 'PickRow', part: 'questions' }
      ]);
      expect(JSON.parse(segments[0].promptSegment)).toEqual({ phrase: 'on the pile' });

      const questions = JSON.parse(segments[1].promptSegment) as Readonly<Record<string, { readonly instructions?: string; readonly options?: Readonly<Record<string, unknown>> }>>;
      expect(Object.keys(questions)).toEqual(['row', 'any']);
      expect(Object.keys(questions['row'].options ?? {})).toEqual(['row-a', 'row-b']);
      expect(questions['any'].instructions).toBe('does any row fit?');
      expect(calls[0].decision).toBe('PickRow');
    });

    it("should record the segments under the layout's live slot id", async () => {
      const layout = DEFAULT_LLM_PROMPT_LAYOUT.map((slot) => (slot.role === 'live' ? { ...slot, id: 'D' } : slot));
      const { dispatcher, calls } = setup({ layout });
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(calls[0].segments?.map((segment) => segment.id)).toEqual(['D', 'D']);
    });

    it("should land the host's record fields on both records, and the stage on the call record", async () => {
      const { dispatcher, starts, calls } = setup({ decisionsConfig: { recordFieldsOf: ({ kind, request }) => ({ host: `${kind}:${request.capability}` }) } });

      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' }, stage: 2 });
      await dispatcher.decide?.({ capability: 'OtherCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(starts.map((record) => record.host)).toEqual(['start:PickCap', 'start:OtherCap']);
      expect(calls.map((record) => record.host)).toEqual(['call:PickCap', 'call:OtherCap']);
      expect(calls.map((record) => record.stage)).toEqual([2, undefined]);
    });

    it("should record the request's stamp", async () => {
      const { dispatcher, calls } = setup();
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' }, stamp: (answers) => ({ row: answers.row.choice }) });

      expect(calls[0].stamp).toEqual({ row: 'row-b' });
    });

    it('should swallow a throwing stamp at llm/decide.stamp and still return the answers', async () => {
      const swallows: LlmSwallowSiteId[] = [];
      const { dispatcher, calls } = setup({ swallow: (site) => swallows.push(site) });
      const result = await dispatcher.decide?.({
        capability: 'PickCap',
        decision: PICK_ROW,
        input: { phrase: 'x' },
        stamp: () => {
          throw new Error('stamp broke');
        }
      });

      expect(result?.answers.row.choice).toBe('row-b');
      expect(swallows).toEqual([LLM_DECIDE_STAMP_SWALLOW_SITE]);
      expect(calls).toHaveLength(1);
      expect(calls[0]).not.toHaveProperty('stamp');
    });

    it('should mint the context through decisions.newCallContext and time the decide span on it', async () => {
      const contexts: LlmCallContext[] = [];
      const labels: string[] = [];
      const { dispatcher } = setup({
        decisionsConfig: {
          newCallContext: ({ label }) => {
            labels.push(label);
            const context = makeLlmCallContext({ label, timing: true });
            contexts.push(context);
            return context;
          }
        }
      });
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(labels).toEqual(['PickCap']);
      expect(spanNamesOf(contexts[0])).toContain('decide');
    });

    it('should fire no tap', async () => {
      const fired: string[] = [];
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      taps.addTap({ id: 't', onDispatch: () => void fired.push('dispatch'), onDecodeFailure: () => void fired.push('decode-failure'), onDispatchComplete: () => void fired.push('complete') });
      const { dispatcher, calls } = setup({ taps });
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(calls).toHaveLength(1);
      expect(fired).toEqual([]);
    });
  });

  describe('control', () => {
    it('should park while paused BEFORE the start record', async () => {
      const pause = pauseGate(true);
      const { dispatcher, starts, requests } = setup({ pause: pause.gate });
      const pending = dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });
      await flush();

      expect(pause.waited()).toBe(1);
      expect(starts).toHaveLength(0);
      expect(requests).toHaveLength(0);

      pause.resume();
      await pending;

      expect(starts).toHaveLength(1);
      expect(requests).toHaveLength(1);
    });

    it('should forward the cancellation signal COMBINED with the request signal to strategy.decide', async () => {
      const signals: AbortSignal[] = [];
      const inner = makeScriptedLlmDecisionStrategy({ id: 'observer', script: SCRIPT });
      const observer: LlmDecisionStrategy = {
        ...inner,
        decide: (request, options) => {
          if (options?.signal != null) {
            signals.push(options.signal);
          }

          return inner.decide(request, options);
        }
      };
      const cancellation = new AbortController();
      const { dispatcher } = setup({ backends: [observer], cancellationSignal: cancellation.signal });
      const first = new AbortController();
      const second = new AbortController();

      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' }, signal: first.signal });
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' }, signal: second.signal });
      expect(signals).toHaveLength(2);

      first.abort();
      expect(signals[0].aborted).toBe(true);
      expect(signals[1].aborted).toBe(false);

      cancellation.abort();
      expect(signals[1].aborted).toBe(true);
    });
  });

  describe('the one decisions counter', () => {
    it('should count EVERY served decision, whichever capability asked', async () => {
      const { dispatcher } = setup();

      expect(dispatcher.decisionsSpent?.()).toBe(0);

      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });
      await dispatcher.decide?.({ capability: 'OtherCap', decision: PICK_ROW, input: { phrase: 'y' } });

      expect(dispatcher.decisionsSpent?.()).toBe(2);
    });

    it('should spend the budget on a transport throw too: the counter bounds what is SENT', async () => {
      const throwing = makeScriptedLlmDecisionStrategy({
        id: 'account-a',
        script: () => {
          throw new Error('transport down');
        }
      });
      const { dispatcher, starts, calls } = setup({ backends: [throwing] });

      await expect(dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } })).rejects.toThrow('transport down');

      expect(dispatcher.decisionsSpent?.()).toBe(1);
      expect(starts).toHaveLength(1);
      expect(calls).toHaveLength(0);
    });

    it('should zero the counter on resetDecisionsSpent', async () => {
      const { dispatcher } = setup();
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(dispatcher.decisionsSpent?.()).toBe(1);

      dispatcher.resetDecisionsSpent?.();

      expect(dispatcher.decisionsSpent?.()).toBe(0);
    });

    it('should claim the budget warning ONCE until a reset re-arms it', () => {
      const { dispatcher } = setup();

      expect(dispatcher.claimDecisionBudgetWarning?.()).toBe(true);
      expect(dispatcher.claimDecisionBudgetWarning?.()).toBe(false);
      expect(dispatcher.claimDecisionBudgetWarning?.()).toBe(false);

      dispatcher.resetDecisionsSpent?.();

      expect(dispatcher.claimDecisionBudgetWarning?.()).toBe(true);
      expect(dispatcher.claimDecisionBudgetWarning?.()).toBe(false);
    });
  });
});
