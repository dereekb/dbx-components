/**
 * The round trip a host's log takes: a real dispatcher hands its recorder in-memory records, `toLlmCallLogPayload`
 * projects each into the flat row the host persists, and every row reader — the prompt / segments / failed-attempt
 * readers, the attempt summary, the decision-lane checks, the usage cell, the bill reconcile and the tape — reads the
 * row back. The raw record read as a row (what the dispatcher guide once persisted) is the regression.
 */

import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { makeLlmDecisionChoiceAnswer, makeLlmDecisionNoulAnswer, makeLlmScriptedDecisionStrategy, makeLlmScriptedStrategy, makeLlmTapeStrategy, readLlmTapeTurn, type LlmScriptedCompletion, type LlmScriptedDecisionScript, type LlmTapeTurn } from '@dereekb/llm/test';
import { defineLlmCapability, type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { defineLlmDecision } from '../decision/llm.decision.descriptor';
import { llmChoiceQuestion, llmNoulQuestion } from '../decision/llm.decision.question';
import { type LlmDecisionStrategy } from '../decision/llm.decision.strategy';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { makeLlmDispatcher } from '../dispatch/llm.dispatcher.pipeline';
import { type LlmPromptTemplate, makeLlmTieredPromptTemplateResolver } from '../prompt/llm.prompt.template';
import { type LlmCallBillReader } from '../strategy/llm.call.bill';
import { type LlmDispatchResult, type LlmStrategy } from '../strategy/llm.strategy';
import { makeLlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { type LlmUsage } from '../strategy/llm.usage';
import { reconcileLlmCallBills } from '../usage/llm.bill.reconcile';
import { formatLlmCallAttempts, isDecisionLlmCallRow, readLlmCallFailedAttempts, readLlmCallPrompt, readLlmCallPromptSegments } from '../usage/llm.call.reader';
import { emptyLlmUsageCell, toLlmUsageCell } from '../usage/llm.usage.cell';
import { isUncacheableLlmCall } from '../usage/llm.usage.rate';
import { type LlmCallLogPayloadWrite, toLlmCallLogPayload } from './llm.call.payload';
import { LLM_CALL_EVENT_TYPE, type LlmCallRecord } from './llm.call.record';

// MARK: Fixtures
const TEMPLATES: ReadonlyArray<LlmPromptTemplate> = [
  { key: 'reply-protocol', role: 'reply-protocol', text: 'A-PROTOCOL' },
  { key: 'instructions', role: 'instructions', text: 'B-CAP' },
  { key: 'context', role: 'context', text: 'C-CTX\n{{liveContext}}' }
];

const ANSWER = type({ answer: 'string' });

const DESCRIPTORS: Readonly<Record<string, LlmCapabilityDescriptor>> = { TestCap: defineLlmCapability({ capability: 'TestCap', responseSchema: ANSWER, parseValue: (value) => value }) };

const VALID = (value: unknown) => (typeof (value as { answer?: unknown }).answer === 'string' ? true : { error: 'answer must be a string' });

function usage(promptTokens: number): LlmUsage {
  return { promptTokens, completionTokens: 5, totalTokens: promptTokens + 5, cost: promptTokens / 1000 };
}

function billed(text: string, generationId: string, promptTokens: number): LlmScriptedCompletion {
  return { text, finishReason: 'stop', usage: usage(promptTokens), generationId };
}

/**
 * Each completion's replies, in dispatch order: retried (invalid → ok), dropped (invalid twice), repaired (a near miss
 * one `close-object` op saves). Every reply is billed and carries a generation id.
 */
const REPLIES: ReadonlyArray<LlmScriptedCompletion> = [billed('{"answer":1}', 'gen-1', 11), billed('{"answer":"ok"}', 'gen-2', 12), billed('{"answer":1}', 'gen-3', 13), billed('{"answer":2}', 'gen-4', 14), billed('{"answer":"ok"', 'gen-5', 15)];

const PICK_ROW = defineLlmDecision({
  decision: 'PickRow',
  describe: 'pick the row a phrase names',
  state: (input: { readonly phrase: string }) => ({ phrase: input.phrase }),
  questions: () => ({ row: llmChoiceQuestion('which row?', { 'row-a': null, 'row-b': null }), any: llmNoulQuestion('does any row fit?') })
});

const SCRIPT: LlmScriptedDecisionScript = () => ({ row: makeLlmDecisionChoiceAnswer({ options: ['row-a', 'row-b'], choice: 'row-b', confidence: 0.82 }), any: makeLlmDecisionNoulAnswer(0.93) });

/**
 * A scripted decision backend whose answer is billed and carries a generation id.
 */
const DECISION_BACKEND: LlmDecisionStrategy = (() => {
  const inner = makeLlmScriptedDecisionStrategy({ id: 'account-a', script: SCRIPT });
  return { ...inner, decide: async (decisionRequest, options) => ({ ...(await inner.decide(decisionRequest, options)), usage: usage(40), generationId: 'gen-d' }) };
})();

const DECISION_KINDS: ReadonlySet<string> = new Set([DECISION_BACKEND.kind ?? DECISION_BACKEND.id]);

function dispatcherOver(strategy: LlmStrategy, calls: LlmCallRecord[]) {
  return makeLlmDispatcher<LlmDispatchRequest, LlmDispatchResult>({
    strategies: makeLlmStrategyRegistry([strategy]),
    defaultStrategyId: strategy.id,
    defaultMaxOutputTokens: 1024,
    modelTiers: { fast: 'test/fast', strong: 'test/strong' },
    descriptorOf: (capability) => DESCRIPTORS[capability],
    templateResolver: makeLlmTieredPromptTemplateResolver({ tiers: [{ source: 'defaults', templates: TEMPLATES }] }),
    transportBackoff: () => 0,
    recorder: { recordCall: (record) => calls.push(record) },
    decisions: { strategies: makeLlmStrategyRegistry([DECISION_BACKEND]), defaultModel: 'typesafe/jev-1.14' }
  });
}

/**
 * Each completion renders its own live context, so the three prompts (and their tape hashes) differ.
 *
 * @param live - The live context text.
 * @returns The request.
 */
function request(live: string): LlmDispatchRequest {
  return { capability: 'TestCap', renderLiveContext: () => [{ key: 'facts', text: live }], validate: VALID };
}

const REQUESTS = { retried: request('retried'), dropped: request('dropped'), repaired: request('repaired') };

interface Recorded {
  readonly retried: LlmCallRecord;
  readonly dropped: LlmCallRecord;
  readonly repaired: LlmCallRecord;
  readonly decision: LlmCallRecord;
  readonly all: ReadonlyArray<LlmCallRecord>;
}

/**
 * Run the four calls through ONE dispatcher, in order.
 *
 * @returns Each call's record.
 */
async function recordAll(): Promise<Recorded> {
  const calls: LlmCallRecord[] = [];
  const dispatcher = dispatcherOver(makeLlmScriptedStrategy({ id: 's', replies: REPLIES }), calls);
  await dispatcher.dispatch(REQUESTS.retried);
  await dispatcher.dispatch(REQUESTS.dropped).catch(() => undefined);
  await dispatcher.dispatch(REQUESTS.repaired);
  await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'on the pile' } });
  expect(calls).toHaveLength(4);
  const [retried, dropped, repaired, decision] = calls;
  return { retried, dropped, repaired, decision, all: calls };
}

function rowsOf(recorded: Recorded, keepIo: boolean): ReadonlyArray<LlmCallLogPayloadWrite> {
  return recorded.all.map((record) => toLlmCallLogPayload(record, { keepIo }));
}

// MARK: Specs
describe('toLlmCallLogPayload() round trip', () => {
  it('records the scenarios it reads back', async () => {
    const { retried, dropped, repaired, decision } = await recordAll();

    expect(retried.result.decodeStatus).toBe('retried');
    expect(retried.failedAttempts).toHaveLength(1);
    expect(dropped.result.decodeStatus).toBe('dropped');
    expect(dropped.failedAttempts).toHaveLength(2);
    expect(repaired.result.repair?.tier).toBe('deterministic');
    expect(decision.decision).toBe('PickRow');
  });

  describe.each([true, false])('rows projected with keepIo: %s', (keepIo) => {
    it('reads the prompt, the segments and the failed attempts only when the I/O was kept', async () => {
      const recorded = await recordAll();

      for (const record of recorded.all) {
        const row = toLlmCallLogPayload(record, { keepIo });

        expect(readLlmCallPrompt(row)).toBe(keepIo ? record.prompt : undefined);
        expect(readLlmCallPromptSegments(row)).toEqual(keepIo ? record.segments : undefined);
        expect(readLlmCallFailedAttempts(row)).toEqual(keepIo ? record.failedAttempts : undefined);
      }
    });

    it('summarizes the attempts of each row', async () => {
      const { retried, dropped, repaired, decision } = await recordAll();
      const format = (record: LlmCallRecord) => formatLlmCallAttempts({ type: LLM_CALL_EVENT_TYPE, payload: toLlmCallLogPayload(record, { keepIo }) });
      const [failed] = retried.failedAttempts ?? [];
      const droppedSummary = format(dropped) ?? '';

      if (keepIo) {
        expect(format(retried)).toBe(`attempts 2 retried · #1 ${failed.cause}: ${failed.error} → ${failed.retry?.lever}`);
        expect(droppedSummary.startsWith('attempts 2 dropped · #1 ')).toBe(true);
        expect(droppedSummary).toContain(' · #2 ');
      } else {
        expect(format(retried)).toBe('attempts 2 retried · 1 failed reply not captured');
        expect(droppedSummary).toBe('attempts 2 dropped · 2 failed replies not captured');
      }

      expect(format(repaired)).toBeUndefined();
      expect(format(decision)).toBeUndefined();
    });

    it('marks only the decision row as decision-lane and uncacheable', async () => {
      const recorded = await recordAll();

      expect(rowsOf(recorded, keepIo).map((row) => isDecisionLlmCallRow(row, DECISION_KINDS))).toEqual([false, false, false, true]);
      expect(rowsOf(recorded, keepIo).map((row) => isUncacheableLlmCall(row, DECISION_KINDS))).toEqual([false, false, false, true]);
    });

    it('folds each row into a usage cell carrying its tokens', async () => {
      const recorded = await recordAll();
      const cells = rowsOf(recorded, keepIo).map((row) => toLlmUsageCell(row.usage, isUncacheableLlmCall(row, DECISION_KINDS)));

      cells.forEach((cell) => expect(cell).not.toEqual({ ...emptyLlmUsageCell(), calls: 1 }));
      expect(cells.slice(0, 3)).toEqual([recorded.retried, recorded.dropped, recorded.repaired].map((record) => toLlmUsageCell(record.result.usage)));
      expect(cells[0].promptTokens).toBeGreaterThan(0);
      expect(cells[3].uncacheablePromptTokens).toBe(40);
    });

    it('asks the bill reader about every generation id', async () => {
      const recorded = await recordAll();
      const asked: string[] = [];
      const reader: LlmCallBillReader = {
        providerId: 'zenmux',
        read: async (generationId) => {
          asked.push(generationId);
          return { status: 'pending', generationId, detail: 'Not Found' };
        }
      };
      const reconciliation = await reconcileLlmCallBills({ calls: rowsOf(recorded, keepIo), reader });

      expect(reconciliation.withoutGenerationId).toBe(0);
      const byId = (a: string, b: string) => a.localeCompare(b);

      expect(asked.toSorted(byId)).toEqual(recorded.all.map((record) => record.result.generationId ?? '').toSorted(byId));
    });

    it('reads a tape turn from each completion row only when the I/O was kept, never from the decision row', async () => {
      const recorded = await recordAll();
      const turns = rowsOf(recorded, keepIo).map((row) => readLlmTapeTurn(row, { decisionStrategyKinds: DECISION_KINDS }));

      expect(turns.map((turn) => turn != null)).toEqual(keepIo ? [true, true, true, false] : [false, false, false, false]);

      if (keepIo) {
        expect(turns[2]?.text).toBe(recorded.repaired.result.repair?.originalText);
      }
    });
  });

  it('replays the completions from a tape of their rows, re-running the deterministic repair', async () => {
    const recorded = await recordAll();
    const turns = rowsOf(recorded, true)
      .map((row) => readLlmTapeTurn(row, { decisionStrategyKinds: DECISION_KINDS }))
      .filter((turn): turn is LlmTapeTurn => turn != null);
    const tape = makeLlmTapeStrategy({ turns });
    const replays: LlmCallRecord[] = [];
    const dispatcher = dispatcherOver(tape, replays);
    const retried = await dispatcher.dispatch(REQUESTS.retried);
    const repaired = await dispatcher.dispatch(REQUESTS.repaired);

    expect(tape.matches().map((match) => match.kind)).toEqual(['hash', 'hash']);
    expect(retried.text).toBe(recorded.retried.result.text);
    expect(repaired.text).toBe(recorded.repaired.result.text);
    expect(repaired.repair?.tier).toBe('deterministic');
    expect(repaired.repair?.originalText).toBe(recorded.repaired.result.repair?.originalText);
  });

  it('reads nothing off a raw record persisted as the row, and everything off its projection (regression)', async () => {
    const { retried } = await recordAll();
    const row = toLlmCallLogPayload(retried, { keepIo: true });

    expect(readLlmTapeTurn(retried, { decisionStrategyKinds: DECISION_KINDS })).toBeUndefined();
    expect(formatLlmCallAttempts({ type: LLM_CALL_EVENT_TYPE, payload: retried })).toBeUndefined();
    expect(readLlmTapeTurn(row, { decisionStrategyKinds: DECISION_KINDS })).toBeDefined();
    expect(formatLlmCallAttempts({ type: LLM_CALL_EVENT_TYPE, payload: row })).toBeDefined();
  });
});
