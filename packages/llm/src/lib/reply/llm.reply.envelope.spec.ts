import { describe, expect, it } from 'vitest';
import { classifyLlmDecodeFailure } from '../record/llm.decode.failure';
import { DEFAULT_LLM_REPLY_ENVELOPE_KEYS, isLlmReplyObject, llmLineReplyLeverOf, llmReplyEnvelopeContractIntro, llmReplyLeverOf, llmReplyRationaleOf, type LlmReplyEnvelopeKeys, readLlmDispatchResultLever, readLlmReplyLever, resolveLlmReplyReadingEnvelope } from './llm.reply.envelope';

const ENVELOPE = { envelope: DEFAULT_LLM_REPLY_ENVELOPE_KEYS };

describe('readLlmReplyLever(): the json reading (no envelope)', () => {
  it('reads a bare object as the whole lever', () => {
    const reading = readLlmReplyLever('{"items": [], "products": []}');
    expect(reading.kind).toBe('lever');
    expect(reading.kind === 'lever' && reading.lever).toEqual({ items: [], products: [] });
  });

  it('never unwraps an envelope-shaped reply and never declines', () => {
    const reading = readLlmReplyLever('{"answerable":true,"lever":{"ok":true}}');
    expect(reading.kind === 'lever' && reading.lever).toEqual({ answerable: true, lever: { ok: true } });

    const declining = readLlmReplyLever('{"answerable":false}');
    expect(declining.kind === 'lever' && declining.lever).toEqual({ answerable: false });
  });

  it('reads no {…} block at all as no-json', () => {
    expect(readLlmReplyLever('here is only prose, no json').kind).toBe('no-json');
    expect(readLlmReplyLever('').kind).toBe('no-json');
  });

  it('reads a {…} block that does not parse as parse-error', () => {
    expect(readLlmReplyLever('{"a": nope, not json}').kind).toBe('parse-error');
    expect(readLlmReplyLever('{"a": 1,}').kind).toBe('parse-error');
  });

  it('reads a reply truncated before its closing brace as no-json', () => {
    const truncated = `{"items":[], "products": ["${'\t'.repeat(2000)}`;
    expect(readLlmReplyLever(truncated).kind).toBe('no-json');
  });

  it('reads a mid-object truncation that carries a nested closing brace as parse-error (no brace repair)', () => {
    expect(readLlmReplyLever('{"a":{"b":1}').kind).toBe('parse-error');
    expect(readLlmReplyLever('{"products":[{"name":"alpha","parts":[]},{"name":"be').kind).toBe('parse-error');
  });
});

describe('readLlmReplyLever(): the envelope reading', () => {
  it('unwraps the lever key', () => {
    const reading = readLlmReplyLever('{"answerable":true,"lever":{"ok":true}}', ENVELOPE);
    expect(reading.kind === 'lever' && reading.lever).toEqual({ ok: true });
  });

  it('tolerates surrounding prose / a code fence', () => {
    expect(readLlmReplyLever('Sure!\n```json\n{"ok": true}\n```', ENVELOPE).kind).toBe('lever');
  });

  it('reads an answerable:false envelope as declined', () => {
    expect(readLlmReplyLever('{"answerable": false}', ENVELOPE).kind).toBe('declined');
  });

  it('keeps the lever of a hedged decline', () => {
    const reading = readLlmReplyLever('{"answerable":false,"rationale":"no matching product","lever":{"kind":"question","tokens":[]}}', ENVELOPE);
    expect(reading.kind).toBe('declined');
    expect(reading.kind === 'declined' && reading.lever).toEqual({ kind: 'question', tokens: [] });
  });

  it('carries no lever on a bare decline, nor on a decline whose lever is not an object', () => {
    const reading = readLlmReplyLever('{"answerable": false}', ENVELOPE);
    expect(reading.kind === 'declined' && reading.lever).toBeUndefined();

    const nonObject = readLlmReplyLever('{"answerable": false, "lever": "none"}', ENVELOPE);
    expect(nonObject.kind === 'declined' && nonObject.lever).toBeUndefined();
  });

  it('reads a bare lever carrying a lever-level flag as the whole object', () => {
    const reading = readLlmReplyLever('{"answerable":true,"items":[]}', ENVELOPE);
    expect(reading.kind === 'lever' && reading.lever).toEqual({ answerable: true, items: [] });
  });
});

describe('readLlmReplyLever(): custom envelope keys', () => {
  const keys: LlmReplyEnvelopeKeys = { lever: 'payload', answerable: 'ok', rationale: 'why' };

  it('unwraps, declines and explains by the configured keys', () => {
    const reading = readLlmReplyLever('{"ok":true,"payload":{"title":"tote"}}', { envelope: keys });
    expect(reading.kind === 'lever' && reading.lever).toEqual({ title: 'tote' });
    expect(readLlmReplyLever('{"ok":false}', { envelope: keys }).kind).toBe('declined');
    expect(llmReplyRationaleOf('{"ok":false,"why":"  out of stock  "}', { envelope: keys })).toBe('out of stock');
  });

  it('does not unwrap a lever key under other keys', () => {
    const reading = readLlmReplyLever('{"lever":{"title":"tote"}}', { envelope: keys });
    expect(reading.kind === 'lever' && reading.lever).toEqual({ lever: { title: 'tote' } });
  });
});

describe('readLlmReplyLever(): the trailing-brace over-emit (the layered balanced fallback)', () => {
  /**
   * A complete, correct envelope followed by one stray `}` — the greedy slice swallows the stray brace and fails to
   * parse; the balanced scan rescues the object.
   */
  const TRAILING_BRACE_REPLY =
    '{"answerable":true,"rationale":"Two new products are declared with their materials; nothing else remains.","lever":{"products":[{"mode":"create","name":"alpha","parts":[{"aspect":"material","fragment":"waxed canvas"},{"aspect":"price","fragment":"24 dollars"}]},{"mode":"create","name":"beta","parts":[{"aspect":"material","fragment":"recycled nylon"}]}],"leftovers":[]}}}';

  it('reads the over-emit as a lever with both products intact', () => {
    const reading = readLlmReplyLever(TRAILING_BRACE_REPLY, ENVELOPE);

    expect(reading.kind).toBe('lever');
    const products = (reading.kind === 'lever' ? reading.lever['products'] : []) as ReadonlyArray<{ name: string }>;
    expect(products.map((product) => product.name)).toEqual(['alpha', 'beta']);
  });

  it('does not count a rescued reply as a swallowed decode failure', () => {
    const sites: string[] = [];
    readLlmReplyLever(TRAILING_BRACE_REPLY, { ...ENVELOPE, swallow: (site) => sites.push(site) });
    expect(sites).toEqual([]);
  });

  it('counts a genuinely unreadable block exactly once, under both readings', () => {
    const failed: string[] = [];
    expect(readLlmReplyLever('{"a": nope, not json}', { swallow: (site) => failed.push(site) }).kind).toBe('parse-error');
    expect(failed).toEqual(['llm/reply-envelope.decode']);

    const failedEnvelope: string[] = [];
    expect(readLlmReplyLever('{"a": nope, not json}', { ...ENVELOPE, swallow: (site) => failedEnvelope.push(site) }).kind).toBe('parse-error');
    expect(failedEnvelope).toEqual(['llm/reply-envelope.decode']);
  });

  it('reads a complete object followed by trailing prose (greedy fails, balanced wins)', () => {
    expect(readLlmReplyLever('{"ok":true} ... hope that helps! }').kind).toBe('lever');
  });

  it('ignores braces inside string literals when balancing', () => {
    const reading = readLlmReplyLever(String.raw`{"note":"a \" quote and a } brace"}}`);
    expect(reading.kind === 'lever' && reading.lever).toEqual({ note: 'a " quote and a } brace' });
  });

  it('resolves two top-level objects to the first', () => {
    const reading = readLlmReplyLever('{"first":1}\n{"second":2}');
    expect(reading.kind === 'lever' && reading.lever).toEqual({ first: 1 });
  });

  it('keeps every greedy-readable shape on its greedy reading', () => {
    expect(readLlmReplyLever('{"answerable":true,"lever":{"ok":true}}', ENVELOPE).kind).toBe('lever');
    expect(readLlmReplyLever('{"items":[]}', ENVELOPE).kind).toBe('lever');
    expect(readLlmReplyLever('Sure!\n```json\n{"ok": true}\n```', ENVELOPE).kind).toBe('lever');
    expect(readLlmReplyLever('{"answerable": false}', ENVELOPE).kind).toBe('declined');
    expect(readLlmReplyLever('{"answerable":false,"lever":{"kind":"question"}}', ENVELOPE).kind).toBe('declined');
    expect(readLlmReplyLever('here is only prose, no json', ENVELOPE).kind).toBe('no-json');
    expect(readLlmReplyLever(`{"products": ["${'\t'.repeat(200)}`, ENVELOPE).kind).toBe('no-json');
    expect(readLlmReplyLever('{"a": 1,}', ENVELOPE).kind).toBe('parse-error');
    // A nested object whose greedy superset parses still resolves to the superset, never the inner object.
    const nested = readLlmReplyLever('{"outer":{"inner":1}}', ENVELOPE);
    expect(nested.kind === 'lever' && nested.lever).toEqual({ outer: { inner: 1 } });
  });

  it('reads the rationale off the over-emit too (every reader shares the slicer)', () => {
    expect(llmReplyRationaleOf(TRAILING_BRACE_REPLY)).toBe('Two new products are declared with their materials; nothing else remains.');
  });
});

describe('resolveLlmReplyReadingEnvelope()', () => {
  const keys: LlmReplyEnvelopeKeys = { lever: 'payload', answerable: 'ok', rationale: 'why' };

  it('reads json-envelope through the host keys, defaulting to the library keys', () => {
    expect(resolveLlmReplyReadingEnvelope('json-envelope', keys)).toBe(keys);
    expect(resolveLlmReplyReadingEnvelope('json-envelope', undefined)).toBe(DEFAULT_LLM_REPLY_ENVELOPE_KEYS);
  });

  it('reads every other protocol with no envelope', () => {
    expect(resolveLlmReplyReadingEnvelope('json', keys)).toBeUndefined();
    expect(resolveLlmReplyReadingEnvelope('line', keys)).toBeUndefined();
  });
});

describe('readLlmDispatchResultLever()', () => {
  it('reads a lever stamp as that object, whatever the text', () => {
    expect(readLlmDispatchResultLever({ text: '{"ok":true,"payload":{"a":1}}', lever: '{"a":1}', decodeStatus: 'retried' })).toEqual({ kind: 'lever', lever: { a: 1 } });
  });

  it('reads an accepted result with no lever as declined', () => {
    expect(readLlmDispatchResultLever({ text: '{"answerable":false}', decodeStatus: 'clean' })).toEqual({ kind: 'declined' });
  });

  it('reads a dropped result as no-json', () => {
    expect(readLlmDispatchResultLever({ text: '{"a":1}', decodeStatus: 'dropped' })).toEqual({ kind: 'no-json' });
  });

  it('reads an unstamped result as the json reading of its text', () => {
    expect(readLlmDispatchResultLever({ text: 'Sure: {"a":1}' })).toEqual({ kind: 'lever', lever: { a: 1 } });
    expect(readLlmDispatchResultLever({ text: '{"lever":{"a":1}}' })).toEqual({ kind: 'lever', lever: { lever: { a: 1 } } });
    expect(readLlmDispatchResultLever({ text: 'prose' })).toEqual({ kind: 'no-json' });
  });

  it('reads a lever stamp that does not parse into an object as parse-error', () => {
    expect(readLlmDispatchResultLever({ text: '', lever: '[1]', decodeStatus: 'clean' })).toEqual({ kind: 'parse-error' });
  });
});

describe('llmReplyLeverOf()', () => {
  it('returns the lever for a lever reading', () => {
    expect(llmReplyLeverOf('{"ok": true}')).toEqual({ ok: true });
  });

  it('returns undefined for every non-lever reading', () => {
    expect(llmReplyLeverOf('prose only')).toBeUndefined();
    expect(llmReplyLeverOf('{"a": nope}')).toBeUndefined();
    expect(llmReplyLeverOf('{"answerable": false}', ENVELOPE)).toBeUndefined();
  });

  it('returns undefined for a hedged decline', () => {
    expect(llmReplyLeverOf('{"answerable":false,"lever":{"kind":"question","tokens":[]}}', ENVELOPE)).toBeUndefined();
  });
});

describe('llmReplyRationaleOf()', () => {
  it('reads the rationale of a declining reply', () => {
    expect(llmReplyRationaleOf('{"answerable":false,"rationale":"No product in the catalog matches \'tote\'","lever":{}}')).toBe("No product in the catalog matches 'tote'");
  });

  it('trims it, and tolerates surrounding prose / a code fence', () => {
    expect(llmReplyRationaleOf('Sure!\n```json\n{"answerable":true,"rationale":"  a reason  ","lever":{}}\n```')).toBe('a reason');
  });

  it('returns undefined for a bare lever, bare prose, and a blank / non-string rationale', () => {
    expect(llmReplyRationaleOf('{"kind":"statement","tokens":[]}')).toBeUndefined();
    expect(llmReplyRationaleOf('no json here')).toBeUndefined();
    expect(llmReplyRationaleOf('{"rationale":"   "}')).toBeUndefined();
    expect(llmReplyRationaleOf('{"rationale":42}')).toBeUndefined();
  });
});

describe('llmLineReplyLeverOf()', () => {
  it('lifts a bare line into { line }', () => {
    expect(llmLineReplyLeverOf('  A sturdy canvas tote.  ')).toEqual({ line: 'A sturdy canvas tote.' });
  });

  it('strips one wrapping fence', () => {
    expect(llmLineReplyLeverOf('```text\nA sturdy canvas tote.\n```')).toEqual({ line: 'A sturdy canvas tote.' });
  });

  it('honors a custom field', () => {
    expect(llmLineReplyLeverOf('A sturdy canvas tote.', { field: 'title' })).toEqual({ title: 'A sturdy canvas tote.' });
  });

  it('returns undefined for blank input', () => {
    expect(llmLineReplyLeverOf('   ')).toBeUndefined();
  });

  it('keeps a JSON reply only when it carries the string field', () => {
    expect(llmLineReplyLeverOf('{"line":"hi"}')).toEqual({ line: 'hi' });
    expect(llmLineReplyLeverOf('{"other":1}')).toBeUndefined();
  });

  it('unwraps and declines only with an envelope', () => {
    expect(llmLineReplyLeverOf('{"answerable":false}', ENVELOPE)).toBeUndefined();
    expect(llmLineReplyLeverOf('{"lever":{"line":"x"}}', ENVELOPE)).toEqual({ line: 'x' });
    expect(llmLineReplyLeverOf('{"lever":{"line":"x"}}')).toBeUndefined();
  });
});

describe('isLlmReplyObject()', () => {
  it('accepts objects and arrays and rejects everything else', () => {
    expect(isLlmReplyObject({})).toBe(true);
    expect(isLlmReplyObject([])).toBe(true);
    expect(isLlmReplyObject(null)).toBe(false);
    expect(isLlmReplyObject('x')).toBe(false);
    expect(isLlmReplyObject(1)).toBe(false);
  });
});

describe('llmReplyEnvelopeContractIntro()', () => {
  it('names the default lever key', () => {
    expect(llmReplyEnvelopeContractIntro()).toBe('Return the `lever` as a JSON object with these fields:');
  });

  it('names a custom lever key', () => {
    expect(llmReplyEnvelopeContractIntro({ lever: 'payload', answerable: 'ok', rationale: 'why' })).toBe('Return the `payload` as a JSON object with these fields:');
  });
});

describe('the decode-failure tie', () => {
  it('feeds the degenerate kinds to classifyLlmDecodeFailure', () => {
    const empty = readLlmReplyLever('');
    const broken = readLlmReplyLever('{"a": nope}');

    expect(empty.kind).toBe('no-json');
    expect(broken.kind).toBe('parse-error');

    if ((empty.kind === 'no-json' || empty.kind === 'parse-error') && (broken.kind === 'no-json' || broken.kind === 'parse-error')) {
      expect(classifyLlmDecodeFailure(empty.kind, { text: '', finishReason: 'stop' })).toBe('empty-result');
      expect(classifyLlmDecodeFailure(broken.kind, { text: '{"a": nope}', finishReason: 'stop' })).toBe('parse-error');
    }
  });
});
