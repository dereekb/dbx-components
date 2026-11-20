/**
 * The D10 reply reader — the tolerant `{…}`-block read behind both JSON reply protocols, the `json-envelope` unwrap,
 * and the thin value / rationale / line readers a capability parser calls. Every capability validates the resulting
 * value against its OWN wire schema; this module only finds and unwraps it.
 *
 * The block read is `@dereekb/util` `readJsonObjectFromText`, LAYERED: the greedy first-`{`-to-last-`}` slice first (so
 * every reply the greedy slice reads keeps its reading byte for byte), then a string-aware BALANCED scan for the
 * replies that greedy slice DROPS. A model that emits a complete object followed by one stray `}` is a measured, common
 * cause of lost replies, and its payload is perfectly good.
 *
 * Non-goal: nothing here ever repairs a missing brace. The deterministic repair tier (`repairLlmReplyJson`) and the
 * dispatcher's length-truncation output-budget raise own a reply that never closes.
 *
 * The two JSON protocols:
 *
 * - `json` (no `envelope` configured) — the parsed object IS the value. It is never unwrapped and never declines.
 * - `json-envelope` (an {@link LlmReplyEnvelopeKeys} configured) — the model is asked for an envelope whose `value` key
 *   carries the value and whose `answerable` key may decline. A reader also tolerates a BARE value (the value's fields
 *   at the top level): hosts read value-level flags off a bare reply, so the whole object is the value when the
 *   envelope's value key holds no object. A declining envelope that filled a value anyway (the HEDGED decline) carries
 *   it on the `declined` reading, so a capability that cannot fail its caller may salvage it.
 *
 * Only `json-envelope` declines.
 */

import { type JsonObjectInText, type Maybe, parseJsonObjectOrUndefined, readJsonObjectFromText, stripMarkdownCodeFence } from '@dereekb/util';
import { type LlmSwallowSink, type LlmSwallowSiteId, noopLlmSwallowSink } from '../record/llm.swallow';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
import { isLlmReplyObject } from './llm.reply.object';
import { type LlmReplyProtocol } from './llm.reply.protocol';

/**
 * The swallow site a reply whose JSON block does not parse is counted on — reported exactly once per read, and only
 * when no candidate block parsed.
 */
export const LLM_REPLY_ENVELOPE_DECODE_SWALLOW_SITE: LlmSwallowSiteId = 'llm/reply-envelope.decode';

/**
 * The keys of a `json-envelope` reply.
 */
export interface LlmReplyEnvelopeKeys {
  /**
   * The key whose OBJECT value carries the reply value.
   */
  readonly value: string;
  /**
   * The key whose `false` value declines — no faithful answer exists.
   */
  readonly answerable: string;
  /**
   * The key whose string value is the model's one-sentence rationale.
   */
  readonly rationale: string;
}

/**
 * The default envelope keys — `value`, `answerable` and `rationale`. A host that kept the old `lever` key passes
 * `{ value: 'lever', answerable: 'answerable', rationale: 'rationale' }` as its own keys.
 */
export const DEFAULT_LLM_REPLY_ENVELOPE_KEYS: LlmReplyEnvelopeKeys = { value: 'value', answerable: 'answerable', rationale: 'rationale' };

/**
 * The default single value field a `line` reply lifts into.
 */
export const DEFAULT_LLM_LINE_VALUE_FIELD = 'line';

/**
 * Find + parse the reply's JSON object. The ONE slicer every reader shares: `@dereekb/util` `readJsonObjectFromText`,
 * LAYERED so the balanced pass is strictly additive.
 *
 * 1. The GREEDY slice (first `{` → LAST `}`). Parses to an object ⇒ that object wins.
 * 2. Otherwise each TOP-LEVEL `{…}` object in order (each candidate's balanced slice, then the next `{` AFTER that
 *    slice); the first candidate that parses into an object wins.
 *
 * The candidates are TOP-LEVEL objects only, never nested ones, and that is what keeps truncation a non-goal: an object
 * that never closes ENDS the scan (everything after it is inside it), so a completion cut mid-object stays degenerate
 * rather than resolving to whichever inner `{…}` happened to close before the cut.
 *
 * The decode failure is counted on `swallow` exactly once, with the first parse failure, and ONLY when no candidate
 * parsed — a reply the balanced pass rescues is a successful read, not a swallowed one.
 *
 * @param raw - The model's raw reply text.
 * @param swallow - The sink a malformed-JSON decode is counted on.
 * @returns The reading (block found? / the parsed object).
 */
function readLlmReplyJson(raw: string, swallow: LlmSwallowSink): JsonObjectInText {
  const reading = readJsonObjectFromText(raw);

  if (reading.found && reading.value == null) {
    swallow(LLM_REPLY_ENVELOPE_DECODE_SWALLOW_SITE, reading.error);
  }

  return reading;
}

/**
 * Unwrap a parsed `json-envelope` reply to its value. Returns `undefined` when the model declined; otherwise the
 * envelope's value sub-object, or the whole object as a bare value.
 *
 * @param parsed - The parsed reply object.
 * @param keys - The envelope keys.
 * @returns The value object to validate, or `undefined` when the reply declined.
 */
function readEnvelopeValue(parsed: Record<string, unknown>, keys: LlmReplyEnvelopeKeys): Maybe<Record<string, unknown>> {
  const enveloped = parsed[keys.value];
  let value: Maybe<Record<string, unknown>>;

  if (parsed[keys.answerable] === false) {
    value = undefined;
  } else if (isLlmReplyObject(enveloped)) {
    value = enveloped;
  } else {
    value = parsed;
  }

  return value;
}

/**
 * The classified outcome of {@link readLlmReply} — keeps the LEGITIMATE in-band non-answer (`declined`) distinct
 * from the DEGENERATE decode failures (`no-json` / `parse-error`). A dispatcher retries the degenerate kinds (they are a
 * malformed completion) but never `declined` (a faithful "there is nothing to say" halt).
 */
export type LlmReplyReading =
  | {
      /**
       * A usable value was read — the object to validate against the capability's wire schema.
       */
      readonly kind: 'value';
      /**
       * The value object.
       */
      readonly value: Record<string, unknown>;
    }
  | {
      /**
       * The `json-envelope` reply declined (its `answerable` key is `false`) — a legitimate non-answer, NOT a
       * malformed completion. A dispatcher never retries this.
       */
      readonly kind: 'declined';
      /**
       * The envelope's value when the DECLINING reply carried one anyway — a HEDGING model that declined and then
       * filled a usable payload beside it. Present so a capability that CANNOT fail its caller can salvage the reading;
       * every capability for which a decline is a legitimate halt ignores it. Absent when the declining envelope carried
       * no value object.
       */
      readonly value?: Record<string, unknown>;
    }
  | {
      /**
       * No `{…}` block was found at all (bare prose, or a completion truncated before a closing brace) — a degenerate
       * decode.
       */
      readonly kind: 'no-json';
    }
  | {
      /**
       * A `{…}` block was present but did not parse into an object (malformed or mid-object truncated JSON) — a
       * degenerate decode.
       */
      readonly kind: 'parse-error';
    };

/**
 * The kind of an {@link LlmReplyReading}.
 */
export type LlmReplyReadingKind = LlmReplyReading['kind'];

/**
 * How a reply is read.
 */
export interface LlmReplyReadConfig {
  /**
   * The envelope keys. Set ⇒ the `json-envelope` reading (unwrap and decline); unset ⇒ the `json` reading (the parsed
   * object is the value and never declines).
   */
  readonly envelope?: Maybe<LlmReplyEnvelopeKeys>;
  /**
   * Where an unparseable block is counted. Defaults to {@link noopLlmSwallowSink}.
   */
  readonly swallow?: Maybe<LlmSwallowSink>;
}

/**
 * Read a capability's reply text into a classified {@link LlmReplyReading}. Tolerant of surrounding prose / code
 * fences (it grabs a `{…}` block through the layered slicer): no block at all ⇒ `no-json`; a block no candidate slice
 * parses into an object ⇒ `parse-error`; otherwise the `json` reading's whole object, or the `json-envelope` reading's
 * unwrapped value or decline.
 *
 * @param text - The model's raw reply text.
 * @param config - The envelope keys (unset ⇒ the `json` reading) and the swallow sink.
 * @returns The classified reading.
 */
export function readLlmReply(text: string, config?: Maybe<LlmReplyReadConfig>): LlmReplyReading {
  const envelope = config?.envelope;
  const json = readLlmReplyJson(text, config?.swallow ?? noopLlmSwallowSink);
  const parsed = json.value;
  let reading: LlmReplyReading;

  if (!json.found) {
    reading = { kind: 'no-json' };
  } else if (parsed == null) {
    reading = { kind: 'parse-error' };
  } else if (envelope == null) {
    reading = { kind: 'value', value: parsed };
  } else {
    const value = readEnvelopeValue(parsed, envelope);

    if (value == null) {
      const hedged = parsed[envelope.value];
      reading = { kind: 'declined', ...(isLlmReplyObject(hedged) ? { value: hedged } : {}) };
    } else {
      reading = { kind: 'value', value };
    }
  }

  return reading;
}

/**
 * The envelope keys a reply is READ with under a protocol — the one rule the dispatcher's reader, its repair tiers and
 * its decode rows share: `json-envelope` ⇒ the host's keys (default {@link DEFAULT_LLM_REPLY_ENVELOPE_KEYS}); every
 * other protocol ⇒ none (the whole reply is the payload).
 *
 * @param protocol - The call's resolved reply protocol.
 * @param envelope - The host's envelope keys, when it set any.
 * @returns The reading envelope, or `undefined` when the reply is not an envelope.
 *
 * @example
 * ```ts
 * resolveLlmReplyReadingEnvelope('json-envelope', undefined); // DEFAULT_LLM_REPLY_ENVELOPE_KEYS
 * resolveLlmReplyReadingEnvelope('json', { value: 'payload', answerable: 'ok', rationale: 'why' }); // undefined
 * ```
 */
export function resolveLlmReplyReadingEnvelope(protocol: LlmReplyProtocol, envelope: Maybe<LlmReplyEnvelopeKeys>): Maybe<LlmReplyEnvelopeKeys> {
  return protocol === 'json-envelope' ? (envelope ?? DEFAULT_LLM_REPLY_ENVELOPE_KEYS) : undefined;
}

/**
 * Read a nested dispatch's DECODED payload — the reading its own dispatcher made with the call's resolved protocol and
 * the host's envelope: `value` ⇒ that object; accepted with no value (`clean` / `retried`) ⇒ `declined`; `dropped` ⇒
 * `no-json`; an unstamped result (a fake dispatch, or a host `resultOf` that dropped the stamp) ⇒ the `json` reading of
 * its text. A `value` stamp that does not parse into an object reads `parse-error`.
 *
 * @param result - The nested dispatch's result.
 * @returns The classified reading.
 *
 * @example
 * ```ts
 * readLlmDispatchResultReply({ text: '{"value":{"a":1}}', valueJson: '{"a":1}', decodeStatus: 'clean' }); // { kind: 'value', value: { a: 1 } }
 * readLlmDispatchResultReply({ text: 'no', decodeStatus: 'dropped' }); // { kind: 'no-json' }
 * ```
 */
export function readLlmDispatchResultReply(result: Pick<LlmDispatchResult, 'text' | 'valueJson' | 'decodeStatus'>): LlmReplyReading {
  const { text, valueJson, decodeStatus } = result;
  let reading: LlmReplyReading;

  if (valueJson != null) {
    const parsed = parseJsonObjectOrUndefined(valueJson);
    reading = parsed == null ? { kind: 'parse-error' } : { kind: 'value', value: parsed };
  } else if (decodeStatus === 'dropped') {
    reading = { kind: 'no-json' };
  } else if (decodeStatus == null) {
    reading = readLlmReply(text);
  } else {
    reading = { kind: 'declined' };
  }

  return reading;
}

/**
 * Read a capability's reply text into its value object — the thin wrapper over {@link readLlmReply} a capability
 * parser calls. A `no-json` / `parse-error` / `declined` reading all collapse to `undefined`.
 *
 * @param text - The model's raw reply text.
 * @param config - The envelope keys (unset ⇒ the `json` reading) and the swallow sink.
 * @returns The value object to validate, or `undefined`.
 */
export function readLlmReplyValue(text: string, config?: Maybe<LlmReplyReadConfig>): Maybe<Record<string, unknown>> {
  const reading = readLlmReply(text, config);
  return reading.kind === 'value' ? reading.value : undefined;
}

/**
 * Read the model's one-sentence rationale off a raw reply — the single most useful field on a DECLINING reply, since it
 * usually names the defect outright. Read the same way under either protocol, through the same layered slicer; a bare
 * value, prose, or a non-string or blank rationale yields `undefined`.
 *
 * @param text - The model's raw reply text.
 * @param config - The envelope keys (whose `rationale` key is read; default {@link DEFAULT_LLM_REPLY_ENVELOPE_KEYS}) and the swallow sink.
 * @returns The trimmed rationale, or `undefined` when the reply carries none.
 */
export function readLlmReplyRationale(text: string, config?: Maybe<LlmReplyReadConfig>): Maybe<string> {
  const key = (config?.envelope ?? DEFAULT_LLM_REPLY_ENVELOPE_KEYS).rationale;
  const parsed = readLlmReplyJson(text, config?.swallow ?? noopLlmSwallowSink).value;
  const rationale = parsed == null ? undefined : parsed[key];
  const trimmed = typeof rationale === 'string' ? rationale.trim() : '';
  return trimmed === '' ? undefined : trimmed;
}

/**
 * How a `line` reply is lifted into a value.
 */
export interface ReadLlmLineReplyValueConfig extends LlmReplyReadConfig {
  /**
   * The single value field the line lifts into. Defaults to {@link DEFAULT_LLM_LINE_VALUE_FIELD}.
   */
  readonly field?: Maybe<string>;
}

/**
 * Lift a `line` (bare-prose) reply into a single-field `{ [field]: line }` value. The model is asked to return ONLY the
 * line, so the whole cleaned reply IS the payload; this wraps it into the value shape the capability's wire schema
 * validates, keeping parse → check → write-back identical to the JSON path.
 *
 * A `{`-led reply (the model returned JSON anyway) is read through {@link readLlmReplyValue} — unwrapped and declinable
 * only when `envelope` is configured — and kept only when it carries a string `field`.
 *
 * @param text - The model's raw reply text (expected to be the bare line).
 * @param config - The value field, the envelope keys and the swallow sink.
 * @returns The `{ [field]: line }` value, or `undefined` when there is no usable line.
 */
export function readLlmLineReplyValue(text: string, config?: Maybe<ReadLlmLineReplyValueConfig>): Maybe<Record<string, unknown>> {
  const field = config?.field ?? DEFAULT_LLM_LINE_VALUE_FIELD;
  // A model occasionally wraps a bare-prose reply in a fence despite the `line` contract.
  const cleaned = stripMarkdownCodeFence(text).trim();
  let result: Maybe<Record<string, unknown>>;

  if (cleaned.startsWith('{')) {
    const value = readLlmReplyValue(cleaned, { envelope: config?.envelope, swallow: config?.swallow });
    result = value != null && typeof value[field] === 'string' ? value : undefined;
  } else if (cleaned.length > 0) {
    result = { [field]: cleaned };
  }

  return result;
}

/**
 * The output-contract intro for a `json-envelope` host — names the key that carries the value, so the contract's
 * fields read as the value's. A host passes it as its `outputContractIntro` text.
 *
 * @param keys - The envelope keys. Defaults to {@link DEFAULT_LLM_REPLY_ENVELOPE_KEYS}.
 * @returns The intro line.
 */
export function llmReplyEnvelopeContractIntro(keys?: Maybe<LlmReplyEnvelopeKeys>): string {
  return `Return the \`${(keys ?? DEFAULT_LLM_REPLY_ENVELOPE_KEYS).value}\` as a JSON object with these fields:`;
}
