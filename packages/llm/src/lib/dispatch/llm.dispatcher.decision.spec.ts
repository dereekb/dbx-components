/**
 * The dispatcher's DECISION LANE — the only path a decision reaches the recorder by. `decide` is left undefined when no
 * decision backend is registered (how a consumer branches back onto its text arm rather than throwing); one decision
 * records exactly one start and one call record under the CONSUMING capability and the decision strategy, through the
 * dispatcher's shared hooks (`lane: 'decision'`) and taps; the model ladder is the capability ladder with its bottom
 * rung swapped for the decision default model, a completion route skipped, and every slug checked per call; a
 * retryable transport failure is resent up to `decisions.maxAttempts` sends. The host's ledger fold of a decision
 * call and the host consumers that read the decision arm are out of scope.
 */

import { describe, expect, it, vi } from 'vitest';
import { makeLlmDecisionChoiceAnswer, makeLlmDecisionNoulAnswer, makeLlmScriptedDecisionStrategy, makeLlmScriptedStrategy, type LlmScriptedDecisionScript } from '@dereekb/llm/test';
import { LlmDecisionAnswerFaultError } from '../decision/llm.decision.answer';
import { defineLlmDecision } from '../decision/llm.decision.descriptor';
import { llmDecisionModelIssue } from '../decision/llm.decision.model';
import { llmChoiceQuestion, llmNoulQuestion } from '../decision/llm.decision.question';
import { type LlmDecisionRequest, type LlmDecisionStrategy, LlmDecisionTransportError } from '../decision/llm.decision.strategy';
import { type LlmModelTierMap } from '../model/llm.model.tier';
import { estimateLlmTokens } from '../prompt/llm.prompt.budget';
import { DEFAULT_LLM_PROMPT_LAYOUT } from '../prompt/llm.prompt.layout';
import { type LlmPromptTemplate, makeLlmTieredPromptTemplateResolver } from '../prompt/llm.prompt.template';
import { type LlmCallContext, makeLlmCallContext } from '../record/llm.call.context';
import { type LlmCallRecord, type LlmCallStartRecord } from '../record/llm.call.record';
import { type LlmDispatchCompleteTapEvent, type LlmDispatchStartTapEvent, makeLlmDispatchTapRegistry } from '../record/llm.dispatch.tap';
import { type LlmSwallowSiteId } from '../record/llm.swallow';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
import { makeLlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { type LlmCallBillReader } from '../strategy/llm.call.bill';
import { reconcileLlmCallBills } from '../usage/llm.bill.reconcile';
import { toLlmCallLogPayload } from '../record/llm.call.payload';
import { type LlmDispatchTransportBackoffParams, llmTransportBackoffMs } from './llm.dispatch.control';
import { LLM_DECIDE_STAMP_SWALLOW_SITE } from './llm.dispatch.decision';
import { type LlmDispatchRequest } from './llm.dispatch.request';
import { type LlmDispatcherConfig, type LlmDispatcherDecisionConfig, type LlmDispatchLane, type LlmDispatchRecorder } from './llm.dispatcher.config';
import { makeLlmDispatcher } from './llm.dispatcher.pipeline';

// MARK: Fixtures
const TEMPLATES: ReadonlyArray<LlmPromptTemplate> = [
  { key: 'instructions', role: 'instructions', text: 'B-CAP' },
  { key: 'context', role: 'context', text: 'C-CTX\n{{liveContext}}' }
];

const RESOLVER = makeLlmTieredPromptTemplateResolver({ tiers: [{ source: 'defaults', templates: TEMPLATES }] });

const TIERS: LlmModelTierMap = { fast: 'some/fast-text-model', strong: 'some/strong-text-model', judge: 'typesafe/jev-judge' };

const DECISION_MODEL = 'typesafe/jev-1.14';

const PICK_ROW = defineLlmDecision({
  decision: 'PickRow',
  describe: 'pick the row a phrase names',
  state: (input: { readonly phrase: string }) => ({ phrase: input.phrase }),
  questions: () => ({ row: llmChoiceQuestion('which row?', { 'row-a': null, 'row-b': null }), any: llmNoulQuestion('does any row fit?') })
});

const SCRIPT: LlmScriptedDecisionScript = () => ({ row: makeLlmDecisionChoiceAnswer({ options: ['row-a', 'row-b'], choice: 'row-b', confidence: 0.82 }), any: makeLlmDecisionNoulAnswer(0.93) });

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
  readonly decisionsConfig?: Partial<LlmDispatcherDecisionConfig>;
  /**
   * The recorder's root-context minting.
   */
  readonly newCallContext?: LlmDispatchRecorder<LlmDispatchRequest, HostFields>['newCallContext'];
}

function setup(config: SetupConfig = {}) {
  const { backends, decisionsConfig, newCallContext, ...rest } = config;
  const requests: LlmDecisionRequest[] = [];
  const starts: LlmCallStartRecord<HostFields>[] = [];
  const calls: LlmCallRecord<HostFields>[] = [];
  const recorder: LlmDispatchRecorder<LlmDispatchRequest, HostFields> = { recordCallStart: (record) => starts.push(record), recordCall: (record) => calls.push(record), ...(newCallContext == null ? {} : { newCallContext }) };
  const strategies = backends === undefined ? [makeLlmScriptedDecisionStrategy({ id: 'account-a', requests, script: SCRIPT })] : backends;
  const dispatcher = makeLlmDispatcher<LlmDispatchRequest, LlmDispatchResult, HostFields>({
    strategies: makeLlmStrategyRegistry([makeLlmScriptedStrategy({ id: 'cap', replies: [] })]),
    defaultStrategyId: 'cap',
    defaultMaxOutputTokens: 1024,
    modelTiers: TIERS,
    descriptorOf: () => undefined,
    templateResolver: RESOLVER,
    transportBackoff: () => 0,
    recorder,
    ...(strategies == null ? {} : { decisions: { strategies: makeLlmStrategyRegistry(strategies), defaultModel: DECISION_MODEL, ...decisionsConfig } }),
    ...rest
  });
  return { dispatcher, requests, starts, calls };
}

/**
 * A scripted backend whose `n`th send (1-based) rejects with `errorAt(n)` when that returns one, else answers.
 *
 * @param errorAt - The error of a send, by its ordinal; `undefined` ⇒ that send answers.
 * @param requests - Receives every request sent.
 * @returns The backend.
 */
function flakyBackend(errorAt: (send: number) => unknown, requests: LlmDecisionRequest[]): LlmDecisionStrategy {
  const inner = makeLlmScriptedDecisionStrategy({ id: 'account-a', script: SCRIPT });
  let sends = 0;
  return {
    ...inner,
    decide: (request, options) => {
      requests.push(request as LlmDecisionRequest);
      sends += 1;
      const error = errorAt(sends);
      return error === undefined ? inner.decide(request, options) : Promise.reject(error);
    }
  };
}

const HTTP_503 = () => new LlmDecisionTransportError({ message: 'HTTP 503', status: 503 });

/**
 * A scripted backend that records which instance served each call.
 */
function namedBackend(id: string, servedBy: string[]): LlmDecisionStrategy {
  return makeLlmScriptedDecisionStrategy({
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
    it('should leave decide undefined with no decisions block or an empty registry', () => {
      const without = setup({ backends: null }).dispatcher;
      const empty = setup({ backends: [] }).dispatcher;

      for (const dispatcher of [without, empty]) {
        expect(dispatcher).not.toHaveProperty('decide');
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
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' }, tier: 'judge' });
      await dispatcher.decide?.({ capability: 'PickCap', decision: pinnedModel, input: { phrase: 'x' } });

      expect(requests.map((request) => request.model)).toEqual(['typesafe/jev-next', 'typesafe/jev-judge', 'typesafe/jev-pinned']);
    });
  });

  describe('model', () => {
    it("should never take the consuming capability's COMPLETION route: the descriptor, then the default model, answers", async () => {
      const { dispatcher, requests, starts } = setup({ capabilityRoutes: new Map([['PickCap', { model: 'some/routed-text-model' }]]) });
      const pinnedModel = defineLlmDecision({ ...PICK_ROW.descriptor, model: 'typesafe/jev-pinned' });

      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });
      await dispatcher.decide?.({ capability: 'PickCap', decision: pinnedModel, input: { phrase: 'x' } });

      expect(requests.map((request) => request.model)).toEqual([DECISION_MODEL, 'typesafe/jev-pinned']);
      expect(starts.map((record) => record.model)).toEqual([DECISION_MODEL, 'typesafe/jev-pinned']);
    });

    it('should take a capability route that names a decision model, over the descriptor', async () => {
      const { dispatcher, requests, starts } = setup({ capabilityRoutes: new Map([['PickCap', { model: 'typesafe/jev-routed', tier: 'judge' }]]) });
      const pinnedModel = defineLlmDecision({ ...PICK_ROW.descriptor, model: 'typesafe/jev-pinned' });

      await dispatcher.decide?.({ capability: 'PickCap', decision: pinnedModel, input: { phrase: 'x' } });

      expect(requests.map((request) => request.model)).toEqual(['typesafe/jev-routed']);
      expect(starts[0]).toMatchObject({ model: 'typesafe/jev-routed', tier: 'judge' });
    });

    it('should refuse a per-call or descriptor slug that is not a decision model, before anything is sent', async () => {
      const { dispatcher, requests, starts } = setup();
      const fastTier = defineLlmDecision({ ...PICK_ROW.descriptor, tier: 'fast' });

      await expect(dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' }, tier: 'strong' })).rejects.toThrow(llmDecisionModelIssue('some/strong-text-model') as string);
      await expect(dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' }, model: 'openai/gpt-5.1' })).rejects.toThrow(llmDecisionModelIssue('openai/gpt-5.1') as string);
      await expect(dispatcher.decide?.({ capability: 'PickCap', decision: fastTier, input: { phrase: 'x' } })).rejects.toThrow(llmDecisionModelIssue('some/fast-text-model') as string);

      expect(requests).toHaveLength(0);
      expect(starts).toHaveLength(0);
    });

    it('should name the decision, the capability and the rung in the refusal', async () => {
      const { dispatcher } = setup();

      await expect(dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' }, tier: 'strong' })).rejects.toThrow("llm dispatcher: decision 'PickRow' for 'PickCap' (the request-tier rung): ");
    });
  });

  describe('retry', () => {
    it('should honor a Retry-After the decision transport error carries through the default backoff', async () => {
      const requests: LlmDecisionRequest[] = [];
      const waits: number[] = [];
      const limited = new LlmDecisionTransportError({ message: 'HTTP 429', status: 429, headers: new Headers({ 'retry-after': '1' }) });
      const transportBackoff = (input: LlmDispatchTransportBackoffParams) => (waits.push(llmTransportBackoffMs(input)), 0);
      const { dispatcher } = setup({ backends: [flakyBackend((send) => (send === 1 ? limited : undefined), requests)], transportBackoff });
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(requests).toHaveLength(2);
      expect(waits).toEqual([1000]);
    });

    it('should resend a retryable transport failure once, after the transport backoff, and record the failed send', async () => {
      const requests: LlmDecisionRequest[] = [];
      const transportBackoff = vi.fn((_input: LlmDispatchTransportBackoffParams) => 0);
      const unavailable = HTTP_503();
      const { dispatcher, starts, calls } = setup({ backends: [flakyBackend((send) => (send === 1 ? unavailable : undefined), requests)], transportBackoff });
      const result = await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(result?.answers.row.choice).toBe('row-b');
      expect(requests).toHaveLength(2);
      expect(transportBackoff.mock.calls.map(([input]) => input.attempt)).toEqual([1]);
      expect(transportBackoff.mock.calls[0][0].error).toBe(unavailable);
      expect(starts).toHaveLength(1);
      expect(calls).toHaveLength(1);
      expect(calls[0].failedAttempts).toHaveLength(1);
      expect(calls[0].failedAttempts?.[0]).toMatchObject({ attempt: 1, cause: 'transport', text: '' });
      expect(calls[0].failedAttempts?.[0]?.error).toContain('503');
      expect(calls[0].result.attempts).toBe(2);
    });

    it('should resend a status-less transport failure whose cause is a dropped socket', async () => {
      const requests: LlmDecisionRequest[] = [];
      const dropped = () => new LlmDecisionTransportError({ message: 'the route could not be reached', cause: new TypeError('fetch failed') });
      const { dispatcher } = setup({ backends: [flakyBackend((send) => (send === 1 ? dropped() : undefined), requests)] });

      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(requests).toHaveLength(2);
    });

    it('should never resend a non-retryable failure, recording the failed send before rethrowing it', async () => {
      const failures: ReadonlyArray<readonly [unknown, string]> = [
        [new LlmDecisionTransportError({ message: 'HTTP 400', status: 400 }), 'unretryable'],
        [new LlmDecisionTransportError({ message: 'no API key configured' }), 'unretryable'],
        [new LlmDecisionAnswerFaultError([{ question: 'row', kind: 'answer-missing', detail: 'no answer' }]), 'unretryable'],
        [new DOMException('stopped', 'AbortError'), 'timeout'],
        [new DOMException('too slow', 'TimeoutError'), 'timeout'],
        [new Error('transport down'), 'unretryable']
      ];

      for (const [failure, cause] of failures) {
        const requests: LlmDecisionRequest[] = [];
        const { dispatcher, starts, calls } = setup({ backends: [flakyBackend(() => failure, requests)] });

        await expect(dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } })).rejects.toBe(failure);
        expect(requests).toHaveLength(1);
        expect(starts).toHaveLength(1);
        expect(calls).toHaveLength(1);
        expect(calls[0].failedAttempts).toEqual([expect.objectContaining({ attempt: 1, cause })]);
        expect(calls[0].result).toMatchObject({ decodeStatus: 'dropped', model: DECISION_MODEL });
      }
    });

    it('should resend a 408', async () => {
      const requests: LlmDecisionRequest[] = [];
      const { dispatcher } = setup({ backends: [flakyBackend((send) => (send === 1 ? new LlmDecisionTransportError({ message: 'HTTP 408', status: 408 }) : undefined), requests)] });

      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(requests).toHaveLength(2);
    });

    it('should resend a 409 only when isRetryableUnknownError vouches for it, handing it the thrown error', async () => {
      const conflict = new LlmDecisionTransportError({ message: 'HTTP 409', status: 409 });
      const requests: LlmDecisionRequest[] = [];
      const isRetryableUnknownError = vi.fn((_error: unknown) => true);
      const { dispatcher } = setup({ backends: [flakyBackend((send) => (send === 1 ? conflict : undefined), requests)], isRetryableUnknownError });

      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(requests).toHaveLength(2);
      expect(isRetryableUnknownError).toHaveBeenCalledWith(conflict);

      const refusedRequests: LlmDecisionRequest[] = [];
      const refused = setup({ backends: [flakyBackend(() => conflict, refusedRequests)] });
      await expect(refused.dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } })).rejects.toBe(conflict);
      expect(refusedRequests).toHaveLength(1);
      expect(refused.starts).toHaveLength(1);
      expect(refused.calls).toHaveLength(1);
      expect(refused.calls[0].failedAttempts).toEqual([expect.objectContaining({ attempt: 1, cause: 'unretryable', errorClassification: 'unknown' })]);
    });

    it('should never offer an answer fault to isRetryableUnknownError', async () => {
      const fault = new LlmDecisionAnswerFaultError([{ question: 'row', kind: 'answer-missing', detail: 'no answer' }]);
      const isRetryableUnknownError = vi.fn((_error: unknown) => true);
      const { dispatcher } = setup({ backends: [flakyBackend(() => fault, [])], isRetryableUnknownError });

      await expect(dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } })).rejects.toBe(fault);
      expect(isRetryableUnknownError).not.toHaveBeenCalled();
    });

    it('should respect decisions.maxAttempts, clamped to at least one send', async () => {
      const always = (maxAttempts: number) => {
        const requests: LlmDecisionRequest[] = [];
        const transportBackoff = vi.fn((_input: LlmDispatchTransportBackoffParams) => 0);
        const error = HTTP_503();
        const { dispatcher } = setup({ backends: [flakyBackend(() => error, requests)], transportBackoff, decisionsConfig: { maxAttempts } });
        return { dispatcher, requests, transportBackoff, error };
      };

      const three = always(3);
      await expect(three.dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } })).rejects.toBe(three.error);
      expect(three.requests).toHaveLength(3);
      expect(three.transportBackoff.mock.calls.map(([input]) => input.attempt)).toEqual([1, 2]);

      for (const single of [always(1), always(0)]) {
        await expect(single.dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } })).rejects.toBe(single.error);
        expect(single.requests).toHaveLength(1);
        expect(single.transportBackoff).not.toHaveBeenCalled();
      }
    });

    it('should not resend a decision cancelled during the backoff', async () => {
      const requests: LlmDecisionRequest[] = [];
      const error = HTTP_503();
      const controller = new AbortController();
      const transportBackoff = (_input: LlmDispatchTransportBackoffParams) => {
        controller.abort();
        return 0;
      };
      const { dispatcher } = setup({ backends: [flakyBackend((send) => (send === 1 ? error : undefined), requests)], transportBackoff });

      await expect(dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' }, signal: controller.signal })).rejects.toBe(error);
      expect(requests).toHaveLength(1);
    });

    it('should not resend a decision cancelled while parked before the resend', async () => {
      const requests: LlmDecisionRequest[] = [];
      const error = HTTP_503();
      const controller = new AbortController();
      let paused = false;
      let parked = 0;
      const pause = {
        isPaused: () => paused,
        waitUntilResumed: (signal?: AbortSignal) =>
          new Promise<void>((resolve) => {
            parked += 1;
            signal?.addEventListener('abort', () => resolve(), { once: true });
          })
      };
      // the gate closes during the backoff, so the resend parks
      const transportBackoff = (_input: LlmDispatchTransportBackoffParams) => ((paused = true), 0);
      const { dispatcher } = setup({ backends: [flakyBackend((send) => (send === 1 ? error : undefined), requests)], transportBackoff, pause });
      const pending = dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' }, signal: controller.signal });
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(parked).toBe(1);
      controller.abort();
      await expect(pending).rejects.toBe(error);
      expect(requests).toHaveLength(1);
    });

    it('should record one start and one failed call record when a send throws, then rethrow', async () => {
      const throwing = makeLlmScriptedDecisionStrategy({
        id: 'account-a',
        script: () => {
          throw new Error('transport down');
        }
      });
      const { dispatcher, starts, calls } = setup({ backends: [throwing] });

      await expect(dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } })).rejects.toThrow('transport down');

      expect(starts).toHaveLength(1);
      expect(calls).toHaveLength(1);
      expect(calls[0].failedAttempts?.[0]?.error).toContain('transport down');
    });
  });

  describe('failed decisions', () => {
    function tapped() {
      const completed: LlmDispatchCompleteTapEvent<HostFields>[] = [];
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      taps.addTap({ id: 't', onDispatchComplete: (event) => void completed.push(event) });
      return { taps, completed };
    }

    it('should record a 401 with its error summary and fire onDispatchComplete before rethrowing it', async () => {
      const unauthorized = new LlmDecisionTransportError({ message: 'HTTP 401: invalid API key', status: 401 });
      const { taps, completed } = tapped();
      const requests: LlmDecisionRequest[] = [];
      const { dispatcher, starts, calls } = setup({ taps, backends: [flakyBackend(() => unauthorized, requests)] });

      await expect(dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } })).rejects.toBe(unauthorized);

      expect(requests).toHaveLength(1);
      expect(starts).toHaveLength(1);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({ capability: 'PickCap', decision: 'PickRow' });
      expect(calls[0].result).toMatchObject({ text: '', strategyId: 'account-a', model: DECISION_MODEL, decodeStatus: 'dropped' });
      expect(calls[0].result.attempts).toBeUndefined();
      expect(calls[0].failedAttempts).toEqual([expect.objectContaining({ attempt: 1, cause: 'unretryable', errorClassification: 'permanent' })]);
      expect(calls[0].failedAttempts?.[0]?.error).toContain('401');
      expect(completed).toEqual([calls[0]]);
    });

    it('should record every billed send of a decision that exhausts its resends', async () => {
      const error = HTTP_503();
      const { taps, completed } = tapped();
      const requests: LlmDecisionRequest[] = [];
      const { dispatcher, calls } = setup({ taps, backends: [flakyBackend(() => error, requests)], decisionsConfig: { maxAttempts: 2 } });

      await expect(dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } })).rejects.toBe(error);

      expect(requests).toHaveLength(2);
      expect(calls).toHaveLength(1);
      expect(calls[0].result).toMatchObject({ attempts: 2, decodeStatus: 'dropped', decodeOutcome: 'transport' });
      expect(calls[0].failedAttempts).toEqual([expect.objectContaining({ attempt: 1, cause: 'transport' }), expect.objectContaining({ attempt: 2, cause: 'transport' })]);
      expect(completed).toHaveLength(1);
    });

    it('should keep the answer fault class on the rethrow, after recording it', async () => {
      const fault = new LlmDecisionAnswerFaultError([{ question: 'row', kind: 'value-out-of-range', detail: "the distribution's `row-a` is NaN, outside 0..1" }]);
      const { dispatcher, calls } = setup({ backends: [flakyBackend(() => fault, [])] });

      await expect(dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } })).rejects.toBeInstanceOf(LlmDecisionAnswerFaultError);
      expect(calls).toHaveLength(1);
      expect(calls[0].failedAttempts?.[0]).toMatchObject({ cause: 'unretryable', errorClassification: 'permanent' });
      expect(calls[0].failedAttempts?.[0]?.error).toContain('NaN');
    });

    it('should record the bill a faulted reply carried on its row and its call, reconcilable by its generation id', async () => {
      const usage = { promptTokens: 350, completionTokens: 34, totalTokens: 384, cost: 0.0000147 };
      const fault = new LlmDecisionAnswerFaultError([{ question: 'row', kind: 'value-out-of-range', detail: "the distribution's `row-a` is NaN, outside 0..1" }], { model: 'typesafe/jev-1.14-20261101', usage, generationId: 'gen-faulted', provider: 'TypeSafe' });
      const { dispatcher, calls } = setup({ backends: [flakyBackend(() => fault, [])] });

      await expect(dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } })).rejects.toBe(fault);

      expect(calls).toHaveLength(1);
      expect(calls[0].result).toMatchObject({ text: '', model: 'typesafe/jev-1.14-20261101', provider: 'TypeSafe', usage, generationId: 'gen-faulted', decodeStatus: 'dropped' });
      expect(calls[0].failedAttempts?.[0]).toMatchObject({ cause: 'unretryable', model: 'typesafe/jev-1.14-20261101', usage, generationId: 'gen-faulted' });

      const asked: string[] = [];
      const reader: LlmCallBillReader = {
        providerId: 'zenmux',
        read: async (generationId) => {
          asked.push(generationId);
          return { status: 'billed', bill: { generationId, billed: 0.0000147 } };
        }
      };
      const reconciliation = await reconcileLlmCallBills({ calls: [toLlmCallLogPayload(calls[0])], reader });

      expect(asked).toEqual(['gen-faulted']);
      expect(reconciliation.withoutGenerationId).toBe(0);
      expect(reconciliation.total).toMatchObject({ calls: 1, billedCalls: 1, loggedMissing: 0 });
    });

    it('should record no bill for a fault that carried none', async () => {
      const fault = new LlmDecisionAnswerFaultError([{ question: 'row', kind: 'answer-missing', detail: 'no answer' }]);
      const { dispatcher, calls } = setup({ backends: [flakyBackend(() => fault, [])] });

      await expect(dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } })).rejects.toBe(fault);
      expect(calls[0].result).toMatchObject({ model: DECISION_MODEL });
      expect(calls[0].result.usage).toBeUndefined();
      expect(calls[0].result.generationId).toBeUndefined();
    });

    it('should record the resent send of a decision cancelled during the backoff', async () => {
      const error = HTTP_503();
      const controller = new AbortController();
      const transportBackoff = (_input: LlmDispatchTransportBackoffParams) => (controller.abort(), 0);
      const { dispatcher, calls } = setup({ backends: [flakyBackend(() => error, [])], transportBackoff });

      await expect(dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' }, signal: controller.signal })).rejects.toBe(error);
      expect(calls).toHaveLength(1);
      expect(calls[0].failedAttempts).toEqual([expect.objectContaining({ attempt: 1, cause: 'transport' })]);
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
      expect(calls[0]).not.toHaveProperty('failedAttempts');
      expect(calls[0].result).not.toHaveProperty('attempts');
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

    it("should land the dispatcher's host record fields on both records (lane: 'decision')", async () => {
      const { dispatcher, starts, calls } = setup({ recordFieldsOf: ({ lane, kind, request }) => ({ host: `${lane}:${kind}:${request.capability}` }) });

      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });
      await dispatcher.decide?.({ capability: 'OtherCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(starts.map((record) => record.host)).toEqual(['decision:start:PickCap', 'decision:start:OtherCap']);
      expect(calls.map((record) => record.host)).toEqual(['decision:call:PickCap', 'decision:call:OtherCap']);
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

    it("should mint the context through the recorder's newCallContext (lane: 'decision') and time the decide span on it", async () => {
      const contexts: LlmCallContext[] = [];
      const seen: { readonly lane: LlmDispatchLane; readonly label: string }[] = [];
      const { dispatcher } = setup({
        newCallContext: ({ lane, label }) => {
          seen.push({ lane, label });
          const context = makeLlmCallContext({ label, timing: true });
          contexts.push(context);
          return context;
        }
      });
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(seen).toEqual([{ lane: 'decision', label: 'PickCap' }]);
      expect(spanNamesOf(contexts[0])).toContain('decide');
    });

    it("should nest under the request's callContext instead of minting a root", async () => {
      const newCallContext = vi.fn(({ label }: { readonly label: string }) => makeLlmCallContext({ label, timing: true }));
      const { dispatcher } = setup({ newCallContext });
      const parent = makeLlmCallContext({ label: 'turn', timing: true });
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' }, callContext: parent });
      const profile = parent.profile();

      expect(newCallContext).not.toHaveBeenCalled();
      expect(profile.children.map((child) => child.label)).toEqual(['PickCap']);
      expect(profile.children[0].spans.map((span) => span.name)).toContain('decide');
    });

    it('should hand callAttributionOf the decision lane, and its attribution to the context', async () => {
      const lanes: LlmDispatchLane[] = [];
      const attributions: unknown[] = [];
      const attribution = { who: 'judge' };
      const { dispatcher } = setup({
        callAttributionOf: ({ lane }) => {
          lanes.push(lane);
          return attribution;
        },
        newCallContext: ({ label, attribution: given }) => {
          attributions.push(given);
          return makeLlmCallContext({ label, timing: true });
        }
      });
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(lanes).toEqual(['decision']);
      expect(attributions).toEqual([attribution]);
    });

    it('should fire onDispatch and onDispatchComplete with the records (never onDecodeFailure)', async () => {
      const dispatched: LlmDispatchStartTapEvent<HostFields>[] = [];
      const completed: LlmDispatchCompleteTapEvent<HostFields>[] = [];
      const decodeFailures: unknown[] = [];
      const taps = makeLlmDispatchTapRegistry<HostFields>();
      taps.addTap({ id: 't', onDispatch: (event) => void dispatched.push(event), onDecodeFailure: (event) => void decodeFailures.push(event), onDispatchComplete: (event) => void completed.push(event) });
      const requests: LlmDecisionRequest[] = [];
      const { dispatcher, starts, calls } = setup({ taps, backends: [flakyBackend((send) => (send === 1 ? HTTP_503() : undefined), requests)] });
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'x' } });

      expect(dispatched).toHaveLength(1);
      expect(dispatched[0]).toEqual({ ...starts[0], prompt: calls[0].prompt, estimatedPromptTokens: estimateLlmTokens(calls[0].prompt), decision: 'PickRow' });
      expect(starts[0]).not.toHaveProperty('decision');
      expect(completed).toEqual([calls[0]]);
      expect(decodeFailures).toEqual([]);
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
      const inner = makeLlmScriptedDecisionStrategy({ id: 'observer', script: SCRIPT });
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
});
