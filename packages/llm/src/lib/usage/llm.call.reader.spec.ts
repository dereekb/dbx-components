/**
 * The call-record readers — `readLlmCallPrompt`, `readLlmCallPromptSegments`, `readLlmCallFailedAttempts`,
 * `formatLlmCallAttempts` and `isDecisionLlmCallRow` — on persisted payloads, flat-prompt payloads (no segments), and
 * the in-memory records the dispatcher hands its recorder (a retried and a dropped dispatch). The host's writer object
 * (its envelope columns, correlation ids and call-context factory) is the host's, and out of scope.
 */

import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { makeLlmScriptedStrategy, type LlmScriptedReplies } from '@dereekb/llm/test';
import { defineLlmCapability, type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { type LlmModelTierMap } from '../model/llm.model.tier';
import { type LlmPromptSegment } from '../prompt/llm.prompt.segment';
import { type LlmPromptTemplate, makeLlmTieredPromptTemplateResolver } from '../prompt/llm.prompt.template';
import { LLM_CALL_EVENT_TYPE, type LlmCallFailedAttempt, type LlmCallRecord } from '../record/llm.call.record';
import { type LlmCritic } from '../reply/llm.reply.critique';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
import { makeLlmStrategyRegistry } from '../strategy/llm.strategy.registry';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmDispatchRecorder } from '../dispatch/llm.dispatcher.config';
import { makeLlmDispatcher } from '../dispatch/llm.dispatcher.pipeline';
import { formatLlmCallAttempts, isDecisionLlmCallRow, LLM_FAILED_ATTEMPT_SUMMARY_ERROR_MAX_LENGTH, readLlmCallFailedAttempts, readLlmCallPrompt, readLlmCallPromptSegments } from './llm.call.reader';

// MARK: Fixtures
function segmentsOf(text: string): ReadonlyArray<LlmPromptSegment> {
  return [{ id: 'body', promptSegment: text, origin: { kind: 'generated' } }];
}

const ROW: LlmCallFailedAttempt = { attempt: 1, cause: 'schema-validation', error: 'summary.title must be a string (was missing)', text: '{"title":1}', rawLength: 11, strategyId: 'vendor', retry: { lever: 'reasoning-low', from: 'off', to: 'low', cause: 'schema-validation' } };

const KINDS: ReadonlySet<string> = new Set(['vendor-decisions']);

describe('readLlmCallPrompt()', () => {
  it('should answer the join of a segments-only payload', () => {
    expect(readLlmCallPrompt({ capability: 'summarize', promptSegments: [...segmentsOf('A\n\n'), { id: 'tail', promptSegment: 'B', origin: { kind: 'generated' } }] })).toBe('A\n\nB');
  });

  it('should prefer a flat prompt over segments', () => {
    expect(readLlmCallPrompt({ capability: 'summarize', prompt: 'FLAT', promptSegments: segmentsOf('SEGMENTED') })).toBe('FLAT');
  });

  it('should answer an in-memory record its own prompt', () => {
    expect(readLlmCallPrompt({ capability: 'summarize', prompt: 'RECORD', segments: segmentsOf('RECORD') })).toBe('RECORD');
  });

  it('should answer undefined when nothing carries a prompt', () => {
    expect(readLlmCallPrompt({})).toBeUndefined();
    expect(readLlmCallPrompt(undefined)).toBeUndefined();
    expect(readLlmCallPrompt(null)).toBeUndefined();
    expect(readLlmCallPrompt('a string')).toBeUndefined();
  });
});

describe('readLlmCallPromptSegments()', () => {
  it('should return the persisted promptSegments by reference', () => {
    const promptSegments = segmentsOf('P');
    expect(readLlmCallPromptSegments({ promptSegments })).toBe(promptSegments);
  });

  it("should return an in-memory record's segments by reference", () => {
    const segments = segmentsOf('R');
    expect(readLlmCallPromptSegments({ prompt: 'R', segments })).toBe(segments);
  });

  it('should prefer promptSegments when both keys are present', () => {
    const promptSegments = segmentsOf('P');
    expect(readLlmCallPromptSegments({ promptSegments, segments: segmentsOf('R') })).toBe(promptSegments);
  });

  it('should answer undefined for an empty, malformed or flat-only payload', () => {
    expect(readLlmCallPromptSegments({ promptSegments: [] })).toBeUndefined();
    expect(readLlmCallPromptSegments({ promptSegments: [{ id: 'x' }] })).toBeUndefined();
    expect(readLlmCallPromptSegments({ prompt: 'FLAT' })).toBeUndefined();
  });
});

describe('readLlmCallFailedAttempts()', () => {
  it('should answer undefined when no well-formed row is present', () => {
    expect(readLlmCallFailedAttempts({})).toBeUndefined();
    expect(readLlmCallFailedAttempts(undefined)).toBeUndefined();
    expect(readLlmCallFailedAttempts({ failedAttempts: 'nope' })).toBeUndefined();
    expect(readLlmCallFailedAttempts({ failedAttempts: [{ attempt: 'one' }] })).toBeUndefined();
  });

  it('should drop a malformed row and keep the well-formed ones', () => {
    expect(readLlmCallFailedAttempts({ failedAttempts: [ROW, { attempt: 2, cause: 'parse-error' }, null] })).toEqual([ROW]);
  });
});

describe('formatLlmCallAttempts()', () => {
  it('should summarize each failed attempt with its cause, cut error, lever and the replies pointer', () => {
    const event = { type: LLM_CALL_EVENT_TYPE, payload: { attempts: 2, decodeStatus: 'dropped', failedAttempts: [ROW, { ...ROW, attempt: 2, cause: 'parse-error', error: undefined, retry: undefined }] } };

    expect(formatLlmCallAttempts(event, { repliesPointer: 'replies: call r236' })).toBe('attempts 2 dropped · #1 schema-validation: summary.title must be a string (was missing) → reasoning-low · #2 parse-error (replies: call r236)');
    expect(formatLlmCallAttempts(event)).not.toContain('replies:');
  });

  it('should say how many failed replies were not captured when the row carries none', () => {
    expect(formatLlmCallAttempts({ type: LLM_CALL_EVENT_TYPE, payload: { attempts: 2, decodeStatus: 'retried' } })).toBe('attempts 2 retried · 1 failed reply not captured');
    expect(formatLlmCallAttempts({ type: LLM_CALL_EVENT_TYPE, payload: { attempts: 3, decodeStatus: 'dropped' } })).toBe('attempts 3 dropped · 3 failed replies not captured');
  });

  it('should answer undefined for a clean call and for any other event', () => {
    expect(formatLlmCallAttempts({ type: LLM_CALL_EVENT_TYPE, payload: { attempts: 1, decodeStatus: 'clean' } })).toBeUndefined();
    expect(formatLlmCallAttempts({ type: LLM_CALL_EVENT_TYPE, payload: {} })).toBeUndefined();
    expect(formatLlmCallAttempts({ type: 'other_event', payload: { attempts: 2 } })).toBeUndefined();
  });

  it('should collapse whitespace in the error and cap it', () => {
    const long = `line one\n\n   ${'z'.repeat(200)}`;
    const summary = formatLlmCallAttempts({ type: LLM_CALL_EVENT_TYPE, payload: { attempts: 2, decodeStatus: 'retried', failedAttempts: [{ ...ROW, error: long }] } }) ?? '';
    const errorPart = summary.split(': ')[1].split(' → ')[0];

    expect(errorPart.startsWith('line one z')).toBe(true);
    expect(errorPart.length).toBeLessThanOrEqual(LLM_FAILED_ATTEMPT_SUMMARY_ERROR_MAX_LENGTH);
  });
});

describe('isDecisionLlmCallRow()', () => {
  it('should read the lane from strategyKind', () => {
    expect(isDecisionLlmCallRow({ strategyKind: 'vendor-decisions', strategyId: 'account-a' }, KINDS)).toBe(true);
  });

  it('should fall back to a pre-split strategyId', () => {
    expect(isDecisionLlmCallRow({ strategyId: 'vendor-decisions' }, KINDS)).toBe(true);
  });

  it('should recognize a declared decision id with no kinds', () => {
    expect(isDecisionLlmCallRow({ strategyKind: 'scripted-decisions', decision: 'pick-route' })).toBe(true);
  });

  it('should prefer strategyKind over strategyId', () => {
    expect(isDecisionLlmCallRow({ strategyKind: 'vendor', strategyId: 'vendor-decisions' }, KINDS)).toBe(false);
  });

  it('should answer false for an empty row and a non-object', () => {
    expect(isDecisionLlmCallRow({}, KINDS)).toBe(false);
    expect(isDecisionLlmCallRow(undefined, KINDS)).toBe(false);
    expect(isDecisionLlmCallRow('x', KINDS)).toBe(false);
  });
});

// MARK: Dispatcher records
const TEMPLATES: ReadonlyArray<LlmPromptTemplate> = [
  { key: 'reply-protocol', role: 'reply-protocol', text: 'A-PROTOCOL' },
  { key: 'instructions', role: 'instructions', text: 'B-CAP' },
  { key: 'context', role: 'context', text: 'C-CTX\n{{liveContext}}' }
];

const RESOLVER = makeLlmTieredPromptTemplateResolver({ tiers: [{ source: 'defaults', templates: TEMPLATES }] });

const TIERS: LlmModelTierMap = { fast: 'test/fast', strong: 'test/strong' };

const ANSWER = type({ answer: 'string' });

const DESCRIPTORS: Readonly<Record<string, LlmCapabilityDescriptor>> = {
  TestCap: defineLlmCapability({ capability: 'TestCap', responseSchema: ANSWER, parseValue: (value) => value })
};

const VALID = (value: unknown) => (typeof (value as { answer?: unknown }).answer === 'string' ? true : { error: 'answer must be a string' });

const OK = '{"answer":"ok"}';
const INVALID = '{"answer":1}';

function request(extra: Partial<LlmDispatchRequest> = {}): LlmDispatchRequest {
  return { capability: 'TestCap', renderLiveContext: () => [{ key: 'facts', text: 'D-LIVE' }], ...extra };
}

function recording() {
  const calls: LlmCallRecord[] = [];
  const recorder: LlmDispatchRecorder<LlmDispatchRequest> = { recordCall: (record) => calls.push(record) };
  return { calls, recorder };
}

function setup(replies: LlmScriptedReplies, recorder: LlmDispatchRecorder<LlmDispatchRequest>) {
  const strategy = makeLlmScriptedStrategy({ id: 's', replies });
  return makeLlmDispatcher<LlmDispatchRequest, LlmDispatchResult>({
    strategies: makeLlmStrategyRegistry([strategy]),
    defaultStrategyId: strategy.id,
    defaultMaxOutputTokens: 1024,
    modelTiers: TIERS,
    descriptorOf: (capability) => DESCRIPTORS[capability],
    templateResolver: RESOLVER,
    transportBackoff: () => 0,
    recorder
  });
}

describe('the readers on dispatcher-recorded calls', () => {
  it('should read a retried call record', async () => {
    const { calls, recorder } = recording();
    await setup([INVALID, OK], recorder).dispatch(request({ validate: VALID }));

    expect(calls).toHaveLength(1);
    const record = calls[0];

    expect(record.result.attempts).toBe(2);
    expect(record.result.decodeStatus).toBe('retried');
    expect(record.failedAttempts).toHaveLength(1);
    expect(readLlmCallPrompt(record)).toBe(record.prompt);
    expect(readLlmCallPromptSegments(record)).toBe(record.segments);
    expect(readLlmCallFailedAttempts(record)).toEqual(record.failedAttempts);

    const row = (record.failedAttempts ?? [])[0];
    const expected = `attempts 2 retried · #1 ${row.cause}${row.error == null ? '' : `: ${row.error}`}${row.retry == null ? '' : ` → ${row.retry.lever}`}`;

    expect(formatLlmCallAttempts({ type: LLM_CALL_EVENT_TYPE, payload: { attempts: record.result.attempts, decodeStatus: record.result.decodeStatus, failedAttempts: record.failedAttempts } })).toBe(expected);
  });

  it('should read a dropped call record', async () => {
    const { calls, recorder } = recording();
    await setup([INVALID], recorder).dispatch(request({ validate: VALID }));

    const record = calls[0];

    expect(record.result.decodeStatus).toBe('dropped');
    expect(readLlmCallFailedAttempts(record)).toHaveLength(2);

    const summary = formatLlmCallAttempts({ type: LLM_CALL_EVENT_TYPE, payload: { attempts: record.result.attempts, decodeStatus: record.result.decodeStatus, failedAttempts: record.failedAttempts } }) ?? '';

    expect(summary.startsWith('attempts 2 dropped · #1 ')).toBe(true);
    expect(summary).toContain(' · #2 ');
  });

  it('should read a critique-exhausted call record as retried, the shipped attempt filing no row', async () => {
    const { calls, recorder } = recording();
    const critique: LlmCritic = async () => ({ error: 'too vague' });
    await setup([OK, OK], recorder).dispatch(request({ critique }));

    const record = calls[0];

    expect(record.result.decodeStatus).toBe('retried');
    expect(formatLlmCallAttempts({ type: LLM_CALL_EVENT_TYPE, payload: { attempts: record.result.attempts, decodeStatus: record.result.decodeStatus, failedAttempts: record.failedAttempts } })).toBe('attempts 2 retried · #1 critique: too vague → reasoning-low');
  });
});
