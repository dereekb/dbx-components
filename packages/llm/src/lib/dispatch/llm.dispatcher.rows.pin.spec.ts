/**
 * Byte pins for EVERY row the dispatcher files — the start records, each decode-row branch of the bounded loop and the
 * single shot, the failed rows (completion and decision lanes), an attempt phase with a repair, and the whole
 * decode-failure record — driven end-to-end through a scripted dispatcher, so a later refactor of the row builders or
 * the repair lane proves itself byte-identical here (review 2, D4 step 0).
 *
 * Already pinned elsewhere, and not repeated: the decode row's and the failed row's base key order (max and min) in
 * `llm.dispatch.outcome.spec.ts`; the loop phases block (with `retry` / `headroom`) in `llm.dispatcher.retry.spec.ts`;
 * the single-shot phases block and the call record's top-level key order in `llm.dispatcher.pipeline.spec.ts`.
 *
 * Each pin checks `Object.keys` (the order) then `JSON.stringify` (the bytes); an unbounded string is swapped for its
 * length before stringifying.
 */

import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { makeLlmDecisionChoiceAnswer, makeLlmDecisionNoulAnswer, makeLlmScriptedDecisionStrategy, makeLlmScriptedStrategy, type LlmScriptedCompletion, type LlmScriptedDecisionScript, type LlmScriptedReplies } from '@dereekb/llm/test';
import { defineLlmCapability, type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { defineLlmDecision } from '../decision/llm.decision.descriptor';
import { llmChoiceQuestion, llmNoulQuestion } from '../decision/llm.decision.question';
import { type LlmDecisionStrategy, LlmDecisionTransportError } from '../decision/llm.decision.strategy';
import { type LlmModelTierMap } from '../model/llm.model.tier';
import { type LlmLiveContextBlock } from '../prompt/llm.prompt.live.context';
import { type LlmPromptTemplate, makeLlmTieredPromptTemplateResolver } from '../prompt/llm.prompt.template';
import { makeLlmCallContext } from '../record/llm.call.context';
import { type LlmCallRecord, type LlmCallStartRecord, type LlmDecodeFailureRecord } from '../record/llm.call.record';
import { type LlmReplyFastFixer } from '../reply/llm.reply.fast.fix';
import { type LlmDispatchResult, type LlmStrategy } from '../strategy/llm.strategy';
import { makeLlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { type LlmDispatchRequest } from './llm.dispatch.request';
import { type LlmDispatcherConfig, type LlmDispatchRecorder } from './llm.dispatcher.config';
import { makeLlmDispatcher } from './llm.dispatcher.pipeline';

// MARK: Fixtures
const TEMPLATES: ReadonlyArray<LlmPromptTemplate> = [
  { key: 'reply-protocol', role: 'reply-protocol', text: 'A-PROTOCOL' },
  { key: 'instructions', role: 'instructions', text: 'B-CAP' },
  { key: 'context', role: 'context', text: 'C-CTX\n{{liveContext}}' }
];

const RESOLVER = makeLlmTieredPromptTemplateResolver({ tiers: [{ source: 'defaults', templates: TEMPLATES }] });

const TIERS: LlmModelTierMap = { fast: 'test/fast', strong: 'test/strong' };

const ANSWER = type({ answer: 'string' });

function descriptorOf(config: Omit<Parameters<typeof defineLlmCapability>[0], 'responseSchema' | 'parseValue'>): LlmCapabilityDescriptor {
  return defineLlmCapability({ responseSchema: ANSWER, parseValue: (value) => value, ...config });
}

const DESCRIPTORS: Readonly<Record<string, LlmCapabilityDescriptor>> = { StrongCap: descriptorOf({ capability: 'StrongCap', tier: 'strong' }), EnvelopeCap: descriptorOf({ capability: 'EnvelopeCap', replyProtocol: 'json-envelope' }) };

const VALID = (value: unknown) => (typeof (value as { answer?: unknown }).answer === 'string' ? true : { error: 'answer must be a string' });

const OK = '{"answer":"ok"}';
const INVALID = '{"answer":1}';

/**
 * A completion the cap ended, with no text and every completion token spent reasoning.
 */
const CAP: LlmScriptedCompletion = { text: '', finishReason: 'length', usage: { promptTokens: 10, completionTokens: 2048, totalTokens: 2058, reasoningTokens: 2048 } };

const TRUNCATED: LlmScriptedCompletion = {
  text: '{"answer":"cut off mid',
  finishReason: 'length'
};

/**
 * A clean-stop reply one `close-object` op repairs into a VALID value.
 */
const NEAR_MISS: LlmScriptedCompletion = {
  text: '{"answer":"ok"',
  finishReason: 'stop'
};

/**
 * A clean-stop reply one `close-object` op repairs into a value the validator REJECTS.
 */
const NEAR_MISS_INVALID: LlmScriptedCompletion = {
  text: '{"answer":1',
  finishReason: 'stop'
};

/**
 * A clean-stop json-envelope decline one `close-object` op repairs.
 */
const NEAR_MISS_DECLINE: LlmScriptedCompletion = {
  text: '{"answerable":false,"rationale":"nothing to answer"',
  finishReason: 'stop'
};

/**
 * A mangled reply the deterministic tier cannot repair, scored above the fast-fix floor.
 */
const MANGLED: LlmScriptedCompletion = { text: '{"answer":"a long enough line of feedback","n":None}', finishReason: 'stop' };

/**
 * An unrepairable prose reply over the 500-char excerpt cap, so its row carries a tail excerpt.
 */
const LONG_PROSE: LlmScriptedCompletion = { text: Array.from({ length: 150 }, (_, index) => `word${index}`).join(' '), finishReason: 'stop' };

const SCHEMA_HINT = { type: 'object', properties: { answer: { type: 'string' } } };

function blocks(text: string, key = 'facts'): ReadonlyArray<LlmLiveContextBlock> {
  return [{ key, text }];
}

function request(extra: Partial<LlmDispatchRequest> = {}): LlmDispatchRequest {
  return { capability: 'TestCap', renderLiveContext: () => blocks('D-LIVE'), ...extra };
}

function statusError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

const PICK_ROW = defineLlmDecision({
  decision: 'PickRow',
  describe: 'pick the row a phrase names',
  state: (input: { readonly phrase: string }) => ({ phrase: input.phrase }),
  questions: () => ({ row: llmChoiceQuestion('which row?', { 'row-a': null, 'row-b': null }), any: llmNoulQuestion('does any row fit?') })
});

const SCRIPT: LlmScriptedDecisionScript = () => ({ row: makeLlmDecisionChoiceAnswer({ options: ['row-a', 'row-b'], choice: 'row-b', confidence: 0.82 }), any: makeLlmDecisionNoulAnswer(0.93) });

/**
 * A scripted decision backend whose first send rejects with a 503, then answers.
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

interface HostFields {
  readonly host?: string;
}

interface Recording {
  readonly starts: LlmCallStartRecord<HostFields>[];
  readonly calls: LlmCallRecord<HostFields>[];
  readonly decodeFailures: LlmDecodeFailureRecord<HostFields>[];
  readonly recorder: LlmDispatchRecorder<LlmDispatchRequest, HostFields>;
}

/**
 * A recorder capturing every record; `stepClock` times each root context on a fixed step clock (phases appear).
 */
function recording(stepClock?: boolean): Recording {
  const starts: LlmCallStartRecord<HostFields>[] = [];
  const calls: LlmCallRecord<HostFields>[] = [];
  const decodeFailures: LlmDecodeFailureRecord<HostFields>[] = [];
  let t = 0;
  const recorder: LlmDispatchRecorder<LlmDispatchRequest, HostFields> = {
    ...(stepClock === true ? { newCallContext: ({ label }) => makeLlmCallContext({ label, now: () => t++ }) } : {}),
    recordCallStart: (record) => starts.push(record),
    recordCall: (record) => calls.push(record),
    recordDecodeFailure: (record) => decodeFailures.push(record)
  };
  return { starts, calls, decodeFailures, recorder };
}

type SetupConfig = Partial<LlmDispatcherConfig<LlmDispatchRequest, LlmDispatchResult, HostFields>> & { readonly replies?: LlmScriptedReplies; readonly strategy?: LlmStrategy; readonly stepClock?: boolean };

/**
 * A scripted dispatcher whose records carry one host field naming their kind, so each record shows where host fields land.
 */
function setup(config: SetupConfig = {}) {
  const { replies, strategy, stepClock, ...rest } = config;
  const recorded = recording(stepClock);
  const used = strategy ?? makeLlmScriptedStrategy({ id: 's', replies: replies ?? [OK] });
  const dispatcher = makeLlmDispatcher<LlmDispatchRequest, LlmDispatchResult, HostFields>({
    strategies: makeLlmStrategyRegistry([used]),
    defaultStrategyId: used.id,
    defaultMaxOutputTokens: 1024,
    modelTiers: TIERS,
    descriptorOf: (capability) => DESCRIPTORS[capability],
    templateResolver: RESOLVER,
    transportBackoff: () => 0,
    recorder: recorded.recorder,
    recordFieldsOf: ({ kind }) => ({ host: kind }),
    ...rest
  });
  return { dispatcher, ...recorded };
}

function decisionSetup(backend: LlmDecisionStrategy) {
  return setup({ decisions: { strategies: makeLlmStrategyRegistry([backend]), defaultModel: 'typesafe/jev-1.14' } });
}

/**
 * Settle a dispatch that may reject — the pins read the records, not the outcome.
 */
async function settled(promise: Promise<unknown>): Promise<void> {
  await promise.then(
    () => undefined,
    () => undefined
  );
}

function expectPin(value: object, keys: ReadonlyArray<string>, bytes: string): void {
  expect(Object.keys(value)).toEqual(keys);
  expect(JSON.stringify(value)).toBe(bytes);
}

/**
 * Pin a list of rows — each row's key order, then the list's bytes.
 */
function expectRowsPin(rows: ReadonlyArray<object>, keys: ReadonlyArray<ReadonlyArray<string>>, bytes: string): void {
  expect(rows.map((row) => Object.keys(row))).toEqual(keys);
  expect(JSON.stringify(rows)).toBe(bytes);
}

/**
 * The one decode row of a dispatch that filed exactly one.
 */
function onlyDecodeRowOf(decodeFailures: ReadonlyArray<LlmDecodeFailureRecord<HostFields>>) {
  expect(decodeFailures).toHaveLength(1);
  expect(decodeFailures[0].payload.failures).toHaveLength(1);
  return decodeFailures[0].payload.failures[0];
}

// MARK: Specs
describe('makeLlmDispatcher() rows (pin)', () => {
  describe('start records', () => {
    it('keeps the completion-lane start record key order and bytes (pin)', async () => {
      const { dispatcher, starts } = setup();
      await dispatcher.dispatch(request({ capability: 'StrongCap' }));

      expectPin(starts[0], ['capability', 'model', 'tier', 'strategyId', 'strategyKind', 'host'], '{"capability":"StrongCap","model":"test/strong","tier":"strong","strategyId":"s","strategyKind":"scripted","host":"start"}');
    });

    it('keeps the decision-lane start record key order and bytes (pin)', async () => {
      const { dispatcher, starts } = decisionSetup(makeLlmScriptedDecisionStrategy({ id: 'account-a', script: SCRIPT }));
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'on the pile' } });

      expectPin(starts[0], ['capability', 'model', 'strategyId', 'strategyKind', 'host'], '{"capability":"PickCap","model":"typesafe/jev-1.14","strategyId":"account-a","strategyKind":"scripted-decision","host":"start"}');
    });
  });

  describe('decode rows', () => {
    it('keeps a transport row a retry follows, with its lever and transport summary (pin)', async () => {
      const { dispatcher, decodeFailures } = setup({ replies: [statusError('rate limited', 429), OK] });
      await dispatcher.dispatch(request({ validate: VALID }));

      expectPin(
        onlyDecodeRowOf(decodeFailures),
        ['attempt', 'class', 'excerpt', 'rawLength', 'finishReason', 'maxOutputTokens', 'lever', 'transportError'],
        '{"attempt":1,"class":"transport","excerpt":"","rawLength":0,"finishReason":"__transport__","maxOutputTokens":1024,"lever":"none","transportError":"Error 429: rate limited"}'
      );
    });

    it('keeps an unretryable row with its error classification (pin)', async () => {
      const { dispatcher, decodeFailures } = setup({ replies: [statusError('http 401', 401)] });
      await settled(dispatcher.dispatch(request({ validate: VALID })));

      expectPin(
        onlyDecodeRowOf(decodeFailures),
        ['attempt', 'class', 'excerpt', 'rawLength', 'finishReason', 'maxOutputTokens', 'transportError', 'errorClassification'],
        '{"attempt":1,"class":"unretryable","excerpt":"","rawLength":0,"finishReason":"__unretryable__","maxOutputTokens":1024,"transportError":"Error 401: http 401","errorClassification":"permanent"}'
      );
    });

    it('keeps a length-truncation row with its budget lever (pin)', async () => {
      const { dispatcher, decodeFailures } = setup({ replies: [TRUNCATED, OK] });
      await dispatcher.dispatch(request({ validate: VALID }));

      expectPin(onlyDecodeRowOf(decodeFailures), ['attempt', 'class', 'excerpt', 'rawLength', 'finishReason', 'maxOutputTokens', 'lever'], String.raw`{"attempt":1,"class":"length-truncation","excerpt":"{\"answer\":\"cut off mid","rawLength":22,"finishReason":"length","maxOutputTokens":1024,"lever":"budget"}`);
    });

    it('keeps the bonus empty-result row (pin)', async () => {
      const { dispatcher, decodeFailures } = setup({ replies: [INVALID, CAP, OK] });
      await dispatcher.dispatch(request({ validate: VALID }));

      expectPin(
        onlyDecodeRowOf(decodeFailures),
        ['attempt', 'class', 'excerpt', 'rawLength', 'finishReason', 'completionTokens', 'maxOutputTokens', 'lever', 'bonus'],
        '{"attempt":2,"class":"empty-result","excerpt":"","rawLength":0,"finishReason":"length","completionTokens":2048,"maxOutputTokens":2048,"lever":"reasoning-off","bonus":true}'
      );
    });

    it('keeps a parse-error row whose fast fix missed (pin)', async () => {
      const throwing: LlmReplyFastFixer = () => Promise.reject(new Error('fixer down'));
      const { dispatcher, decodeFailures } = setup({ replies: [MANGLED, OK], replyFastFix: throwing });
      await dispatcher.dispatch(request({ validate: VALID, responseSchemaHint: SCHEMA_HINT }));

      expectPin(
        onlyDecodeRowOf(decodeFailures),
        ['attempt', 'class', 'excerpt', 'rawLength', 'shape', 'finishReason', 'maxOutputTokens', 'lever', 'fastFix', 'fastFixMiss'],
        String.raw`{"attempt":1,"class":"parse-error","excerpt":"{\"answer\":\"a long enough line of feedback\",\"n\":None}","rawLength":52,"shape":{"verdict":"mangled","score":0.904},"finishReason":"stop","maxOutputTokens":1024,"lever":"model","fastFix":"missed","fastFixMiss":"error"}`
      );
    });

    it('keeps an accepted repaired row (pin)', async () => {
      const { dispatcher, decodeFailures } = setup({ replies: [NEAR_MISS] });
      await dispatcher.dispatch(request({ validate: VALID }));

      expectPin(
        onlyDecodeRowOf(decodeFailures),
        ['attempt', 'class', 'excerpt', 'rawLength', 'shape', 'finishReason', 'maxOutputTokens', 'repaired', 'repairOps'],
        String.raw`{"attempt":1,"class":"parse-error","excerpt":"{\"answer\":\"ok\"","rawLength":14,"shape":{"verdict":"near-miss","score":1},"finishReason":"stop","maxOutputTokens":1024,"repaired":"deterministic","repairOps":{"close-object":1}}`
      );
    });

    it('keeps a repaired row the validator rejected, with the lever its retry took (pin)', async () => {
      const { dispatcher, decodeFailures } = setup({ replies: [INVALID, NEAR_MISS_INVALID, OK] });
      await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 3 }));

      expectPin(
        onlyDecodeRowOf(decodeFailures),
        ['attempt', 'class', 'excerpt', 'rawLength', 'shape', 'finishReason', 'maxOutputTokens', 'lever', 'repaired', 'repairOps'],
        String.raw`{"attempt":2,"class":"parse-error","excerpt":"{\"answer\":1","rawLength":11,"shape":{"verdict":"near-miss","score":1},"finishReason":"stop","maxOutputTokens":2048,"lever":"model","repaired":"deterministic","repairOps":{"close-object":1}}`
      );
    });

    it('keeps the final schema miss of a repaired reply (pin)', async () => {
      const { dispatcher, decodeFailures } = setup({ replies: [NEAR_MISS_INVALID] });
      await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 1 }));

      expectPin(
        onlyDecodeRowOf(decodeFailures),
        ['attempt', 'class', 'excerpt', 'rawLength', 'finishReason', 'maxOutputTokens', 'validatorError', 'repaired'],
        String.raw`{"attempt":1,"class":"schema-validation","excerpt":"{\"answer\":1","rawLength":11,"finishReason":"stop","maxOutputTokens":1024,"validatorError":"answer must be a string","repaired":"deterministic"}`
      );
    });

    it('keeps a repaired decline row (pin)', async () => {
      const { dispatcher, decodeFailures } = setup({ replies: [NEAR_MISS_DECLINE] });
      await dispatcher.dispatch(request({ capability: 'EnvelopeCap', validate: VALID }));

      expectPin(
        onlyDecodeRowOf(decodeFailures),
        ['attempt', 'class', 'excerpt', 'rawLength', 'shape', 'finishReason', 'maxOutputTokens', 'repaired', 'repairOps'],
        String.raw`{"attempt":1,"class":"parse-error","excerpt":"{\"answerable\":false,\"rationale\":\"nothing to answer\"","rawLength":51,"shape":{"verdict":"near-miss","score":1},"finishReason":"stop","maxOutputTokens":1024,"repaired":"deterministic","repairOps":{"close-object":1}}`
      );
    });

    it('keeps a plain parse-error row with its shape and tail excerpt (pin)', async () => {
      const { dispatcher, decodeFailures } = setup({ replies: [LONG_PROSE] });
      await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 1 }));
      const row = onlyDecodeRowOf(decodeFailures);

      expectPin(
        { ...row, excerpt: row.excerpt.length, tailExcerpt: row.tailExcerpt?.length },
        ['attempt', 'class', 'excerpt', 'tailExcerpt', 'rawLength', 'shape', 'finishReason', 'maxOutputTokens'],
        '{"attempt":1,"class":"parse-error","excerpt":500,"tailExcerpt":200,"rawLength":1089,"shape":{"verdict":"not-json","score":0},"finishReason":"stop","maxOutputTokens":1024}'
      );
    });

    it('keeps a plain final schema-validation row (pin)', async () => {
      const { dispatcher, decodeFailures } = setup({ replies: [INVALID] });
      await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 1 }));

      expectPin(onlyDecodeRowOf(decodeFailures), ['attempt', 'class', 'excerpt', 'rawLength', 'maxOutputTokens', 'validatorError'], String.raw`{"attempt":1,"class":"schema-validation","excerpt":"{\"answer\":1}","rawLength":12,"maxOutputTokens":1024,"validatorError":"answer must be a string"}`);
    });

    it('keeps the single-shot transport fault row, recorded before the rethrow (pin)', async () => {
      const { dispatcher, decodeFailures } = setup({ replies: [statusError('rate limited', 429)] });
      await expect(dispatcher.dispatch(request())).rejects.toThrow('rate limited');

      expectPin(onlyDecodeRowOf(decodeFailures), ['attempt', 'class', 'excerpt', 'rawLength', 'finishReason', 'maxOutputTokens', 'transportError'], '{"attempt":1,"class":"transport","excerpt":"","rawLength":0,"finishReason":"__transport__","maxOutputTokens":1024,"transportError":"Error 429: rate limited"}');
    });

    it("keeps a parse-error row scored on a host fixer's substituted text that still reads degenerate (pin)", async () => {
      const stillBroken: LlmReplyFastFixer = () => Promise.resolve({ kind: 'fixed', value: {}, text: 'still not json' });
      const { dispatcher, decodeFailures } = setup({ replies: [MANGLED, OK], replyFastFix: stillBroken });
      await dispatcher.dispatch(request({ validate: VALID, responseSchemaHint: SCHEMA_HINT }));

      expectPin(
        onlyDecodeRowOf(decodeFailures),
        ['attempt', 'class', 'excerpt', 'rawLength', 'shape', 'finishReason', 'maxOutputTokens', 'lever'],
        '{"attempt":1,"class":"parse-error","excerpt":"still not json","rawLength":14,"shape":{"verdict":"not-json","score":0},"finishReason":"stop","maxOutputTokens":1024,"lever":"model"}'
      );
    });
  });

  describe('failed rows', () => {
    it('keeps the failed rows of a loop with a correction, a repair and a retry (pin)', async () => {
      const { dispatcher, calls } = setup({ replies: [INVALID, NEAR_MISS_INVALID, OK] });
      await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 3 }));

      expectRowsPin(
        calls[0].failedAttempts ?? [],
        [
          ['attempt', 'cause', 'error', 'text', 'rawLength', 'strategyId', 'strategyKind', 'model', 'maxOutputTokens', 'retry'],
          ['attempt', 'cause', 'error', 'text', 'rawLength', 'strategyId', 'strategyKind', 'model', 'finishReason', 'repair', 'maxOutputTokens', 'correction', 'retry']
        ],
        String.raw`[{"attempt":1,"cause":"schema-validation","error":"answer must be a string","text":"{\"answer\":1}","rawLength":12,"strategyId":"s","strategyKind":"scripted","model":"test/fast","maxOutputTokens":1024,"retry":{"lever":"reasoning-low","from":"off","to":"low","cause":"schema-validation","headroom":2048}},{"attempt":2,"cause":"schema-validation","error":"answer must be a string","text":"{\"answer\":1","rawLength":11,"strategyId":"s","strategyKind":"scripted","model":"test/fast","finishReason":"stop","repair":{"tier":"deterministic","attempt":2,"verdict":"near-miss","score":1,"ops":{"close-object":1}},"maxOutputTokens":2048,"correction":"\n\n## Correction\nYour previous reply did not conform to the required output contract: answer must be a string\nReply again with a single JSON object that conforms exactly to the contract.","retry":{"lever":"model","from":"test/fast","to":"test/strong","cause":"schema-validation"}}]`
      );
    });

    it('keeps the failed rows of a bonus attempt (pin)', async () => {
      const { dispatcher, calls } = setup({ replies: [INVALID, CAP, OK] });
      await dispatcher.dispatch(request({ validate: VALID }));

      expectRowsPin(
        calls[0].failedAttempts ?? [],
        [
          ['attempt', 'cause', 'error', 'text', 'rawLength', 'strategyId', 'strategyKind', 'model', 'maxOutputTokens', 'retry'],
          ['attempt', 'cause', 'text', 'rawLength', 'strategyId', 'strategyKind', 'model', 'usage', 'finishReason', 'maxOutputTokens', 'correction', 'retry']
        ],
        String.raw`[{"attempt":1,"cause":"schema-validation","error":"answer must be a string","text":"{\"answer\":1}","rawLength":12,"strategyId":"s","strategyKind":"scripted","model":"test/fast","maxOutputTokens":1024,"retry":{"lever":"reasoning-low","from":"off","to":"low","cause":"schema-validation","headroom":2048}},{"attempt":2,"cause":"empty-result","text":"","rawLength":0,"strategyId":"s","strategyKind":"scripted","model":"test/fast","usage":{"promptTokens":10,"completionTokens":2048,"totalTokens":2058,"reasoningTokens":2048},"finishReason":"length","maxOutputTokens":2048,"correction":"\n\n## Correction\nYour previous reply did not conform to the required output contract: answer must be a string\nReply again with a single JSON object that conforms exactly to the contract.","retry":{"lever":"reasoning-off","from":"low","to":"off","cause":"empty-result","bonus":true,"induced":"reasoning-low"}}]`
      );
    });

    it('keeps the failed row of a decision transport retry (pin)', async () => {
      const { dispatcher, calls } = decisionSetup(flakyDecisionBackend());
      await dispatcher.decide?.({ capability: 'PickCap', decision: PICK_ROW, input: { phrase: 'on the pile' } });

      expectRowsPin(calls[0].failedAttempts ?? [], [['attempt', 'cause', 'error', 'text', 'rawLength', 'strategyId', 'finishReason']], '[{"attempt":1,"cause":"transport","error":"LlmDecisionTransportError 503: HTTP 503","text":"","rawLength":0,"strategyId":"account-a","finishReason":"__transport__"}]');
    });

    it('keeps the failed row of a single-shot transport fault (pin)', async () => {
      const { dispatcher, calls } = setup({ replies: [statusError('rate limited', 429)] });
      await settled(dispatcher.dispatch(request()));

      expectRowsPin(
        calls[0].failedAttempts ?? [],
        [['attempt', 'cause', 'error', 'text', 'rawLength', 'strategyId', 'finishReason', 'maxOutputTokens']],
        '[{"attempt":1,"cause":"transport","error":"Error 429: rate limited","text":"","rawLength":0,"strategyId":"s","finishReason":"__transport__","maxOutputTokens":1024}]'
      );
    });
  });

  describe('phases', () => {
    it('keeps the phases of an attempt the repair lane patched, under a fixed clock (pin)', async () => {
      const { dispatcher, calls } = setup({ replies: [NEAR_MISS], stepClock: true });
      await dispatcher.dispatch(request({ validate: VALID }));

      expectPin(
        calls[0].phases ?? {},
        ['totalMs', 'renderMs', 'assembleMs', 'completeMs', 'attempts', 'promptChars', 'cachePrefixChars', 'cachePrefixHash'],
        '{"totalMs":13,"renderMs":1,"assembleMs":1,"completeMs":1,"attempts":[{"attempt":1,"wallMs":1,"repair":{"tier":"deterministic","attempt":1,"verdict":"near-miss","score":1,"ops":{"close-object":1}}}],"promptChars":31,"cachePrefixChars":25,"cachePrefixHash":"522153e78572010f"}'
      );
    });
  });

  describe('decode-failure records', () => {
    it('keeps a dropped decode-failure record, payload and host field (pin)', async () => {
      const { dispatcher, decodeFailures } = setup({ replies: [INVALID] });
      await dispatcher.dispatch(request({ validate: VALID, maxAttempts: 1 }));

      expectPin(
        decodeFailures[0],
        ['payload', 'host'],
        String.raw`{"payload":{"capability":"TestCap","model":"test/fast","tier":"fast","promptId":"c51bbc0f","promptChars":31,"contextExcerpt":"D-LIVE","attempts":1,"recovered":false,"failures":[{"attempt":1,"class":"schema-validation","excerpt":"{\"answer\":1}","rawLength":12,"maxOutputTokens":1024,"validatorError":"answer must be a string"}]},"host":"decode-failure"}`
      );
      expect(Object.keys(decodeFailures[0].payload)).toEqual(['capability', 'model', 'tier', 'promptId', 'promptChars', 'contextExcerpt', 'attempts', 'recovered', 'failures']);
    });

    it('keeps a recovered decode-failure record, payload and host field (pin)', async () => {
      const { dispatcher, decodeFailures } = setup({ replies: [NEAR_MISS] });
      await dispatcher.dispatch(request({ validate: VALID }));

      expectPin(
        decodeFailures[0],
        ['payload', 'host'],
        String.raw`{"payload":{"capability":"TestCap","model":"test/fast","tier":"fast","promptId":"c51bbc0f","promptChars":31,"contextExcerpt":"D-LIVE","attempts":1,"recovered":true,"failures":[{"attempt":1,"class":"parse-error","excerpt":"{\"answer\":\"ok\"","rawLength":14,"shape":{"verdict":"near-miss","score":1},"finishReason":"stop","maxOutputTokens":1024,"repaired":"deterministic","repairOps":{"close-object":1}}]},"host":"decode-failure"}`
      );
      expect(Object.keys(decodeFailures[0].payload)).toEqual(['capability', 'model', 'tier', 'promptId', 'promptChars', 'contextExcerpt', 'attempts', 'recovered', 'failures']);
    });
  });
});
