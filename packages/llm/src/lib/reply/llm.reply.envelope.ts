/**
 * The D10 reply reader — the tolerant `{…}`-block read behind both JSON reply protocols, the `json-envelope` unwrap,
 * and the thin lever / rationale / line readers a capability parser calls. Every capability validates the resulting
 * lever against its OWN wire schema; this module only finds and unwraps it.
 *
 * The block read is LAYERED: the greedy first-`{`-to-last-`}` slice first (so every reply the greedy slice reads keeps
 * its reading byte for byte), then a string-aware BALANCED scan for the replies that greedy slice DROPS. A model that
 * emits a complete object followed by one stray `}` is a measured, common cause of lost replies, and its payload is
 * perfectly good.
 *
 * Non-goal: nothing here ever repairs a missing brace. The deterministic repair tier (`repairLlmReplyJson`) and the
 * dispatcher's length-truncation output-budget raise own a reply that never closes.
 *
 * The two JSON protocols:
 *
 * - `json` (no `envelope` configured) — the parsed object IS the lever. It is never unwrapped and never declines.
 * - `json-envelope` (an {@link LlmReplyEnvelopeKeys} configured) — the model is asked for an envelope whose `lever` key
 *   carries the lever and whose `answerable` key may decline. A reader also tolerates a BARE lever (the lever's fields
 *   at the top level): hosts read lever-level flags off a bare reply, so the whole object is the lever when the
 *   envelope's lever key holds no object. A declining envelope that filled a lever anyway (the HEDGED decline) carries
 *   it on the `declined` reading, so a capability that cannot fail its caller may salvage it.
 *
 * Only `json-envelope` declines.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmSwallowSink, type LlmSwallowSiteId, NOOP_LLM_SWALLOW_SINK } from '../record/llm.swallow';

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
   * The key whose OBJECT value carries the lever.
   */
  readonly lever: string;
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
 * The default envelope keys — `lever`, `answerable` and `rationale`.
 */
export const DEFAULT_LLM_REPLY_ENVELOPE_KEYS: LlmReplyEnvelopeKeys = { lever: 'lever', answerable: 'answerable', rationale: 'rationale' };

/**
 * The default single lever field a `line` reply lifts into.
 */
export const DEFAULT_LLM_LINE_LEVER_FIELD = 'line';

/**
 * Whether a value is a non-null object (the lever / envelope guard). Arrays pass too.
 *
 * @param value - The value to test.
 * @returns `true` when it is a non-null object.
 */
export function isLlmReplyObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}

/**
 * `JSON.parse` that yields `undefined` instead of throwing on malformed input.
 *
 * @param text - The candidate JSON text.
 * @param swallow - The sink the decode failure is counted on.
 * @returns The parsed value, or `undefined` when it is not valid JSON.
 */
function parseJsonOrUndefined(text: string, swallow: LlmSwallowSink): unknown {
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch (error) {
    value = undefined;
    swallow(LLM_REPLY_ENVELOPE_DECODE_SWALLOW_SITE, error);
  }

  return value;
}

/**
 * The BALANCED `{…}` slice starting at an opening brace — a depth counter that is STRING-AWARE (a `"` opens / closes a
 * JSON string, a `\` escapes the next character), so a brace inside a string literal never moves the depth. Returns
 * `undefined` when the object never closes: a mid-object truncation is not this function's business, and nothing here
 * ever repairs a missing brace.
 *
 * @param raw - The reply text.
 * @param start - The index of the opening `{`.
 * @returns The balanced slice, or `undefined` when the object never closes.
 */
function balancedObjectSlice(raw: string, start: number): Maybe<string> {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;

  for (let index = start; index < raw.length && end < 0; index += 1) {
    const character = raw[index];

    if (escaped) {
      escaped = false;
    } else if (inString) {
      if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
    } else if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      end = depth === 0 ? index + 1 : end;
    }
  }

  return end < 0 ? undefined : raw.slice(start, end);
}

/**
 * The raw JSON reading behind every reader — whether a `{…}` block was present at all (the `no-json` vs `parse-error`
 * discrimination) and the object it parsed to.
 */
interface LlmReplyJsonReading {
  /**
   * Whether the reply carried a `{…}` block at all (a `{` with a `}` somewhere after it).
   */
  readonly found: boolean;
  /**
   * The parsed object, absent when no candidate slice parsed into one.
   */
  readonly value?: Record<string, unknown>;
}

/**
 * Find + parse the reply's JSON object. The ONE slicer every reader shares, LAYERED so the balanced pass is strictly
 * additive.
 *
 * 1. The GREEDY slice (first `{` → LAST `}`). Parses to an object ⇒ that object wins.
 * 2. Otherwise each TOP-LEVEL `{…}` object in order (each candidate's balanced slice, then the next `{` AFTER that
 *    slice); the first candidate that parses into an object wins.
 *
 * The candidates are TOP-LEVEL objects only, never nested ones, and that is what keeps truncation a non-goal: an object
 * that never closes ENDS the scan (everything after it is inside it), so a completion cut mid-object stays degenerate
 * rather than resolving to whichever inner `{…}` happened to close before the cut.
 *
 * The decode failure is counted on `swallow` exactly once, and ONLY when no candidate parsed — a reply the balanced
 * pass rescues is a successful read, not a swallowed one.
 *
 * @param raw - The model's raw reply text.
 * @param swallow - The sink a malformed-JSON decode is counted on.
 * @returns The reading (block found? / the parsed object).
 */
function readLlmReplyJson(raw: string, swallow: LlmSwallowSink): LlmReplyJsonReading {
  const greedy = raw.match(/\{[\s\S]*\}/);
  let failure: unknown;
  const capture: LlmSwallowSink = (_site, cause) => {
    failure = failure ?? cause;
  };
  let value: Maybe<Record<string, unknown>>;

  if (greedy != null) {
    const parsed = parseJsonOrUndefined(greedy[0], capture);
    value = isLlmReplyObject(parsed) ? parsed : undefined;

    let index = value == null ? raw.indexOf('{') : -1;

    while (index >= 0) {
      const slice = balancedObjectSlice(raw, index);
      const candidate = slice == null ? undefined : parseJsonOrUndefined(slice, capture);
      value = isLlmReplyObject(candidate) ? candidate : undefined;
      // A slice that never closes ends the scan: everything past it is NESTED inside it, so there is no further
      // top-level candidate — the truncation non-goal, enforced structurally.
      index = value != null || slice == null ? -1 : raw.indexOf('{', index + slice.length);
    }

    if (value == null) {
      swallow(LLM_REPLY_ENVELOPE_DECODE_SWALLOW_SITE, failure);
    }
  }

  return { found: greedy != null, ...(value == null ? {} : { value }) };
}

/**
 * Unwrap a parsed `json-envelope` reply to its lever. Returns `undefined` when the model declined; otherwise the
 * envelope's lever sub-object, or the whole object as a bare lever.
 *
 * @param parsed - The parsed reply object.
 * @param keys - The envelope keys.
 * @returns The lever object to validate, or `undefined` when the reply declined.
 */
function envelopeLeverOf(parsed: Record<string, unknown>, keys: LlmReplyEnvelopeKeys): Maybe<Record<string, unknown>> {
  const enveloped = parsed[keys.lever];
  let lever: Maybe<Record<string, unknown>>;

  if (parsed[keys.answerable] === false) {
    lever = undefined;
  } else if (isLlmReplyObject(enveloped)) {
    lever = enveloped;
  } else {
    lever = parsed;
  }

  return lever;
}

/**
 * The classified outcome of {@link readLlmReplyLever} — keeps the LEGITIMATE in-band non-answer (`declined`) distinct
 * from the DEGENERATE decode failures (`no-json` / `parse-error`). A dispatcher retries the degenerate kinds (they are a
 * malformed completion) but never `declined` (a faithful "there is nothing to say" halt).
 */
export type LlmReplyLeverReading =
  | {
      /**
       * A usable lever was read — the object to validate against the capability's wire schema.
       */
      readonly kind: 'lever';
      /**
       * The lever object.
       */
      readonly lever: Record<string, unknown>;
    }
  | {
      /**
       * The `json-envelope` reply declined (its `answerable` key is `false`) — a legitimate non-answer, NOT a
       * malformed completion. A dispatcher never retries this.
       */
      readonly kind: 'declined';
      /**
       * The envelope's lever when the DECLINING reply carried one anyway — a HEDGING model that declined and then
       * filled a usable payload beside it. Present so a capability that CANNOT fail its caller can salvage the reading;
       * every capability for which a decline is a legitimate halt ignores it. Absent when the declining envelope carried
       * no lever object.
       */
      readonly lever?: Record<string, unknown>;
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
 * The kind of an {@link LlmReplyLeverReading}.
 */
export type LlmReplyLeverReadingKind = LlmReplyLeverReading['kind'];

/**
 * How a reply is read.
 */
export interface LlmReplyReadConfig {
  /**
   * The envelope keys. Set ⇒ the `json-envelope` reading (unwrap and decline); unset ⇒ the `json` reading (the parsed
   * object is the lever and never declines).
   */
  readonly envelope?: Maybe<LlmReplyEnvelopeKeys>;
  /**
   * Where an unparseable block is counted. Defaults to {@link NOOP_LLM_SWALLOW_SINK}.
   */
  readonly swallow?: Maybe<LlmSwallowSink>;
}

/**
 * Read a capability's reply text into a classified {@link LlmReplyLeverReading}. Tolerant of surrounding prose / code
 * fences (it grabs a `{…}` block through the layered slicer): no block at all ⇒ `no-json`; a block no candidate slice
 * parses into an object ⇒ `parse-error`; otherwise the `json` reading's whole object, or the `json-envelope` reading's
 * unwrapped lever or decline.
 *
 * @param text - The model's raw reply text.
 * @param config - The envelope keys (unset ⇒ the `json` reading) and the swallow sink.
 * @returns The classified reading.
 */
export function readLlmReplyLever(text: string, config?: Maybe<LlmReplyReadConfig>): LlmReplyLeverReading {
  const envelope = config?.envelope;
  const json = readLlmReplyJson(text, config?.swallow ?? NOOP_LLM_SWALLOW_SINK);
  const parsed = json.value;
  let reading: LlmReplyLeverReading;

  if (!json.found) {
    reading = { kind: 'no-json' };
  } else if (parsed == null) {
    reading = { kind: 'parse-error' };
  } else if (envelope == null) {
    reading = { kind: 'lever', lever: parsed };
  } else {
    const lever = envelopeLeverOf(parsed, envelope);

    if (lever == null) {
      const hedged = parsed[envelope.lever];
      reading = { kind: 'declined', ...(isLlmReplyObject(hedged) ? { lever: hedged } : {}) };
    } else {
      reading = { kind: 'lever', lever };
    }
  }

  return reading;
}

/**
 * Read a capability's reply text into its lever object — the thin wrapper over {@link readLlmReplyLever} a capability
 * parser calls. A `no-json` / `parse-error` / `declined` reading all collapse to `undefined`.
 *
 * @param text - The model's raw reply text.
 * @param config - The envelope keys (unset ⇒ the `json` reading) and the swallow sink.
 * @returns The lever object to validate, or `undefined`.
 */
export function llmReplyLeverOf(text: string, config?: Maybe<LlmReplyReadConfig>): Maybe<Record<string, unknown>> {
  const reading = readLlmReplyLever(text, config);
  return reading.kind === 'lever' ? reading.lever : undefined;
}

/**
 * Read the model's one-sentence rationale off a raw reply — the single most useful field on a DECLINING reply, since it
 * usually names the defect outright. Read the same way under either protocol, through the same layered slicer; a bare
 * lever, prose, or a non-string or blank rationale yields `undefined`.
 *
 * @param text - The model's raw reply text.
 * @param config - The envelope keys (whose `rationale` key is read; default {@link DEFAULT_LLM_REPLY_ENVELOPE_KEYS}) and the swallow sink.
 * @returns The trimmed rationale, or `undefined` when the reply carries none.
 */
export function llmReplyRationaleOf(text: string, config?: Maybe<LlmReplyReadConfig>): Maybe<string> {
  const key = (config?.envelope ?? DEFAULT_LLM_REPLY_ENVELOPE_KEYS).rationale;
  const parsed = readLlmReplyJson(text, config?.swallow ?? NOOP_LLM_SWALLOW_SINK).value;
  const rationale = parsed == null ? undefined : parsed[key];
  const trimmed = typeof rationale === 'string' ? rationale.trim() : '';
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Strip a single wrapping markdown code fence (with an optional language tag) from a reply — a model occasionally wraps
 * a bare-prose reply in a fence despite the `line` contract.
 *
 * @param raw - The raw reply text.
 * @returns The reply with one surrounding fence removed, or the original text unchanged.
 */
function stripCodeFence(raw: string): string {
  const fenced = raw.trim().match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
  return fenced == null ? raw : fenced[1];
}

/**
 * How a `line` reply is lifted into a lever.
 */
export interface LlmLineReplyLeverConfig extends LlmReplyReadConfig {
  /**
   * The single lever field the line lifts into. Defaults to {@link DEFAULT_LLM_LINE_LEVER_FIELD}.
   */
  readonly field?: Maybe<string>;
}

/**
 * Lift a `line` (bare-prose) reply into a single-field `{ [field]: line }` lever. The model is asked to return ONLY the
 * line, so the whole cleaned reply IS the payload; this wraps it into the lever shape the capability's wire schema
 * validates, keeping parse → check → write-back identical to the JSON path.
 *
 * A `{`-led reply (the model returned JSON anyway) is read through {@link llmReplyLeverOf} — unwrapped and declinable
 * only when `envelope` is configured — and kept only when it carries a string `field`.
 *
 * @param text - The model's raw reply text (expected to be the bare line).
 * @param config - The lever field, the envelope keys and the swallow sink.
 * @returns The `{ [field]: line }` lever, or `undefined` when there is no usable line.
 */
export function llmLineReplyLeverOf(text: string, config?: Maybe<LlmLineReplyLeverConfig>): Maybe<Record<string, unknown>> {
  const field = config?.field ?? DEFAULT_LLM_LINE_LEVER_FIELD;
  const cleaned = stripCodeFence(text).trim();
  let result: Maybe<Record<string, unknown>>;

  if (cleaned.startsWith('{')) {
    const lever = llmReplyLeverOf(cleaned, { envelope: config?.envelope, swallow: config?.swallow });
    result = lever != null && typeof lever[field] === 'string' ? lever : undefined;
  } else if (cleaned.length > 0) {
    result = { [field]: cleaned };
  }

  return result;
}

/**
 * The output-contract intro for a `json-envelope` host — names the key that carries the lever, so the contract's
 * fields read as the lever's. A host passes it as its `outputContractIntro` text.
 *
 * @param keys - The envelope keys. Defaults to {@link DEFAULT_LLM_REPLY_ENVELOPE_KEYS}.
 * @returns The intro line.
 */
export function llmReplyEnvelopeContractIntro(keys?: Maybe<LlmReplyEnvelopeKeys>): string {
  return `Return the \`${(keys ?? DEFAULT_LLM_REPLY_ENVELOPE_KEYS).lever}\` as a JSON object with these fields:`;
}
