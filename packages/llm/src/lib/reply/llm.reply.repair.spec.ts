import { type JsonRepairShape } from '@dereekb/util';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LLM_REPLY_ENVELOPE_KEYS } from './llm.reply.envelope';
import { DEFAULT_LLM_REPLY_FAST_FIX_LIMITS } from './llm.reply.fast.fix';
import { llmReplyRepairDiagnosis, llmReplyRepairFidelity, repairLlmReplyJson, scoreLlmReplyJson } from './llm.reply.repair';

// The lenient walk itself is specified in `@dereekb/util` (`string/json.repair.spec.ts`); these cases pin the reply
// wrappers and the reply-only parts (the envelope coverage scope and the diagnosis text).

describe('repairLlmReplyJson()', () => {
  it('repairs a near miss', () => {
    const result = repairLlmReplyJson('{"a":1,"b":[1,2,],}');
    expect(result.shape.verdict).toBe('near-miss');
    expect(result.repaired?.value).toEqual({ a: 1, b: [1, 2] });
  });

  it('refuses a reply that ends inside a string', () => {
    const result = repairLlmReplyJson('{"say":"the line was cut');
    expect(result.shape.verdict).toBe('truncated-looking');
    expect(result.repaired).toBeUndefined();
  });

  it('takes the coverage check over the envelope lever value', () => {
    // The rationale is dropped by a lever-only repair; it sits outside the lever value, so the coverage check never counts it.
    const text = '{"answerable":true,"rationale":"The basket holds the seventh item now.","lever":{"note":"I will put the seventh item in the bulk bin"}';
    const result = repairLlmReplyJson(text, { envelope: DEFAULT_LLM_REPLY_ENVELOPE_KEYS });
    expect(result.shape.verdict).toBe('near-miss');
    expect(llmReplyRepairFidelity({ original: text, repaired: result.repaired!.value.lever, envelope: DEFAULT_LLM_REPLY_ENVELOPE_KEYS })).toEqual({ ok: true, invented: [], coverage: 1, checked: 1 });
    expect(scoreLlmReplyJson(text, { envelope: DEFAULT_LLM_REPLY_ENVELOPE_KEYS })).toEqual(result.shape);
  });
});

describe('llmReplyRepairFidelity()', () => {
  const original = '{"answerable":true,"rationale":"The basket holds the seventh item now.","lever":{"orderId":643,"note":"I will put the seventh item in the bulk bin","items":[{"sku":"tote-01","qty":2},{"sku":"mug-07","qty":1}]}}';
  const items = [
    { sku: 'tote-01', qty: 2 },
    { sku: 'mug-07', qty: 1 }
  ];

  it('keeps a faithful repair of the envelope lever', () => {
    expect(llmReplyRepairFidelity({ original, repaired: { orderId: 643, note: 'I will put the seventh item in the bulk bin', items }, envelope: DEFAULT_LLM_REPLY_ENVELOPE_KEYS })).toEqual({ ok: true, invented: [], coverage: 1, checked: 1 });
  });

  it('scopes the coverage to a custom envelope lever key, ignoring a trailing rationale', () => {
    const text = '{"ok":true,"payload":{"note":"I will put the seventh item in the bulk bin"},"why":"The basket holds the seventh item now."}';
    const envelope = { lever: 'payload', answerable: 'ok', rationale: 'why' };
    expect(llmReplyRepairFidelity({ original: text, repaired: { note: 'I will put the seventh item in the bulk bin' }, envelope })).toEqual({ ok: true, invented: [], coverage: 1, checked: 1 });
  });

  it('checks the whole reply without an envelope', () => {
    expect(llmReplyRepairFidelity({ original, repaired: { orderId: 643, note: 'I will put the seventh item in the bulk bin', items } })).toEqual({ ok: false, invented: [], coverage: 0.5, checked: 2 });
  });
});

describe('llmReplyRepairDiagnosis()', () => {
  const shapeOf = (shape: Partial<JsonRepairShape>): JsonRepairShape => ({ verdict: 'mangled', score: 0.5, objectLed: true, objectStart: 0, faults: [], unclosed: '', length: 20, ...shape });

  it('names the reply length when there is no fault', () => {
    expect(llmReplyRepairDiagnosis(shapeOf({ length: 14 }))).toBe('The reply of 14 characters does not parse as JSON.');
  });

  it('names the decisive fault and the open containers', () => {
    expect(llmReplyRepairDiagnosis(shapeOf({ faults: [{ kind: 'unexpected', at: 9 }], unclosed: '{[' }))).toBe('Parsing fails at character 10 of 20: an unexpected character appears where JSON syntax was expected; 2 containers are still open there.');
  });

  it('uses the singular for one open container', () => {
    expect(llmReplyRepairDiagnosis(shapeOf({ faults: [{ kind: 'unexpected', at: 9 }], unclosed: '{' }))).toBe('Parsing fails at character 10 of 20: an unexpected character appears where JSON syntax was expected; 1 container is still open there.');
  });

  it('omits the open note when every container is closed', () => {
    expect(llmReplyRepairDiagnosis(shapeOf({ faults: [{ kind: 'trailing-prose', at: 4 }] }))).toBe('Parsing fails at character 5 of 20: non-JSON text follows the object.');
  });
});

describe('DEFAULT_LLM_REPLY_FAST_FIX_LIMITS', () => {
  it('pins the lane limits', () => {
    expect(DEFAULT_LLM_REPLY_FAST_FIX_LIMITS).toEqual({ minScore: 0.5, maxChars: 16_000, maxPerDispatch: 1 });
  });
});
