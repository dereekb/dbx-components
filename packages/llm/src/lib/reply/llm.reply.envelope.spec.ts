import { describe, expect, it } from 'vitest';
import { classifyLlmDecodeFailure } from '../record/llm.decode.failure';
import { DEFAULT_LLM_REPLY_ENVELOPE_KEYS, readLlmLineReplyValue, llmReplyEnvelopeContractIntro, readLlmReplyValue, readLlmReplyRationale, type LlmReplyEnvelopeKeys, readLlmDispatchResultReply, readLlmReply, resolveLlmReplyReadingEnvelope } from './llm.reply.envelope';

const ENVELOPE = { envelope: DEFAULT_LLM_REPLY_ENVELOPE_KEYS };

describe('readLlmReply(): the json reading (no envelope)', () => {
  it('reads a bare object as the whole value', () => {
    const reading = readLlmReply('{"items": [], "products": []}');
    expect(reading.kind).toBe('value');
    expect(reading.kind === 'value' && reading.value).toEqual({ items: [], products: [] });
  });

  it('never unwraps an envelope-shaped reply and never declines', () => {
    const reading = readLlmReply('{"answerable":true,"lever":{"ok":true}}');
    expect(reading.kind === 'value' && reading.value).toEqual({ answerable: true, lever: { ok: true } });

    const declining = readLlmReply('{"answerable":false}');
    expect(declining.kind === 'value' && declining.value).toEqual({ answerable: false });
  });

  it('reads no {…} block at all as no-json', () => {
    expect(readLlmReply('here is only prose, no json').kind).toBe('no-json');
    expect(readLlmReply('').kind).toBe('no-json');
  });

  it('reads a {…} block that does not parse as parse-error', () => {
    expect(readLlmReply('{"a": nope, not json}').kind).toBe('parse-error');
    expect(readLlmReply('{"a": 1,}').kind).toBe('parse-error');
  });

  it('reads a reply truncated before its closing brace as no-json', () => {
    const truncated = `{"items":[], "products": ["${'\t'.repeat(2000)}`;
    expect(readLlmReply(truncated).kind).toBe('no-json');
  });

  it('reads a mid-object truncation that carries a nested closing brace as parse-error (no brace repair)', () => {
    expect(readLlmReply('{"a":{"b":1}').kind).toBe('parse-error');
    expect(readLlmReply('{"products":[{"name":"alpha","parts":[]},{"name":"be').kind).toBe('parse-error');
  });
});

describe('readLlmReply(): the envelope reading', () => {
  it('unwraps the value key', () => {
    const reading = readLlmReply('{"answerable":true,"lever":{"ok":true}}', ENVELOPE);
    expect(reading.kind === 'value' && reading.value).toEqual({ ok: true });
  });

  it('tolerates surrounding prose / a code fence', () => {
    expect(readLlmReply('Sure!\n```json\n{"ok": true}\n```', ENVELOPE).kind).toBe('value');
  });

  it('reads an answerable:false envelope as declined', () => {
    expect(readLlmReply('{"answerable": false}', ENVELOPE).kind).toBe('declined');
  });

  it('keeps the value of a hedged decline', () => {
    const reading = readLlmReply('{"answerable":false,"rationale":"no matching product","lever":{"kind":"question","tokens":[]}}', ENVELOPE);
    expect(reading.kind).toBe('declined');
    expect(reading.kind === 'declined' && reading.value).toEqual({ kind: 'question', tokens: [] });
  });

  it('carries no value on a bare decline, nor on a decline whose value is not an object', () => {
    const reading = readLlmReply('{"answerable": false}', ENVELOPE);
    expect(reading.kind === 'declined' && reading.value).toBeUndefined();

    const nonObject = readLlmReply('{"answerable": false, "lever": "none"}', ENVELOPE);
    expect(nonObject.kind === 'declined' && nonObject.value).toBeUndefined();
  });

  it('reads a bare value carrying a value-level flag as the whole object', () => {
    const reading = readLlmReply('{"answerable":true,"items":[]}', ENVELOPE);
    expect(reading.kind === 'value' && reading.value).toEqual({ answerable: true, items: [] });
  });
});

describe('readLlmReply(): custom envelope keys', () => {
  const keys: LlmReplyEnvelopeKeys = { value: 'payload', answerable: 'ok', rationale: 'why' };

  it('unwraps, declines and explains by the configured keys', () => {
    const reading = readLlmReply('{"ok":true,"payload":{"title":"tote"}}', { envelope: keys });
    expect(reading.kind === 'value' && reading.value).toEqual({ title: 'tote' });
    expect(readLlmReply('{"ok":false}', { envelope: keys }).kind).toBe('declined');
    expect(readLlmReplyRationale('{"ok":false,"why":"  out of stock  "}', { envelope: keys })).toBe('out of stock');
  });

  it('does not unwrap a value key under other keys', () => {
    const reading = readLlmReply('{"lever":{"title":"tote"}}', { envelope: keys });
    expect(reading.kind === 'value' && reading.value).toEqual({ lever: { title: 'tote' } });
  });
});

describe('readLlmReply(): the trailing-brace over-emit (the layered balanced fallback)', () => {
  /**
   * A complete, correct envelope followed by one stray `}` — the greedy slice swallows the stray brace and fails to
   * parse; the balanced scan rescues the object.
   */
  const TRAILING_BRACE_REPLY =
    '{"answerable":true,"rationale":"Two new products are declared with their materials; nothing else remains.","lever":{"products":[{"mode":"create","name":"alpha","parts":[{"aspect":"material","fragment":"waxed canvas"},{"aspect":"price","fragment":"24 dollars"}]},{"mode":"create","name":"beta","parts":[{"aspect":"material","fragment":"recycled nylon"}]}],"leftovers":[]}}}';

  it('reads the over-emit as a value with both products intact', () => {
    const reading = readLlmReply(TRAILING_BRACE_REPLY, ENVELOPE);

    expect(reading.kind).toBe('value');
    const products = (reading.kind === 'value' ? reading.value['products'] : []) as ReadonlyArray<{ name: string }>;
    expect(products.map((product) => product.name)).toEqual(['alpha', 'beta']);
  });

  it('does not count a rescued reply as a swallowed decode failure', () => {
    const sites: string[] = [];
    readLlmReply(TRAILING_BRACE_REPLY, { ...ENVELOPE, swallow: (site) => sites.push(site) });
    expect(sites).toEqual([]);
  });

  it('counts a genuinely unreadable block exactly once, under both readings', () => {
    const failed: string[] = [];
    expect(readLlmReply('{"a": nope, not json}', { swallow: (site) => failed.push(site) }).kind).toBe('parse-error');
    expect(failed).toEqual(['llm/reply-envelope.decode']);

    const failedEnvelope: string[] = [];
    expect(readLlmReply('{"a": nope, not json}', { ...ENVELOPE, swallow: (site) => failedEnvelope.push(site) }).kind).toBe('parse-error');
    expect(failedEnvelope).toEqual(['llm/reply-envelope.decode']);
  });

  it('reads a complete object followed by trailing prose (greedy fails, balanced wins)', () => {
    expect(readLlmReply('{"ok":true} ... hope that helps! }').kind).toBe('value');
  });

  it('ignores braces inside string literals when balancing', () => {
    const reading = readLlmReply(String.raw`{"note":"a \" quote and a } brace"}}`);
    expect(reading.kind === 'value' && reading.value).toEqual({ note: 'a " quote and a } brace' });
  });

  it('resolves two top-level objects to the first', () => {
    const reading = readLlmReply('{"first":1}\n{"second":2}');
    expect(reading.kind === 'value' && reading.value).toEqual({ first: 1 });
  });

  it('keeps every greedy-readable shape on its greedy reading', () => {
    expect(readLlmReply('{"answerable":true,"lever":{"ok":true}}', ENVELOPE).kind).toBe('value');
    expect(readLlmReply('{"items":[]}', ENVELOPE).kind).toBe('value');
    expect(readLlmReply('Sure!\n```json\n{"ok": true}\n```', ENVELOPE).kind).toBe('value');
    expect(readLlmReply('{"answerable": false}', ENVELOPE).kind).toBe('declined');
    expect(readLlmReply('{"answerable":false,"lever":{"kind":"question"}}', ENVELOPE).kind).toBe('declined');
    expect(readLlmReply('here is only prose, no json', ENVELOPE).kind).toBe('no-json');
    expect(readLlmReply(`{"products": ["${'\t'.repeat(200)}`, ENVELOPE).kind).toBe('no-json');
    expect(readLlmReply('{"a": 1,}', ENVELOPE).kind).toBe('parse-error');
    // A nested object whose greedy superset parses still resolves to the superset, never the inner object.
    const nested = readLlmReply('{"outer":{"inner":1}}', ENVELOPE);
    expect(nested.kind === 'value' && nested.value).toEqual({ outer: { inner: 1 } });
  });

  it('reads the rationale off the over-emit too (every reader shares the slicer)', () => {
    expect(readLlmReplyRationale(TRAILING_BRACE_REPLY)).toBe('Two new products are declared with their materials; nothing else remains.');
  });
});

describe('resolveLlmReplyReadingEnvelope()', () => {
  const keys: LlmReplyEnvelopeKeys = { value: 'payload', answerable: 'ok', rationale: 'why' };

  it('reads json-envelope through the host keys, defaulting to the library keys', () => {
    expect(resolveLlmReplyReadingEnvelope('json-envelope', keys)).toBe(keys);
    expect(resolveLlmReplyReadingEnvelope('json-envelope', undefined)).toBe(DEFAULT_LLM_REPLY_ENVELOPE_KEYS);
  });

  it('reads every other protocol with no envelope', () => {
    expect(resolveLlmReplyReadingEnvelope('json', keys)).toBeUndefined();
    expect(resolveLlmReplyReadingEnvelope('line', keys)).toBeUndefined();
  });
});

describe('readLlmDispatchResultReply()', () => {
  it('reads a value stamp as that object, whatever the text', () => {
    expect(readLlmDispatchResultReply({ text: '{"ok":true,"payload":{"a":1}}', valueJson: '{"a":1}', decodeStatus: 'retried' })).toEqual({ kind: 'value', value: { a: 1 } });
  });

  it('reads an accepted result with no value as declined', () => {
    expect(readLlmDispatchResultReply({ text: '{"answerable":false}', decodeStatus: 'clean' })).toEqual({ kind: 'declined' });
  });

  it('reads a dropped result as no-json', () => {
    expect(readLlmDispatchResultReply({ text: '{"a":1}', decodeStatus: 'dropped' })).toEqual({ kind: 'no-json' });
  });

  it('reads an unstamped result as the json reading of its text', () => {
    expect(readLlmDispatchResultReply({ text: 'Sure: {"a":1}' })).toEqual({ kind: 'value', value: { a: 1 } });
    expect(readLlmDispatchResultReply({ text: '{"lever":{"a":1}}' })).toEqual({ kind: 'value', value: { lever: { a: 1 } } });
    expect(readLlmDispatchResultReply({ text: 'prose' })).toEqual({ kind: 'no-json' });
  });

  it('reads a value stamp that does not parse into an object as parse-error', () => {
    expect(readLlmDispatchResultReply({ text: '', valueJson: '[1]', decodeStatus: 'clean' })).toEqual({ kind: 'parse-error' });
  });
});

describe('readLlmReplyValue()', () => {
  it('returns the value for a value reading', () => {
    expect(readLlmReplyValue('{"ok": true}')).toEqual({ ok: true });
  });

  it('returns undefined for every non-value reading', () => {
    expect(readLlmReplyValue('prose only')).toBeUndefined();
    expect(readLlmReplyValue('{"a": nope}')).toBeUndefined();
    expect(readLlmReplyValue('{"answerable": false}', ENVELOPE)).toBeUndefined();
  });

  it('returns undefined for a hedged decline', () => {
    expect(readLlmReplyValue('{"answerable":false,"lever":{"kind":"question","tokens":[]}}', ENVELOPE)).toBeUndefined();
  });
});

describe('readLlmReplyRationale()', () => {
  it('reads the rationale of a declining reply', () => {
    expect(readLlmReplyRationale('{"answerable":false,"rationale":"No product in the catalog matches \'tote\'","lever":{}}')).toBe("No product in the catalog matches 'tote'");
  });

  it('trims it, and tolerates surrounding prose / a code fence', () => {
    expect(readLlmReplyRationale('Sure!\n```json\n{"answerable":true,"rationale":"  a reason  ","lever":{}}\n```')).toBe('a reason');
  });

  it('returns undefined for a bare value, bare prose, and a blank / non-string rationale', () => {
    expect(readLlmReplyRationale('{"kind":"statement","tokens":[]}')).toBeUndefined();
    expect(readLlmReplyRationale('no json here')).toBeUndefined();
    expect(readLlmReplyRationale('{"rationale":"   "}')).toBeUndefined();
    expect(readLlmReplyRationale('{"rationale":42}')).toBeUndefined();
  });
});

describe('readLlmLineReplyValue()', () => {
  it('lifts a bare line into { line }', () => {
    expect(readLlmLineReplyValue('  A sturdy canvas tote.  ')).toEqual({ line: 'A sturdy canvas tote.' });
  });

  it('strips one wrapping fence', () => {
    expect(readLlmLineReplyValue('```text\nA sturdy canvas tote.\n```')).toEqual({ line: 'A sturdy canvas tote.' });
  });

  it('honors a custom field', () => {
    expect(readLlmLineReplyValue('A sturdy canvas tote.', { field: 'title' })).toEqual({ title: 'A sturdy canvas tote.' });
  });

  it('returns undefined for blank input', () => {
    expect(readLlmLineReplyValue('   ')).toBeUndefined();
  });

  it('keeps a JSON reply only when it carries the string field', () => {
    expect(readLlmLineReplyValue('{"line":"hi"}')).toEqual({ line: 'hi' });
    expect(readLlmLineReplyValue('{"other":1}')).toBeUndefined();
  });

  it('unwraps and declines only with an envelope', () => {
    expect(readLlmLineReplyValue('{"answerable":false}', ENVELOPE)).toBeUndefined();
    expect(readLlmLineReplyValue('{"lever":{"line":"x"}}', ENVELOPE)).toEqual({ line: 'x' });
    expect(readLlmLineReplyValue('{"lever":{"line":"x"}}')).toBeUndefined();
  });
});

describe('llmReplyEnvelopeContractIntro()', () => {
  it('names the default value key', () => {
    expect(llmReplyEnvelopeContractIntro()).toBe('Return the `lever` as a JSON object with these fields:');
  });

  it('names a custom value key', () => {
    expect(llmReplyEnvelopeContractIntro({ value: 'payload', answerable: 'ok', rationale: 'why' })).toBe('Return the `payload` as a JSON object with these fields:');
  });
});

describe('the decode-failure tie', () => {
  it('feeds the degenerate kinds to classifyLlmDecodeFailure', () => {
    const empty = readLlmReply('');
    const broken = readLlmReply('{"a": nope}');

    expect(empty.kind).toBe('no-json');
    expect(broken.kind).toBe('parse-error');

    if ((empty.kind === 'no-json' || empty.kind === 'parse-error') && (broken.kind === 'no-json' || broken.kind === 'parse-error')) {
      expect(classifyLlmDecodeFailure(empty.kind, { text: '', finishReason: 'stop' })).toBe('empty-result');
      expect(classifyLlmDecodeFailure(broken.kind, { text: '{"a": nope}', finishReason: 'stop' })).toBe('parse-error');
    }
  });
});
