/**
 * `toLlmCallLogPayload` — the one projector of an in-memory call record into the flat row a host persists: its key
 * order and gates (P1–P3), byte parity with the dbx-chara writer it replaces (P4), and the rows of real dispatches
 * (P5).
 *
 * Each pin checks `Object.keys` (the order) then `JSON.stringify` (the bytes); an unbounded value is swapped for its
 * length before stringifying.
 */

import { type } from 'arktype';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { makeLlmDecisionChoiceAnswer, makeLlmDecisionNoulAnswer, makeLlmScriptedDecisionStrategy, makeLlmScriptedStrategy, type LlmScriptedDecisionScript, type LlmScriptedReplies } from '@dereekb/llm/test';
import { defineLlmCapability, type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { defineLlmDecision } from '../decision/llm.decision.descriptor';
import { llmChoiceQuestion, llmNoulQuestion } from '../decision/llm.decision.question';
import { type LlmDecisionStrategy, LlmDecisionTransportError } from '../decision/llm.decision.strategy';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmDispatchRecorder } from '../dispatch/llm.dispatcher.config';
import { makeLlmDispatcher } from '../dispatch/llm.dispatcher.pipeline';
import { type LlmPromptSegment } from '../prompt/llm.prompt.segment';
import { type LlmPromptTemplate, makeLlmTieredPromptTemplateResolver } from '../prompt/llm.prompt.template';
import { type LlmDispatchResult, type LlmStrategy } from '../strategy/llm.strategy';
import { makeLlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { makeLlmCallContext } from './llm.call.context';
import { type LlmCallFailedAttemptRow, type LlmCallLogPayloadBase, type LlmCallLogPayloadConfig, type LlmCallLogPayloadWrite, toLlmCallLogPayload } from './llm.call.payload';
import { type LlmCallFailedAttempt, type LlmCallPhases, type LlmCallRecord, type LlmCallRecordBase, type LlmCallSupplement } from './llm.call.record';
import { llmCallTelemetry } from './llm.call.telemetry';

function expectPin(value: object, keys: ReadonlyArray<string>, bytes: string): void {
  expect(Object.keys(value)).toEqual(keys);
  expect(JSON.stringify(value)).toBe(bytes);
}

// MARK: Hand-built records
const SEGMENTS: ReadonlyArray<LlmPromptSegment> = [{ id: 'body', promptSegment: 'P', origin: { kind: 'template' } }];

const FAILED: LlmCallFailedAttempt = { attempt: 1, cause: 'schema-validation', error: 'answer must be a string', text: '{"answer":1}', rawLength: 12, strategyId: 's' };

const SUPPLEMENT: LlmCallSupplement = { contributor: 'craft', slot: 'craft', id: 'n1', hash: 'h1', bytes: 4 };

const PHASES: LlmCallPhases = { totalMs: 5, completeMs: 2, attempts: [{ attempt: 1, wallMs: 2 }], cachePrefixHash: 'abc' };

const MAX_RESULT: LlmDispatchResult = {
  text: '{"answer":"ok"}',
  strategyId: 's',
  strategyKind: 'scripted',
  capability: 'StrongCap',
  meta: { trace: 't' },
  model: 'test/strong',
  provider: 'acme',
  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.01 },
  latencyMs: 42,
  generationId: 'gen-1',
  finishReason: 'stop',
  attachmentsSent: 1,
  schemaEnforced: true,
  attempts: 2,
  validationErrors: ['answer must be a string'],
  decodeStatus: 'retried',
  decodeOutcome: 'ok',
  lengthCapped: true,
  valueJson: '{"answer":"ok"}',
  repair: { tier: 'deterministic', attempt: 2, verdict: 'near-miss', score: 1, ops: { 'close-object': 1 }, originalText: '{"answer":"ok"' }
};

/**
 * Every library key set, a stamp that collides with `tier`, and a host field the row must never carry.
 */
const MAX: LlmCallRecord<{ readonly requestId: string }> = {
  capability: 'StrongCap',
  prompt: 'P',
  segments: SEGMENTS,
  result: MAX_RESULT,
  tier: 'strong',
  subject: 'Judged',
  decision: 'PickRow',
  stamp: { tier: 'stamp-tier', craft: { asked: 2, kept: 1 } },
  supplements: [SUPPLEMENT],
  reasoningOff: true,
  estimatedPromptTokens: 7,
  phases: PHASES,
  failedAttempts: [FAILED],
  requestId: 'r1'
};

const MIN: LlmCallRecordBase = { capability: 'MinCap', prompt: '', segments: [], result: { text: 'hi', strategyId: 's', capability: 'MinCap' } };

/**
 * Empty lists (never written), and the two booleans written as `false`.
 */
const EMPTY_LISTS: LlmCallRecordBase = { ...MIN, result: { ...MIN.result, schemaEnforced: false }, supplements: [], failedAttempts: [], reasoningOff: false };

/**
 * A decision-lane record with a stamp whose keys the library does not write.
 */
const DECISION: LlmCallRecordBase = {
  capability: 'PickCap',
  prompt: 'Q',
  segments: [{ id: 'state', promptSegment: 'Q', origin: { kind: 'template' } }],
  result: { text: '{"row":"row-b"}', strategyId: 'account-a', strategyKind: 'scripted-decision', capability: 'PickCap', model: 'typesafe/jev-1.14', latencyMs: 3, attempts: 2 },
  decision: 'PickRow',
  stamp: { row: 'row-b' },
  failedAttempts: [{ attempt: 1, cause: 'transport', error: 'HTTP 503', text: '', rawLength: 0, strategyId: 'account-a' }]
};

/**
 * A repaired completion with no stamp: `text` is the model's bytes, `lever` the repaired value.
 */
const REPAIRED: LlmCallRecordBase = {
  capability: 'TestCap',
  prompt: 'P',
  segments: SEGMENTS,
  result: { text: '{"answer":"ok"}', strategyId: 's', capability: 'TestCap', attempts: 1, decodeStatus: 'clean', decodeOutcome: 'ok', valueJson: '{"answer":"ok"}', repair: { tier: 'deterministic', attempt: 1, verdict: 'near-miss', score: 1, originalText: '{"answer":"ok"' } },
  reasoningOff: true,
  estimatedPromptTokens: 3
};

const GATES: ReadonlyArray<LlmCallLogPayloadConfig> = [{}, { keepIo: true }, { keepPhases: true }, { keepIo: true, keepPhases: true }];

/**
 * One gate's pin: the config, the row's key order and its bytes.
 */
type GatePin = readonly [LlmCallLogPayloadConfig, ReadonlyArray<string>, string];

const P1_PINS: ReadonlyArray<GatePin> = [
  [
    {},
    [
      'tier',
      'craft',
      'capability',
      'strategyId',
      'strategyKind',
      'model',
      'provider',
      'usage',
      'latencyMs',
      'generationId',
      'finishReason',
      'repair',
      'schemaEnforced',
      'attempts',
      'decodeStatus',
      'decodeOutcome',
      'lengthCapped',
      'validationErrors',
      'subject',
      'decision',
      'supplements',
      'reasoningOff',
      'estimatedPromptTokens'
    ],
    '{"tier":"strong","craft":{"asked":2,"kept":1},"capability":"StrongCap","strategyId":"s","strategyKind":"scripted","model":"test/strong","provider":"acme","usage":{"promptTokens":10,"completionTokens":5,"totalTokens":15,"cost":0.01},"latencyMs":42,"generationId":"gen-1","finishReason":"stop","repair":{"tier":"deterministic","attempt":2,"verdict":"near-miss","score":1,"ops":{"close-object":1}},"schemaEnforced":true,"attempts":2,"decodeStatus":"retried","decodeOutcome":"ok","lengthCapped":true,"validationErrors":["answer must be a string"],"subject":"Judged","decision":"PickRow","supplements":[{"contributor":"craft","slot":"craft","id":"n1","hash":"h1","bytes":4}],"reasoningOff":true,"estimatedPromptTokens":7}'
  ],
  [
    { keepIo: true },
    [
      'tier',
      'craft',
      'capability',
      'promptSegments',
      'text',
      'failedAttempts',
      'strategyId',
      'strategyKind',
      'model',
      'provider',
      'usage',
      'latencyMs',
      'generationId',
      'finishReason',
      'repair',
      'schemaEnforced',
      'attempts',
      'decodeStatus',
      'decodeOutcome',
      'lengthCapped',
      'lever',
      'validationErrors',
      'subject',
      'decision',
      'supplements',
      'reasoningOff',
      'estimatedPromptTokens'
    ],
    String.raw`{"tier":"strong","craft":{"asked":2,"kept":1},"capability":"StrongCap","promptSegments":[{"id":"body","promptSegment":"P","origin":{"kind":"template"}}],"text":"{\"answer\":\"ok\"","failedAttempts":[{"attempt":1,"cause":"schema-validation","error":"answer must be a string","text":"{\"answer\":1}","rawLength":12,"strategyId":"s"}],"strategyId":"s","strategyKind":"scripted","model":"test/strong","provider":"acme","usage":{"promptTokens":10,"completionTokens":5,"totalTokens":15,"cost":0.01},"latencyMs":42,"generationId":"gen-1","finishReason":"stop","repair":{"tier":"deterministic","attempt":2,"verdict":"near-miss","score":1,"ops":{"close-object":1}},"schemaEnforced":true,"attempts":2,"decodeStatus":"retried","decodeOutcome":"ok","lengthCapped":true,"lever":"{\"answer\":\"ok\"}","validationErrors":["answer must be a string"],"subject":"Judged","decision":"PickRow","supplements":[{"contributor":"craft","slot":"craft","id":"n1","hash":"h1","bytes":4}],"reasoningOff":true,"estimatedPromptTokens":7}`
  ],
  [
    { keepPhases: true },
    [
      'tier',
      'craft',
      'capability',
      'strategyId',
      'strategyKind',
      'model',
      'provider',
      'usage',
      'latencyMs',
      'generationId',
      'finishReason',
      'repair',
      'schemaEnforced',
      'attempts',
      'decodeStatus',
      'decodeOutcome',
      'lengthCapped',
      'validationErrors',
      'subject',
      'decision',
      'supplements',
      'reasoningOff',
      'estimatedPromptTokens',
      'phases'
    ],
    '{"tier":"strong","craft":{"asked":2,"kept":1},"capability":"StrongCap","strategyId":"s","strategyKind":"scripted","model":"test/strong","provider":"acme","usage":{"promptTokens":10,"completionTokens":5,"totalTokens":15,"cost":0.01},"latencyMs":42,"generationId":"gen-1","finishReason":"stop","repair":{"tier":"deterministic","attempt":2,"verdict":"near-miss","score":1,"ops":{"close-object":1}},"schemaEnforced":true,"attempts":2,"decodeStatus":"retried","decodeOutcome":"ok","lengthCapped":true,"validationErrors":["answer must be a string"],"subject":"Judged","decision":"PickRow","supplements":[{"contributor":"craft","slot":"craft","id":"n1","hash":"h1","bytes":4}],"reasoningOff":true,"estimatedPromptTokens":7,"phases":{"totalMs":5,"completeMs":2,"attempts":[{"attempt":1,"wallMs":2}],"cachePrefixHash":"abc"}}'
  ],
  [
    { keepIo: true, keepPhases: true },
    [
      'tier',
      'craft',
      'capability',
      'promptSegments',
      'text',
      'failedAttempts',
      'strategyId',
      'strategyKind',
      'model',
      'provider',
      'usage',
      'latencyMs',
      'generationId',
      'finishReason',
      'repair',
      'schemaEnforced',
      'attempts',
      'decodeStatus',
      'decodeOutcome',
      'lengthCapped',
      'lever',
      'validationErrors',
      'subject',
      'decision',
      'supplements',
      'reasoningOff',
      'estimatedPromptTokens',
      'phases'
    ],
    String.raw`{"tier":"strong","craft":{"asked":2,"kept":1},"capability":"StrongCap","promptSegments":[{"id":"body","promptSegment":"P","origin":{"kind":"template"}}],"text":"{\"answer\":\"ok\"","failedAttempts":[{"attempt":1,"cause":"schema-validation","error":"answer must be a string","text":"{\"answer\":1}","rawLength":12,"strategyId":"s"}],"strategyId":"s","strategyKind":"scripted","model":"test/strong","provider":"acme","usage":{"promptTokens":10,"completionTokens":5,"totalTokens":15,"cost":0.01},"latencyMs":42,"generationId":"gen-1","finishReason":"stop","repair":{"tier":"deterministic","attempt":2,"verdict":"near-miss","score":1,"ops":{"close-object":1}},"schemaEnforced":true,"attempts":2,"decodeStatus":"retried","decodeOutcome":"ok","lengthCapped":true,"lever":"{\"answer\":\"ok\"}","validationErrors":["answer must be a string"],"subject":"Judged","decision":"PickRow","supplements":[{"contributor":"craft","slot":"craft","id":"n1","hash":"h1","bytes":4}],"reasoningOff":true,"estimatedPromptTokens":7,"phases":{"totalMs":5,"completeMs":2,"attempts":[{"attempt":1,"wallMs":2}],"cachePrefixHash":"abc"}}`
  ]
];

const P2_PINS: ReadonlyArray<GatePin> = [
  [{}, ['capability', 'strategyId'], '{"capability":"MinCap","strategyId":"s"}'],
  [{ keepIo: true }, ['capability', 'promptSegments', 'text', 'strategyId'], '{"capability":"MinCap","promptSegments":[],"text":"hi","strategyId":"s"}'],
  [{ keepPhases: true }, ['capability', 'strategyId'], '{"capability":"MinCap","strategyId":"s"}'],
  [{ keepIo: true, keepPhases: true }, ['capability', 'promptSegments', 'text', 'strategyId'], '{"capability":"MinCap","promptSegments":[],"text":"hi","strategyId":"s"}']
];

// MARK: The chara writer (the oracle)
interface CharaWriterConfig {
  readonly captureIo: boolean;
  readonly recordTimingPhases: boolean;
}

/**
 * The payload literal of dbx-chara's `SoulTelemetryLog.recordLlmCall`, copied from dbx-chara@87d8968a2
 * `packages/chara-soul/src/observe/soul-telemetry-log.ts:361-403` with two edits: its two host keys (`triggerReason`,
 * `stage`) are dropped, and the reply value reads `result.valueJson` where chara read `result.lever` (F9's rename; the
 * row key stays `lever`). Its `...(input.stamp ?? {})` is written `...input.stamp` (the same spread; the lint rule).
 *
 * @param input - The record.
 * @param config - Chara's two gates.
 * @returns The payload chara writes.
 */
function charaWriterPayloadOf(input: LlmCallRecordBase, config: CharaWriterConfig): object {
  const { result } = input;
  const { captureIo, recordTimingPhases } = config;

  return {
    ...input.stamp,
    capability: input.capability,
    ...(captureIo ? { promptSegments: input.segments, text: result.repair?.originalText ?? result.text, ...(input.failedAttempts == null || input.failedAttempts.length === 0 ? {} : { failedAttempts: input.failedAttempts }) } : {}),
    ...llmCallTelemetry(result),
    ...(input.tier == null ? {} : { tier: input.tier }),
    ...(result.schemaEnforced == null ? {} : { schemaEnforced: result.schemaEnforced }),
    ...(result.attempts == null ? {} : { attempts: result.attempts }),
    ...(result.decodeStatus == null ? {} : { decodeStatus: result.decodeStatus }),
    ...(result.decodeOutcome == null ? {} : { decodeOutcome: result.decodeOutcome }),
    ...(result.lengthCapped == null ? {} : { lengthCapped: result.lengthCapped }),
    ...(captureIo && result.valueJson != null ? { lever: result.valueJson } : {}),
    ...(result.validationErrors == null ? {} : { validationErrors: result.validationErrors }),
    ...(input.subject == null ? {} : { subject: input.subject }),
    ...(input.decision == null ? {} : { decision: input.decision }),
    ...(input.supplements == null || input.supplements.length === 0 ? {} : { supplements: input.supplements }),
    ...(input.reasoningOff == null ? {} : { reasoningOff: input.reasoningOff }),
    ...(input.estimatedPromptTokens == null ? {} : { estimatedPromptTokens: input.estimatedPromptTokens }),
    ...(recordTimingPhases && input.phases != null ? { phases: input.phases } : {})
  };
}

// MARK: A real dispatcher
const TEMPLATES: ReadonlyArray<LlmPromptTemplate> = [
  { key: 'reply-protocol', role: 'reply-protocol', text: 'A-PROTOCOL' },
  { key: 'instructions', role: 'instructions', text: 'B-CAP' },
  { key: 'context', role: 'context', text: 'C-CTX\n{{liveContext}}' }
];

const ANSWER = type({ answer: 'string' });

const DESCRIPTORS: Readonly<Record<string, LlmCapabilityDescriptor>> = { StrongCap: defineLlmCapability({ capability: 'StrongCap', tier: 'strong', responseSchema: ANSWER, parseValue: (value) => value }) };

const VALID = (value: unknown) => (typeof (value as { answer?: unknown }).answer === 'string' ? true : { error: 'answer must be a string' });

const PICK_ROW = defineLlmDecision({
  decision: 'PickRow',
  describe: 'pick the row a phrase names',
  state: (input: { readonly phrase: string }) => ({ phrase: input.phrase }),
  questions: () => ({ row: llmChoiceQuestion('which row?', { 'row-a': null, 'row-b': null }), any: llmNoulQuestion('does any row fit?') })
});

const SCRIPT: LlmScriptedDecisionScript = () => ({ row: makeLlmDecisionChoiceAnswer({ options: ['row-a', 'row-b'], choice: 'row-b', confidence: 0.82 }), any: makeLlmDecisionNoulAnswer(0.93) });

/**
 * A scripted decision backend whose first send rejects with a 503, then answers.
 *
 * @returns The backend.
 */
function flakyDecisionBackend(): LlmDecisionStrategy {
  const inner = makeLlmScriptedDecisionStrategy({ id: 'account-a', script: SCRIPT });
  let sends = 0;
  return {
    ...inner,
    decide: (decisionRequest, options) => {
      sends += 1;
      return sends === 1 ? Promise.reject(new LlmDecisionTransportError({ message: 'HTTP 503', status: 503 })) : inner.decide(decisionRequest, options);
    }
  };
}

interface SetupConfig {
  readonly replies?: LlmScriptedReplies;
  readonly decisions?: LlmDecisionStrategy;
  readonly stepClock?: boolean;
}

/**
 * A scripted dispatcher (optionally timed on a fixed step clock) capturing every call record.
 *
 * @param config - The replies, the decision backend and the clock.
 * @returns The dispatcher and the captured records.
 */
function setup(config: SetupConfig = {}) {
  const calls: LlmCallRecord[] = [];
  let t = 0;
  const recorder: LlmDispatchRecorder<LlmDispatchRequest> = {
    ...(config.stepClock === true ? { newCallContext: ({ label }) => makeLlmCallContext({ label, now: () => t++ }) } : {}),
    recordCall: (record) => calls.push(record)
  };
  const strategy: LlmStrategy = makeLlmScriptedStrategy({ id: 's', replies: config.replies ?? ['{"answer":"ok"}'] });
  const dispatcher = makeLlmDispatcher<LlmDispatchRequest, LlmDispatchResult>({
    strategies: makeLlmStrategyRegistry([strategy]),
    defaultStrategyId: strategy.id,
    defaultMaxOutputTokens: 1024,
    modelTiers: { fast: 'test/fast', strong: 'test/strong' },
    descriptorOf: (capability) => DESCRIPTORS[capability],
    templateResolver: makeLlmTieredPromptTemplateResolver({ tiers: [{ source: 'defaults', templates: TEMPLATES }] }),
    transportBackoff: () => 0,
    recorder,
    ...(config.decisions == null ? {} : { decisions: { strategies: makeLlmStrategyRegistry([config.decisions]), defaultModel: 'typesafe/jev-1.14' } })
  });
  return { dispatcher, calls };
}

function request(extra: Partial<LlmDispatchRequest> = {}): LlmDispatchRequest {
  return { capability: 'TestCap', renderLiveContext: () => [{ key: 'facts', text: 'D-LIVE' }], ...extra };
}

/**
 * A projected row with its prompt segments swapped for their count (the golden replica pins their bytes) and a
 * wall-clock `latencyMs` swapped for its type.
 *
 * @param row - The row.
 * @returns The row to pin.
 */
function lean(row: object): object {
  const { promptSegments, latencyMs } = row as { readonly promptSegments?: ReadonlyArray<unknown>; readonly latencyMs?: unknown };
  return { ...row, ...(promptSegments == null ? {} : { promptSegments: promptSegments.length }), ...(latencyMs == null ? {} : { latencyMs: typeof latencyMs }) };
}

// MARK: Specs
describe('toLlmCallLogPayload()', () => {
  describe('a maximal record (P1)', () => {
    it.each(P1_PINS)('keeps the stamp first and every library key in the write order, never a host field (%o) (pin)', (config, keys, bytes) => {
      const row = toLlmCallLogPayload(MAX, config);

      expect(row).not.toHaveProperty('requestId');
      expect(Object.keys(row).slice(0, 2)).toEqual(['tier', 'craft']);
      expectPin(row, keys, bytes);
    });
  });

  describe('a minimal record (P2)', () => {
    it.each(P2_PINS)('writes only what is present (%o) (pin)', (config, keys, bytes) => {
      expectPin(toLlmCallLogPayload(MIN, config), keys, bytes);
    });

    it('writes the capability and strategy id alone with no config (pin)', () => {
      expectPin(toLlmCallLogPayload(MIN), ['capability', 'strategyId'], '{"capability":"MinCap","strategyId":"s"}');
    });
  });

  describe('empty lists and false booleans (P3)', () => {
    it.each(GATES)('never writes an empty supplements or failedAttempts, and writes false (%o)', (config) => {
      const row = toLlmCallLogPayload(EMPTY_LISTS, config);

      expect(row).not.toHaveProperty('supplements');
      expect(row).not.toHaveProperty('failedAttempts');
      expect(row.reasoningOff).toBe(false);
      expect(row.schemaEnforced).toBe(false);
    });
  });

  describe('parity with the dbx-chara writer (P4)', () => {
    const records: ReadonlyArray<readonly [string, LlmCallRecordBase]> = [
      ['maximal', MAX],
      ['minimal', MIN],
      ['empty lists', EMPTY_LISTS],
      ['decision with a stamp', DECISION],
      ['repaired completion', REPAIRED]
    ];

    describe.each(records)('the %s record', (_name, record) => {
      it.each(GATES)('writes the bytes chara writes (%o)', (config) => {
        const captureIo = config.keepIo === true;
        const recordTimingPhases = config.keepPhases === true;

        expect(JSON.stringify(toLlmCallLogPayload(record, config))).toBe(JSON.stringify(charaWriterPayloadOf(record, { captureIo, recordTimingPhases })));
      });
    });
  });

  describe('the rows of real dispatches (P5)', () => {
    it('keeps the row of a retried completion under a fixed clock (pin)', async () => {
      const { dispatcher, calls } = setup({ replies: ['{"answer":1}', '{"answer":"ok"}'], stepClock: true });
      await dispatcher.dispatch(request({ capability: 'StrongCap', validate: VALID }));

      expectPin(
        lean(toLlmCallLogPayload(calls[0], { keepIo: true, keepPhases: true })),
        ['capability', 'promptSegments', 'text', 'failedAttempts', 'strategyId', 'strategyKind', 'model', 'tier', 'attempts', 'decodeStatus', 'decodeOutcome', 'lever', 'validationErrors', 'reasoningOff', 'estimatedPromptTokens', 'phases'],
        String.raw`{"capability":"StrongCap","promptSegments":5,"text":"{\"answer\":\"ok\"}","failedAttempts":[{"attempt":1,"cause":"schema-validation","error":"answer must be a string","text":"{\"answer\":1}","rawLength":12,"strategyId":"s","strategyKind":"scripted","model":"test/strong","maxOutputTokens":1024,"retry":{"lever":"reasoning-low","from":"off","to":"low","cause":"schema-validation","headroom":2048}}],"strategyId":"s","strategyKind":"scripted","model":"test/strong","tier":"strong","attempts":2,"decodeStatus":"retried","decodeOutcome":"ok","lever":"{\"answer\":\"ok\"}","validationErrors":["attempt 1: answer must be a string"],"reasoningOff":true,"estimatedPromptTokens":88,"phases":{"totalMs":19,"renderMs":1,"assembleMs":1,"completeMs":2,"attempts":[{"attempt":1,"wallMs":1},{"attempt":2,"wallMs":1,"retry":{"lever":"reasoning-low","from":"off","to":"low","cause":"schema-validation","headroom":2048}}],"promptChars":221,"cachePrefixChars":215,"cachePrefixHash":"ca81ae14b915d426"}}`
      );
    });

    it('keeps the row of a stamped decision with a transport retry (pin)', async () => {
      const { dispatcher, calls } = setup({ decisions: flakyDecisionBackend() });
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'on the pile' }, stamp: (answers) => ({ row: answers.row.choice }) });

      expectPin(
        lean(toLlmCallLogPayload(calls[0], { keepIo: true, keepPhases: true })),
        ['row', 'capability', 'promptSegments', 'text', 'failedAttempts', 'strategyId', 'strategyKind', 'model', 'usage', 'latencyMs', 'attempts', 'decision'],
        String.raw`{"row":"row-b","capability":"PickCap","promptSegments":2,"text":"{\"row\":{\"type\":\"choice\",\"choice\":\"row-b\",\"probabilities\":{\"row-a\":0.18000000000000005,\"row-b\":0.82},\"confidence\":0.82},\"any\":{\"type\":\"noul\",\"noul\":0.93}}","failedAttempts":[{"attempt":1,"cause":"transport","error":"LlmDecisionTransportError 503: HTTP 503","text":"","rawLength":0,"strategyId":"account-a","finishReason":"__transport__"}],"strategyId":"account-a","strategyKind":"scripted-decision","model":"typesafe/jev-1.14","usage":{"promptTokens":0,"completionTokens":0,"totalTokens":0,"cost":0},"latencyMs":"number","attempts":2,"decision":"PickRow"}`
      );
    });

    it('keeps the row of a deterministic repair, the model bytes as text (pin)', async () => {
      const { dispatcher, calls } = setup({ replies: [{ text: '{"answer":"ok"', finishReason: 'stop' }] });
      await dispatcher.dispatch(request({ validate: VALID }));

      expectPin(
        lean(toLlmCallLogPayload(calls[0], { keepIo: true, keepPhases: true })),
        ['capability', 'promptSegments', 'text', 'strategyId', 'strategyKind', 'model', 'finishReason', 'repair', 'tier', 'attempts', 'decodeStatus', 'decodeOutcome', 'lever', 'reasoningOff', 'estimatedPromptTokens'],
        String.raw`{"capability":"TestCap","promptSegments":4,"text":"{\"answer\":\"ok\"","strategyId":"s","strategyKind":"scripted","model":"test/fast","finishReason":"stop","repair":{"tier":"deterministic","attempt":1,"verdict":"near-miss","score":1,"ops":{"close-object":1}},"tier":"fast","attempts":1,"decodeStatus":"clean","decodeOutcome":"ok","lever":"{\"answer\":\"ok\"}","reasoningOff":true,"estimatedPromptTokens":12}`
      );
    });
  });
});

describe('the call row: write vs read (type-level)', () => {
  it('declares on the read type every key the projector writes, and writes every key but the legacy prompt', () => {
    expectTypeOf<LlmCallLogPayloadWrite>().toExtend<LlmCallLogPayloadBase>();
    expectTypeOf<Exclude<keyof LlmCallLogPayloadWrite, keyof LlmCallLogPayloadBase>>().toEqualTypeOf<never>();
    expectTypeOf<Exclude<keyof LlmCallLogPayloadBase, keyof LlmCallLogPayloadWrite>>().toEqualTypeOf<'prompt'>();
    expectTypeOf<LlmCallFailedAttempt>().toExtend<LlmCallFailedAttemptRow>();
  });

  // a new record or result field fails here until it is projected (and declared) or named as unprojected
  it('projects or names every record and result field', () => {
    expectTypeOf<Exclude<keyof LlmCallRecordBase, keyof LlmCallLogPayloadWrite>>().toEqualTypeOf<'prompt' | 'segments' | 'result' | 'stamp'>();
    expectTypeOf<Exclude<keyof LlmDispatchResult, keyof LlmCallLogPayloadWrite>>().toEqualTypeOf<'meta' | 'attachmentsSent' | 'valueJson'>();
  });
});
