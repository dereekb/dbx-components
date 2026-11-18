import { describe, expect, it } from 'vitest';
import { DEFAULT_LLM_REPLY_FAST_FIX_LIMITS } from './llm.reply.fast.fix';
import { type LlmReplyJsonShape } from './llm.reply.json.shape';
import { llmReplyRepairDiagnosis, llmReplyRepairFidelity, repairLlmReplyJson, scoreLlmReplyJson } from './llm.reply.repair';

/**
 * Repair a text and return the parsed repair, failing the row when there is none.
 *
 * @param text - The malformed reply.
 * @returns The repair product.
 */
function repaired(text: string) {
  const result = repairLlmReplyJson(text);
  expect(result.shape.verdict).toBe('near-miss');
  expect(result.repaired).toBeDefined();
  return result.repaired!;
}

describe('repairLlmReplyJson: the deterministic ops', () => {
  it('R1: closes an object left open at EOF and scores it 1', () => {
    const text = '{"capability":"X","lever":{"say":"a line that is long enough"}';
    const repair = repaired(text);
    expect(repair.ops).toEqual({ 'close-object': 1 });
    expect(repair.value).toEqual({ capability: 'X', lever: { say: 'a line that is long enough' } });
    expect(scoreLlmReplyJson(text).score).toBe(1);
    expect(scoreLlmReplyJson(text).unclosed).toBe('{');
  });

  it('R2: closes an array and then its object', () => {
    const repair = repaired('{"acts":[{"verb":"sort"},{"verb":"take"}');
    expect(repair.ops).toEqual({ 'close-array': 1, 'close-object': 1 });
    expect(repair.value).toEqual({ acts: [{ verb: 'sort' }, { verb: 'take' }] });
  });

  it('R3: drops a trailing comma before } and before ]', () => {
    expect(repaired('{"a":1,"b":[1,2,],}').value).toEqual({ a: 1, b: [1, 2] });
    expect(repaired('{"a":1,"b":[1,2,],}').ops).toEqual({ 'drop-trailing-comma': 2 });
  });

  it('R4: inserts a missing comma between members and array items: never inside a number or a literal', () => {
    expect(repaired('{"a":1 "b":2}').value).toEqual({ a: 1, b: 2 });
    expect(repaired('{"a":[1 2 true "x"]}').value).toEqual({ a: [1, 2, true, 'x'] });
    expect(repaired('{"a":"x"\n"b":{"c":null}}').ops).toEqual({ 'insert-missing-comma': 1 });
    // A multi-digit number and the literals are single tokens.
    expect(repairLlmReplyJson('{"a":12345,"b":false,"c":null,"d":true}').repaired?.ops).toEqual({});
  });

  it('R5: inserts a missing inner closer before its outer closer', () => {
    const repair = repaired('{"a":[1,2}');
    expect(repair.ops).toEqual({ 'insert-missing-closer': 1 });
    expect(repair.value).toEqual({ a: [1, 2] });
  });

  it('R6: drops a stray closer', () => {
    expect(repaired('{"a":1]}').value).toEqual({ a: 1 });
    expect(repaired('{"a":{"b":1}}}}').ops).toEqual({ 'drop-stray-closer': 2 });
  });

  it('R7: escapes a raw newline / tab inside a string', () => {
    const repair = repaired('{"say":"first line\nsecond\tline here"}');
    expect(repair.ops).toEqual({ 'escape-control': 2 });
    expect(repair.value).toEqual({ say: 'first line\nsecond\tline here' });
  });

  it('R8: strips a closing fence after an unclosed object, and a leading fence', () => {
    const repair = repaired('```json\n{"a":{"b":"a value that is long"}\n```');
    expect(repair.ops).toEqual({ 'strip-code-fence': 2, 'close-object': 1 });
    expect(repair.value).toEqual({ a: { b: 'a value that is long' } });
  });

  it('R9: pass 2 escapes an inner quote', () => {
    const text = '{"note":"the label read,"handle with care," twice","count":6}';
    const repair = repaired(text);
    expect(repair.pass).toBe(2);
    expect(repair.ops).toEqual({ 'escape-inner-quote': 2 });
    expect(repair.value).toEqual({ note: 'the label read,"handle with care," twice', count: 6 });
  });

  it('R10: an inner quote followed by a comma is the heuristic’s known limit: mangled', () => {
    expect(scoreLlmReplyJson('{"say":"She said "hi", then left the room","n":1}').verdict).toBe('mangled');
  });
});

describe('repairLlmReplyJson: refusals', () => {
  it('R11: a reply that ends inside a string is truncated-looking', () => {
    const result = repairLlmReplyJson('{"say":"the line was cut');
    expect(result.shape.verdict).toBe('truncated-looking');
    expect(result.repaired).toBeUndefined();
  });

  it('R12: a reply that ends after a colon is truncated-looking', () => {
    expect(scoreLlmReplyJson('{"a":1,"b":').verdict).toBe('truncated-looking');
  });

  it('R13: a reply that ends after a comma is truncated-looking', () => {
    expect(scoreLlmReplyJson('{"a":1,').verdict).toBe('truncated-looking');
    expect(scoreLlmReplyJson('{"a":[1,').verdict).toBe('truncated-looking');
  });

  it('R14: a prose-led reply is not-json, even when it holds a near-miss object', () => {
    const result = repairLlmReplyJson('Sure! {"a":1');
    expect(result.shape.verdict).toBe('not-json');
    expect(result.shape.objectLed).toBe(false);
    expect(result.repaired).toBeUndefined();
  });

  it('R15: a reply with no { is not-json with score 0', () => {
    expect(scoreLlmReplyJson('no json here')).toMatchObject({ verdict: 'not-json', score: 0, objectStart: -1 });
  });

  it('a Python literal / unquoted key is left to the fast fix (mangled, scored before the fault)', () => {
    const shape = scoreLlmReplyJson('{"a":"a long enough value here","b":None}');
    expect(shape.verdict).toBe('mangled');
    expect(shape.score).toBeGreaterThan(0.5);
    expect(llmReplyRepairDiagnosis(shape)).toMatch(/^Parsing fails at character \d+ of \d+: an unexpected character/);
  });
});

/**
 * Valid, object-led replies — each must read as a zero-op near miss whose repaired text is the reply itself.
 */
const VALID_REPLIES: ReadonlyArray<string> = [
  '{}',
  '{"a":1}',
  '{"title":"A sturdy canvas tote","price":24}',
  '{"product":{"title":"Canvas tote","price":{"amount":24,"currency":"USD"}}}',
  '{"products":[{"name":"alpha","parts":[]},{"name":"beta","parts":[{"aspect":"material","fragment":"waxed canvas"}]}]}',
  '{"items":[]}',
  '{"meta":{}}',
  String.raw`{"note":"she said \"hi\" twice"}`,
  String.raw`{"path":"C:\\bags\\tote-01"}`,
  String.raw`{"lines":"first line\nsecond line"}`,
  String.raw`{"name":"caf\u00e9 tote"}`,
  '{"name":"café tote"}',
  '{"ratio":1.5e3,"delta":-0.25,"tiny":2E-4}',
  '{"stock":-3,"reserved":0}',
  '{"inStock":true,"onSale":false,"discontinued":null}',
  '{"tags":["new","sale"],"sizes":[1,2,3]}',
  '{\n  "title": "Canvas tote",\n  "price": 24\n}',
  '{\n  "products": [\n    { "sku": "tote-01", "qty": 2 },\n    { "sku": "mug-07", "qty": 1 }\n  ]\n}',
  '{"answerable":true,"rationale":"The order holds two products.","lever":{"products":[{"sku":"tote-01","qty":2}]}}',
  '{"answerable":false,"rationale":"No product matches the request."}',
  '{"matrix":[[1,2],[3,4]],"empty":[[],{}]}',
  '{"a":{"b":{"c":{"d":"deeply nested value"}}}}'
];

describe('repairLlmReplyJson: identity over valid replies', () => {
  it('R16: every valid JSON reply comes back byte-equivalent with zero ops', () => {
    expect(VALID_REPLIES.length).toBeGreaterThanOrEqual(20);

    VALID_REPLIES.forEach((text) => {
      expect(() => JSON.parse(text)).not.toThrow();

      const result = repairLlmReplyJson(text);
      expect(result.shape.verdict).toBe('near-miss');
      expect(result.repaired?.ops).toEqual({});
      expect(result.repaired?.text).toBe(text);
    });
  });
});

describe('llmReplyRepairFidelity', () => {
  const original = '{"answerable":true,"rationale":"The basket holds the seventh item now.","lever":{"orderId":643,"note":"I will put the seventh item in the bulk bin","items":[{"sku":"tote-01","qty":2},{"sku":"mug-07","qty":1}]}}';
  const items = [
    { sku: 'tote-01', qty: 2 },
    { sku: 'mug-07', qty: 1 }
  ];

  it('R17: an invented string fails', () => {
    const verdict = llmReplyRepairFidelity({ original, repaired: { orderId: 643, note: 'I will put the seventh item somewhere else entirely', items } });
    expect(verdict.ok).toBe(false);
    expect(verdict.invented).toContain('I will put the seventh item somewhere else entirely');
  });

  it('R18: a changed number fails', () => {
    const verdict = llmReplyRepairFidelity({ original, repaired: { orderId: 634, note: 'I will put the seventh item in the bulk bin', items } });
    expect(verdict.ok).toBe(false);
    expect(verdict.invented).toContain('634');
  });

  it('R19: a dropped content literal drops coverage below 0.9', () => {
    const verdict = llmReplyRepairFidelity({ original, repaired: { orderId: 643, items } });
    expect(verdict.ok).toBe(false);
    expect(verdict.coverage).toBeLessThan(0.9);
  });

  it('keeps a faithful repair', () => {
    expect(llmReplyRepairFidelity({ original, repaired: { orderId: 643, note: 'I will put the seventh item in the bulk bin', items } })).toEqual({ ok: true, invented: [], coverage: 1, checked: 1 });
  });

  it('R20: every deterministic repair of the op rows is faithful', () => {
    ['{"a":{"b":"a value that is long"}', '{"a":1,"b":[1,2,],}', '{"a":1 "b":2}', '{"a":[1,2}', '{"a":1]}', '{"say":"first line\nsecond"}', '{"note":"the label read,"handle with care," twice"}'].forEach((text) => {
      const repair = repaired(text);
      expect(llmReplyRepairFidelity({ original: text, repaired: repair.value }).ok).toBe(true);
    });
  });
});

describe('llmReplyRepairDiagnosis()', () => {
  const shapeOf = (shape: Partial<LlmReplyJsonShape>): LlmReplyJsonShape => ({ verdict: 'mangled', score: 0.5, objectLed: true, objectStart: 0, faults: [], unclosed: '', length: 20, ...shape });

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
