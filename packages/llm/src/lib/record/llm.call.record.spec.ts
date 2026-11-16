/**
 * The call records: the event-type tags hosts persist, and the host extension — a host's own fields sit at the TOP
 * LEVEL of every record and tap event (`…Base & H`), never nested, and `H` may narrow a library field. Most checks
 * here are compile-time; the commit gate's typecheck runs them.
 */

import { describe, it, expect } from 'vitest';
import type { LlmDispatchResult } from '../strategy/llm.strategy';
import { LLM_CALL_EVENT_TYPE, LLM_CALL_START_EVENT_TYPE, LLM_DECODE_FAILURE_EVENT_TYPE, type LlmCallRecord, type LlmCallStartRecord, type LlmDecodeFailureRecord } from './llm.call.record';
import type { LlmDispatchCompleteTapEvent } from './llm.dispatch.tap';

const RESULT: LlmDispatchResult = { text: '{}', strategyId: 'openrouter', capability: 'summarize' };

interface RequestFields {
  readonly requestId: string;
}

describe('call record event types', () => {
  it('pins the three persisted event-type strings', () => {
    expect(LLM_CALL_EVENT_TYPE).toBe('llm_call');
    expect(LLM_CALL_START_EVENT_TYPE).toBe('llm_call_start');
    expect(LLM_DECODE_FAILURE_EVENT_TYPE).toBe('llm_decode_failure');
  });
});

describe('the host extension', () => {
  it('carries the host fields at the top level of a record', () => {
    const record: LlmCallRecord<RequestFields> = { capability: 'summarize', prompt: 'P', segments: [{ id: 'body', promptSegment: 'P', origin: { kind: 'template' } }], result: RESULT, requestId: 'r1' };

    expect(record.requestId).toBe('r1');
    expect(Object.keys(record)).toEqual(['capability', 'prompt', 'segments', 'result', 'requestId']);
  });

  it('rejects a host key on a plain record literal', () => {
    const record: LlmCallRecord = {
      capability: 'summarize',
      prompt: 'P',
      segments: [],
      result: RESULT,
      // @ts-expect-error -- a plain record declares no host fields
      requestId: 'r1'
    };

    expect(record.capability).toBe('summarize');
  });

  it('lets H narrow a library field to a subtype', () => {
    interface AppDispatchResult extends LlmDispatchResult {
      readonly region: string;
    }

    const record: LlmCallRecord<{ readonly result: AppDispatchResult }> = { capability: 'summarize', prompt: '', segments: [], result: { ...RESULT, region: 'eu' } };

    expect(record.result.region).toBe('eu');
  });

  it('requires the start record model and keeps the decode-failure payload beside the host fields', () => {
    // @ts-expect-error -- the start record's model is always present
    const missingModel: LlmCallStartRecord = { capability: 'summarize' };
    const start: LlmCallStartRecord<RequestFields> = { capability: 'summarize', model: 'vendor/model-flash', requestId: 'r1' };
    const failure: LlmDecodeFailureRecord<RequestFields> = { payload: { capability: 'summarize', promptId: 'abc', promptChars: 1, contextExcerpt: '', attempts: 1, recovered: false, failures: [] }, requestId: 'r1' };

    expect(missingModel.capability).toBe('summarize');
    expect(start.requestId).toBe(failure.requestId);
  });

  it('builds a tap event from a record object without losing a field', () => {
    const record: LlmCallRecord<RequestFields> = { capability: 'summarize', prompt: 'P', segments: [], result: RESULT, tier: 'fast', requestId: 'r1' };
    const event: LlmDispatchCompleteTapEvent<RequestFields> = { ...record, recovered: true };

    expect(event).toEqual({ ...record, recovered: true });
    expect(event.requestId).toBe('r1');
  });
});
