import { describe, expect, it } from 'vitest';
import { checkJsonRepairFidelity, JSON_REPAIR_EOF_FAULT_KINDS, repairJsonObjectOrUndefined, repairJsonObjectText, scoreJsonObjectText } from './json.repair';

/**
 * Repair a text and return the parsed repair, failing the row when there is none.
 *
 * @param text - The malformed text.
 * @returns The repair product.
 */
function repaired(text: string) {
  const result = repairJsonObjectText(text);
  expect(result.shape.verdict).toBe('near-miss');
  expect(result.repaired).toBeDefined();
  return result.repaired!;
}

describe('repairJsonObjectText: the deterministic ops', () => {
  it('R1: closes an object left open at EOF and scores it 1', () => {
    const text = '{"capability":"X","lever":{"say":"a line that is long enough"}';
    const repair = repaired(text);
    expect(repair.ops).toEqual({ 'close-object': 1 });
    expect(repair.value).toEqual({ capability: 'X', lever: { say: 'a line that is long enough' } });
    expect(scoreJsonObjectText(text).score).toBe(1);
    expect(scoreJsonObjectText(text).unclosed).toBe('{');
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
    expect(repairJsonObjectText('{"a":12345,"b":false,"c":null,"d":true}').repaired?.ops).toEqual({});
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
    expect(scoreJsonObjectText('{"say":"She said "hi", then left the room","n":1}').verdict).toBe('mangled');
  });
});

describe('repairJsonObjectText: refusals', () => {
  it('R11: a reply that ends inside a string is truncated-looking', () => {
    const result = repairJsonObjectText('{"say":"the line was cut');
    expect(result.shape.verdict).toBe('truncated-looking');
    expect(result.repaired).toBeUndefined();
  });

  it('R12: a reply that ends after a colon is truncated-looking', () => {
    expect(scoreJsonObjectText('{"a":1,"b":').verdict).toBe('truncated-looking');
  });

  it('R13: a reply that ends after a comma is truncated-looking', () => {
    expect(scoreJsonObjectText('{"a":1,').verdict).toBe('truncated-looking');
    expect(scoreJsonObjectText('{"a":[1,').verdict).toBe('truncated-looking');
  });

  it('R14: a prose-led reply is not-json, even when it holds a near-miss object', () => {
    const result = repairJsonObjectText('Sure! {"a":1');
    expect(result.shape.verdict).toBe('not-json');
    expect(result.shape.objectLed).toBe(false);
    expect(result.repaired).toBeUndefined();
  });

  it('R15: a reply with no { is not-json with score 0', () => {
    expect(scoreJsonObjectText('no json here')).toMatchObject({ verdict: 'not-json', score: 0, objectStart: -1 });
  });

  it('a Python literal / unquoted key is left to the fast fix (mangled, scored before the fault)', () => {
    const shape = scoreJsonObjectText('{"a":"a long enough value here","b":None}');
    expect(shape.verdict).toBe('mangled');
    expect(shape.score).toBeGreaterThan(0.5);
    expect(shape.faults[0]).toEqual({ kind: 'unexpected', at: 36 });
  });
});

/**
 * Valid, object-led texts — each must read as a zero-op near miss whose repaired text is the reply itself.
 */
const VALID_TEXTS: ReadonlyArray<string> = [
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

describe('repairJsonObjectText: identity over valid texts', () => {
  it('R16: every valid JSON text comes back byte-equivalent with zero ops', () => {
    expect(VALID_TEXTS.length).toBeGreaterThanOrEqual(20);

    VALID_TEXTS.forEach((text) => {
      expect(() => JSON.parse(text)).not.toThrow();

      const result = repairJsonObjectText(text);
      expect(result.shape.verdict).toBe('near-miss');
      expect(result.repaired?.ops).toEqual({});
      expect(result.repaired?.text).toBe(text);
    });
  });
});

describe('checkJsonRepairFidelity', () => {
  const original = '{"answerable":true,"rationale":"The basket holds the seventh item now.","lever":{"orderId":643,"note":"I will put the seventh item in the bulk bin","items":[{"sku":"tote-01","qty":2},{"sku":"mug-07","qty":1}]}}';
  const items = [
    { sku: 'tote-01', qty: 2 },
    { sku: 'mug-07', qty: 1 }
  ];

  it('R17: an invented string fails', () => {
    const verdict = checkJsonRepairFidelity({ original, repaired: { orderId: 643, note: 'I will put the seventh item somewhere else entirely', items } });
    expect(verdict.ok).toBe(false);
    expect(verdict.invented).toContain('I will put the seventh item somewhere else entirely');
  });

  it('R18: a changed number fails', () => {
    const verdict = checkJsonRepairFidelity({ original, repaired: { orderId: 634, note: 'I will put the seventh item in the bulk bin', items } });
    expect(verdict.ok).toBe(false);
    expect(verdict.invented).toContain('634');
  });

  it('R19: a dropped content literal drops coverage below 0.9', () => {
    const verdict = checkJsonRepairFidelity({ original, repaired: { orderId: 643, items } });
    expect(verdict.ok).toBe(false);
    expect(verdict.coverage).toBeLessThan(0.9);
  });

  it('keeps a faithful repair when the coverage check starts at the coverage key', () => {
    expect(checkJsonRepairFidelity({ original, repaired: { orderId: 643, note: 'I will put the seventh item in the bulk bin', items }, coverageFromKey: 'lever' })).toEqual({ ok: true, invented: [], coverage: 1, checked: 1 });
  });

  it('checks the whole original when no coverage key is set', () => {
    expect(checkJsonRepairFidelity({ original, repaired: { orderId: 643, note: 'I will put the seventh item in the bulk bin', items } })).toEqual({ ok: false, invented: [], coverage: 0.5, checked: 2 });
  });

  it('checks the whole original when the coverage key is not found', () => {
    expect(checkJsonRepairFidelity({ original, repaired: { orderId: 643, note: 'I will put the seventh item in the bulk bin', items }, coverageFromKey: 'payload' }).checked).toBe(2);
  });

  it('escapes regex characters in the coverage key', () => {
    const text = '{"intro":"an introduction that is long","a.b(c)":{"note":"the content that matters here"}}';
    const repairedValue = { 'a.b(c)': { note: 'the content that matters here' } };
    expect(checkJsonRepairFidelity({ original: text, repaired: repairedValue, coverageFromKey: 'a.b(c)' })).toEqual({ ok: true, invented: [], coverage: 1, checked: 1 });
    expect(checkJsonRepairFidelity({ original: text, repaired: repairedValue, coverageFromKey: 'a.b.c.' }).checked).toBe(2);
  });

  it('R20: every deterministic repair of the op rows is faithful', () => {
    ['{"a":{"b":"a value that is long"}', '{"a":1,"b":[1,2,],}', '{"a":1 "b":2}', '{"a":[1,2}', '{"a":1]}', '{"say":"first line\nsecond"}', '{"note":"the label read,"handle with care," twice"}'].forEach((text) => {
      const repair = repaired(text);
      expect(checkJsonRepairFidelity({ original: text, repaired: repair.value }).ok).toBe(true);
    });
  });
});

describe('repairJsonObjectText(): string issues', () => {
  it('records a raw control character and an inner quote in text order (pass 2)', () => {
    const text = '{"note":"line one\nsays "hi there" twice","n":1}';
    const result = repairJsonObjectText(text);
    expect(result.repaired?.pass).toBe(2);
    expect(result.shape.faults).toEqual([
      { kind: 'control-in-string', at: 17 },
      { kind: 'inner-quote', at: 23 },
      { kind: 'inner-quote', at: 32 }
    ]);
    expect(result.repaired?.ops).toEqual({ 'escape-control': 1, 'escape-inner-quote': 2 });
    expect(result.repaired?.value).toEqual({ note: 'line one\nsays "hi there" twice', n: 1 });
  });

  it('records a control character before the end of an unclosed string', () => {
    const shape = scoreJsonObjectText('{"say":"cut\nhere');
    expect(shape.verdict).toBe('truncated-looking');
    expect(shape.faults).toEqual([
      { kind: 'control-in-string', at: 11 },
      { kind: 'ends-in-string', at: 16 }
    ]);
  });

  it('reads a backslash at the end of the text as truncated', () => {
    expect(scoreJsonObjectText('{"say":"cut\\').verdict).toBe('truncated-looking');
  });

  it('reads a fault followed by an unclosed string as truncated', () => {
    expect(scoreJsonObjectText('{"a":None,"b":"cut').verdict).toBe('truncated-looking');
    expect(scoreJsonObjectText('{"a":None,"b":"closed"}').verdict).toBe('mangled');
  });
});

describe('repairJsonObjectText(): coverageFromKey', () => {
  it('passes the coverage key to the fidelity gate', () => {
    // The fence line's quoted remark is dropped by the repair: faithful only when the region starts at the key.
    const text = '```json "a dropped remark that is long"\n{"lever":{"say":"a line that is long enough"}}';
    expect(repairJsonObjectText(text, { coverageFromKey: 'lever' }).shape.verdict).toBe('near-miss');
    expect(repairJsonObjectText(text).shape.verdict).toBe('mangled');
    expect(scoreJsonObjectText(text, { coverageFromKey: 'lever' }).verdict).toBe('near-miss');
  });
});

describe('repairJsonObjectOrUndefined()', () => {
  it('returns valid object JSON as parsed', () => {
    expect(repairJsonObjectOrUndefined('{"a":1}')).toEqual({ a: 1 });
  });

  it('repairs a near miss', () => {
    expect(repairJsonObjectOrUndefined('{"a":1,"b":[1,2,],}')).toEqual({ a: 1, b: [1, 2] });
  });

  it('returns undefined for a truncated or missing text', () => {
    expect(repairJsonObjectOrUndefined('{"a":"cut')).toBeUndefined();
    expect(repairJsonObjectOrUndefined('[1,2]')).toBeUndefined();
    expect(repairJsonObjectOrUndefined('')).toBeUndefined();
    expect(repairJsonObjectOrUndefined(undefined)).toBeUndefined();
  });

  it('fits a plain (text) => value decoder slot', () => {
    const decode: (text: string) => unknown = repairJsonObjectOrUndefined;
    expect(decode('{"a":1')).toEqual({ a: 1 });
  });
});

describe('JSON_REPAIR_EOF_FAULT_KINDS', () => {
  it('lists the end-of-input faults', () => {
    expect([...JSON_REPAIR_EOF_FAULT_KINDS]).toEqual(['unclosed', 'ends-in-string', 'dangling']);
  });
});
