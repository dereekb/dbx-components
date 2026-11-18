/**
 * The deterministic reply-repair tier — decide how JSON-like a malformed reply is ({@link scoreLlmReplyJson}), fix the
 * shape slips that need no judgment ({@link repairLlmReplyJson}), and prove a repair invented and dropped nothing
 * ({@link llmReplyRepairFidelity}). Pure: no dispatcher, no I/O. The shape types it returns live in
 * `llm.reply.json.shape.ts`.
 *
 * WHO CALLS IT. A dispatcher's reply-repair lane, and only on a CLEAN-STOP, object-led, JSON-protocol reply the plain
 * reader (`readLlmReplyLever`) could not read. The reader itself keeps its structural non-goal: it cannot see the
 * finish reason, so it can never tell a model that forgot its last `}` from a completion the token cap cut off. The
 * dispatcher can, which is why the decision to repair lives there.
 *
 * ONE LENIENT WALK. A string-aware tokenizer carries a container stack and an EXPECT state, records every fault with
 * its index, and rebuilds the text as it goes, applying a recovery op wherever one exists. The score, the verdict and
 * the repair all derive from that one walk. Pass 2 re-walks with the inner-quote heuristic only when pass 1 could not
 * produce a parseable object.
 *
 * WHAT IS NEVER REPAIRED. A reply that ends INSIDE a string, or right after a `:`, a `,`, a bare key or an opener, is
 * `truncated-looking`: that is the signature of cut content, and no tier may invent the end of a value. Python
 * literals, unquoted keys, comments and single quotes are left to the fast fix (`makeLlmReplyFastFixer`).
 */

import { type Maybe } from '@dereekb/util';
import { isLlmReplyObject } from './llm.reply.envelope';
import { type LlmReplyJsonFault, type LlmReplyJsonFaultKind, type LlmReplyJsonShape, type LlmReplyJsonVerdict } from './llm.reply.json.shape';

/**
 * One deterministic recovery op.
 */
export type LlmReplyRepairOpKind = 'close-object' | 'close-array' | 'drop-trailing-comma' | 'insert-missing-comma' | 'insert-missing-closer' | 'drop-stray-closer' | 'escape-control' | 'escape-inner-quote' | 'strip-trailing-prose' | 'strip-code-fence';

/**
 * The ops a repair applied, counted by kind.
 */
export type LlmReplyRepairOpCounts = Readonly<Partial<Record<LlmReplyRepairOpKind, number>>>;

/**
 * A deterministic repair's product.
 */
export interface LlmReplyRepairProduct {
  /**
   * The repaired JSON text (the object only — surrounding prose / fences dropped).
   */
  readonly text: string;
  /**
   * The parsed repaired object.
   */
  readonly value: Record<string, unknown>;
  /**
   * The ops applied.
   */
  readonly ops: LlmReplyRepairOpCounts;
  /**
   * Which pass produced it — pass 2 is the inner-quote re-walk.
   */
  readonly pass: 1 | 2;
}

/**
 * The result of {@link repairLlmReplyJson} — the shape, plus the repair iff the verdict is `near-miss`.
 */
export interface LlmReplyRepairResult {
  /**
   * The scorer's shape of the reply.
   */
  readonly shape: LlmReplyJsonShape;
  /**
   * The repair, present iff the verdict is `near-miss`.
   */
  readonly repaired?: LlmReplyRepairProduct;
}

/**
 * The fidelity verdict of one repair.
 */
export interface LlmReplyRepairFidelity {
  /**
   * Nothing invented AND coverage ≥ {@link LLM_REPLY_REPAIR_MIN_COVERAGE}.
   */
  readonly ok: boolean;
  /**
   * The repaired strings / keys / numbers that do not appear in the original (capped at 8).
   */
  readonly invented: ReadonlyArray<string>;
  /**
   * The fraction of the original's content literals the repair kept (1 when none were checked).
   */
  readonly coverage: number;
  /**
   * How many content literals were checked.
   */
  readonly checked: number;
}

/**
 * The input of {@link llmReplyRepairFidelity}.
 */
export interface LlmReplyRepairFidelityConfig {
  /**
   * The original reply text.
   */
  readonly original: string;
  /**
   * The repaired value.
   */
  readonly repaired: unknown;
}

/**
 * The fraction of the original's content literals a repair must keep.
 */
export const LLM_REPLY_REPAIR_MIN_COVERAGE = 0.9;

/**
 * The shortest string literal the coverage check counts as CONTENT (shorter ones are ids / enum values / keys).
 */
export const LLM_REPLY_REPAIR_CONTENT_LITERAL_MIN_CHARS = 12;

/**
 * The most faults one shape records (the op counts are never capped).
 */
export const LLM_REPLY_REPAIR_MAX_RECORDED_FAULTS = 32;

/**
 * Below this score a malformed object-led reply reads as `not-json`.
 */
const REPLY_NOT_JSON_MAX_SCORE = 0.2;

/**
 * The faults that sit at EOF and so do not count against the score.
 */
const EOF_FAULT_KINDS: ReadonlySet<LlmReplyJsonFaultKind> = new Set(['unclosed', 'ends-in-string', 'dangling']);

/**
 * One JSON literal token: a number, `true`, `false` or `null` (sticky, so it matches only AT an index).
 */
const JSON_LITERAL_TOKEN = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;

/**
 * The raw control characters a string may not carry, and their escapes.
 */
const CONTROL_ESCAPE: Readonly<Record<string, string>> = { '\n': String.raw`\n`, '\r': String.raw`\r`, '\t': String.raw`\t`, '\b': String.raw`\b`, '\f': String.raw`\f` };

/**
 * What the walk expects next.
 *
 * - `value` — after a `:` (or at the root).
 * - `item` — after a `,` inside an array.
 * - `key` — after a `,` inside an object.
 * - `key-or-close` / `value-or-close` — right after `{` / `[`.
 * - `colon` — after a key.
 * - `after-value` — after a complete value or a closer.
 */
type WalkExpect = 'value' | 'item' | 'key' | 'colon' | 'after-value' | 'key-or-close' | 'value-or-close';

/**
 * How one walk ended.
 */
type WalkEnd = 'closed' | 'eof' | 'fault' | 'truncated';

/**
 * One walk's product.
 */
interface LlmReplyJsonWalk {
  readonly out: string;
  readonly ops: LlmReplyRepairOpCounts;
  readonly faults: ReadonlyArray<LlmReplyJsonFault>;
  readonly unclosed: string;
  readonly end: WalkEnd;
}

/**
 * One string literal read by the walk.
 */
interface WalkString {
  readonly closed: boolean;
  readonly text: string;
  readonly next: number;
}

/**
 * Whether a character starts (or continues) a bare identifier — the check that keeps `nullx` / `123abc` from
 * reading as a literal.
 *
 * @param character - The character after a literal token.
 * @returns True when it would glue onto the token.
 */
function isIdentifierCharacter(character: string | undefined): boolean {
  return character != null && /[\w$]/.test(character);
}

/**
 * Whether the `"` just before `from` is an INNER quote (pass 2) — the next non-whitespace character cannot follow a
 * string close (`,` `:` `}` `]` `"` or EOF can).
 *
 * @param text - The reply text.
 * @param from - The index just after the quote.
 * @returns True when the quote is inside the string.
 */
function isInnerQuote(text: string, from: number): boolean {
  let index = from;

  while (index < text.length && /\s/.test(text[index])) {
    index += 1;
  }

  return index < text.length && !',:}]"'.includes(text[index]);
}

/**
 * Walk one reply from its opening `{`, rebuilding it with every recoverable fault fixed.
 *
 * @param text - The reply text.
 * @param start - The index of the opening `{`.
 * @param innerQuotes - Pass 2: treat a `"` that cannot close a string as an inner quote.
 * @returns The walk's product.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity -- one string-aware state machine; splitting it scatters one walk's state across closures
function walkReplyJson(text: string, start: number, innerQuotes: boolean): LlmReplyJsonWalk {
  const stack: Array<'{' | '['> = [];
  const ops: Partial<Record<LlmReplyRepairOpKind, number>> = {};
  const faults: LlmReplyJsonFault[] = [];
  let out = '';
  let expect: WalkExpect = 'value';
  let index = start;
  let end: WalkEnd | undefined;
  // The OUT index of the last real comma, so a trailing one can be cut back out.
  let lastCommaOut = -1;

  const countOp = (kind: LlmReplyRepairOpKind, by: number = 1): void => {
    ops[kind] = (ops[kind] ?? 0) + by;
  };
  const recordFault = (kind: LlmReplyJsonFaultKind, at: number): void => {
    if (faults.length < LLM_REPLY_REPAIR_MAX_RECORDED_FAULTS) {
      faults.push({ kind, at });
    }
  };
  const top = (): '{' | '[' | undefined => stack[stack.length - 1];
  const insertMissingComma = (at: number): void => {
    recordFault('missing-comma', at);
    countOp('insert-missing-comma');
    out += ',';
  };
  const readString = (at: number): WalkString => {
    let built = '"';
    let cursor = at + 1;
    let closed = false;

    while (!closed && cursor < text.length) {
      const character = text[cursor];

      if (character === '\\') {
        if (cursor + 1 >= text.length) {
          break;
        }

        built += character + text[cursor + 1];
        cursor += 2;
      } else if (character === '"') {
        if (innerQuotes && isInnerQuote(text, cursor + 1)) {
          recordFault('inner-quote', cursor);
          countOp('escape-inner-quote');
          built += String.raw`\"`;
        } else {
          built += '"';
          closed = true;
        }

        cursor += 1;
      } else if ((character.codePointAt(0) ?? 0) < 0x20) {
        recordFault('control-in-string', cursor);
        countOp('escape-control');
        built += CONTROL_ESCAPE[character] ?? String.raw`\u${(character.codePointAt(0) ?? 0).toString(16).padStart(4, '0')}`;
        cursor += 1;
      } else {
        built += character;
        cursor += 1;
      }
    }

    return { closed, text: built, next: cursor };
  };

  while (end == null && index < text.length) {
    const character = text[index];

    if (/\s/.test(character)) {
      out += character;
      index += 1;
    } else if (character === '"') {
      const valueStart: boolean = expect === 'value' || expect === 'item' || expect === 'value-or-close';
      const keyStart: boolean = expect === 'key' || expect === 'key-or-close';
      const missingComma: boolean = expect === 'after-value';

      if (valueStart || keyStart || missingComma) {
        if (missingComma) {
          insertMissingComma(index);
        }

        const asKey: boolean = keyStart || (missingComma && top() === '{');
        const read = readString(index);

        if (read.closed) {
          out += read.text;
          index = read.next;
          expect = asKey ? 'colon' : 'after-value';
        } else {
          recordFault('ends-in-string', text.length);
          end = 'truncated';
        }
      } else {
        recordFault('unexpected', index);
        end = 'fault';
      }
    } else if (character === '{' || character === '[') {
      const missingComma: boolean = expect === 'after-value' && top() === '[';

      if (missingComma || expect === 'value' || expect === 'item' || expect === 'value-or-close') {
        if (missingComma) {
          insertMissingComma(index);
        }

        stack.push(character);
        out += character;
        expect = character === '{' ? 'key-or-close' : 'value-or-close';
        index += 1;
      } else {
        recordFault('unexpected', index);
        end = 'fault';
      }
    } else if (character === '}' || character === ']') {
      const opener = character === '}' ? '{' : '[';

      if (expect === 'key' || expect === 'item') {
        // A trailing comma: cut it back out of the rebuilt text, then close normally.
        recordFault('trailing-comma', index);
        countOp('drop-trailing-comma');
        out = out.slice(0, lastCommaOut) + out.slice(lastCommaOut + 1);
        expect = 'after-value';
      }

      if (expect === 'value' || expect === 'colon') {
        recordFault('unexpected', index);
        end = 'fault';
      } else if (top() === opener) {
        stack.pop();
        out += character;
        expect = 'after-value';
        index += 1;
        end = stack.length === 0 ? 'closed' : undefined;
      } else if (stack.includes(opener)) {
        // The closer's opener is deeper in the stack: close what was left open above it first.
        recordFault('mismatched-closer', index);

        while (top() !== opener) {
          const inner = stack.pop();
          out += inner === '{' ? '}' : ']';
          countOp('insert-missing-closer');
        }

        stack.pop();
        out += character;
        expect = 'after-value';
        index += 1;
        end = stack.length === 0 ? 'closed' : undefined;
      } else {
        recordFault('stray-closer', index);
        countOp('drop-stray-closer');
        index += 1;
      }
    } else if (character === ',') {
      if (expect === 'after-value') {
        lastCommaOut = out.length;
        out += ',';
        expect = top() === '{' ? 'key' : 'item';
        index += 1;
      } else {
        recordFault('unexpected', index);
        end = 'fault';
      }
    } else if (character === ':') {
      if (expect === 'colon') {
        out += ':';
        expect = 'value';
        index += 1;
      } else {
        recordFault('unexpected', index);
        end = 'fault';
      }
    } else if (/[-\dtfn]/.test(character)) {
      JSON_LITERAL_TOKEN.lastIndex = index;
      const token = JSON_LITERAL_TOKEN.exec(text)?.[0];
      const missingComma: boolean = expect === 'after-value' && top() === '[';
      const valueStart: boolean = missingComma || expect === 'value' || expect === 'item' || expect === 'value-or-close';

      if (token == null && valueStart && /^(-|t(r(ue?)?)?|f(a(l(se?)?)?)?|n(u(ll?)?)?)$/.test(text.slice(index).trimEnd())) {
        // A literal cut off at EOF (`tru`, `-`) — the dangling-value signature.
        recordFault('dangling', text.length);
        end = 'truncated';
      } else if (token == null || !valueStart || isIdentifierCharacter(text[index + token.length])) {
        recordFault('unexpected', index);
        end = 'fault';
      } else {
        if (missingComma) {
          insertMissingComma(index);
        }

        out += token;
        index += token.length;
        expect = 'after-value';
      }
    } else if (expect === 'after-value' && text.slice(index).trimStart().startsWith('```')) {
      // A closing code fence inside an object the model never closed: drop it, then close at EOF.
      recordFault('trailing-prose', index);
      countOp('strip-code-fence');
      index = text.length;
    } else {
      recordFault('unexpected', index);
      end = 'fault';
    }
  }

  const unclosed = stack.join('');

  if (end == null) {
    if (expect === 'after-value') {
      // EOF outside a string after a complete value or a closer: close what was left open.
      recordFault('unclosed', text.length);

      while (stack.length > 0) {
        const inner = stack.pop();
        out += inner === '{' ? '}' : ']';
        countOp(inner === '{' ? 'close-object' : 'close-array');
      }

      end = 'eof';
    } else {
      // EOF right after `:` / `,` / a bare key / an opener — cut content, never closed.
      recordFault('dangling', text.length);
      end = 'truncated';
    }
  } else if (end === 'closed') {
    const rest = text.slice(index).trim();

    if (rest === '') {
      // Nothing after the root.
    } else if (/^[\]}\s]+$/.test(rest)) {
      recordFault('stray-closer', index);
      countOp('drop-stray-closer', rest.replaceAll(/\s/g, '').length);
    } else if (/^[,:"]/.test(rest)) {
      // Content after the root closed — a premature close, not a trailing remark.
      recordFault('unexpected', text.indexOf(rest[0], index));
      end = 'fault';
    } else {
      recordFault('trailing-prose', index);
      countOp(rest.startsWith('```') ? 'strip-code-fence' : 'strip-trailing-prose');
    }
  }

  return { out, ops, faults, unclosed, end };
}

/**
 * Whether a reply's tail reads as CUT content by a plain string-aware scan — EOF inside a string, or the last
 * significant character a `:` / `,`. The fallback truncation test for a walk that stopped at an earlier fault.
 *
 * @param text - The reply text.
 * @param start - The index of the opening `{`.
 * @returns True when the tail looks truncated.
 */
function endsLikeTruncation(text: string, start: number): boolean {
  let inString = false;
  let escaped = false;
  let last = '';

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (escaped) {
      escaped = false;
    } else if (inString) {
      if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
        last = '"';
      }
    } else if (character === '"') {
      inString = true;
    } else if (!/\s/.test(character)) {
      last = character;
    }
  }

  return inString || escaped || last === ':' || last === ',';
}

/**
 * Parse a rebuilt text into an object, or `undefined`.
 *
 * @param text - The rebuilt JSON text.
 * @returns The parsed object, or `undefined` when it does not parse into one.
 */
function parseObjectOrUndefined(text: string): Maybe<Record<string, unknown>> {
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch {
    // Swallow site `llm/reply-repair.rebuilt-parse` (channel `result`): the verdict carries it, so no sink is called.
    value = undefined;
  }

  return isLlmReplyObject(value) && !Array.isArray(value) ? value : undefined;
}

/**
 * The score of one walk — the fraction of the object text before its first non-EOF fault.
 *
 * @param text - The reply text.
 * @param start - The index of the opening `{`.
 * @param faults - The walk's faults.
 * @returns The score and the first fault's index.
 */
function scoreOfWalk(text: string, start: number, faults: ReadonlyArray<LlmReplyJsonFault>): { readonly score: number; readonly faultAt?: number } {
  const first = faults.find((fault) => !EOF_FAULT_KINDS.has(fault.kind));
  const span = text.trimEnd().length - start;
  let score: number;

  if (first == null) {
    score = 1;
  } else if (span <= 0) {
    score = 0;
  } else {
    score = Math.min(1, Math.max(0, (first.at - start) / span));
  }

  return { score, ...(first == null ? {} : { faultAt: first.at }) };
}

/**
 * Where a reply's object starts, and whether the reply LEADS with it (after one optional leading fence line).
 *
 * @param text - The reply text.
 * @returns The object start, whether it is object-led, and whether a leading fence was skipped.
 */
function objectLeadOf(text: string): { readonly objectStart: number; readonly objectLed: boolean; readonly fenced: boolean } {
  const trimmed = text.trimStart();
  const fenced = trimmed.startsWith('```');
  let body = trimmed;

  if (fenced) {
    const newline = trimmed.indexOf('\n');
    body = newline < 0 ? '' : trimmed.slice(newline + 1).trimStart();
  }

  const objectLed = body.startsWith('{');
  return { objectStart: objectLed ? text.length - body.length : text.indexOf('{'), objectLed, fenced: fenced && objectLed };
}

/**
 * The two passes' parsed values and whether each was faithful.
 */
interface RepairPassValues {
  readonly firstFaithful: boolean;
  readonly firstValue: Maybe<Record<string, unknown>>;
  readonly secondFaithful: boolean;
  readonly secondValue: Maybe<Record<string, unknown>>;
}

/**
 * The repaired value — pass 1's when it is faithful, else pass 2's when it is, else none.
 *
 * @param passes - The two passes' values and fidelity.
 * @returns The repaired value, or `undefined` when neither pass was faithful.
 */
function repairedValueOf(passes: RepairPassValues): Maybe<Record<string, unknown>> {
  let value: Maybe<Record<string, unknown>>;

  if (passes.firstFaithful) {
    value = passes.firstValue;
  } else if (passes.secondFaithful) {
    value = passes.secondValue;
  }

  return value;
}

/**
 * The facts the verdict is decided from.
 */
interface RepairVerdictFacts {
  readonly objectLed: boolean;
  readonly repaired: boolean;
  readonly truncated: boolean;
  readonly score: number;
}

/**
 * The verdict of one object-bearing reply.
 *
 * @param facts - Whether it is object-led, repaired and truncated-looking, and its score.
 * @returns The verdict.
 */
function repairVerdictOf(facts: RepairVerdictFacts): LlmReplyJsonVerdict {
  let verdict: LlmReplyJsonVerdict;

  if (!facts.objectLed) {
    verdict = 'not-json';
  } else if (facts.repaired) {
    verdict = 'near-miss';
  } else if (facts.truncated) {
    verdict = 'truncated-looking';
  } else if (facts.score < REPLY_NOT_JSON_MAX_SCORE) {
    verdict = 'not-json';
  } else {
    verdict = 'mangled';
  }

  return verdict;
}

/**
 * Score and (when it is a near miss) repair one reply — the one entry point of the deterministic tier.
 *
 * @param text - The model's reply text.
 * @returns The shape, plus the repair iff the verdict is `near-miss`.
 */
export function repairLlmReplyJson(text: string): LlmReplyRepairResult {
  const { objectStart, objectLed, fenced } = objectLeadOf(text);
  let result: LlmReplyRepairResult;

  if (objectStart < 0) {
    result = { shape: { verdict: 'not-json', score: 0, objectLed: false, objectStart, faults: [], unclosed: '', length: text.length } };
  } else {
    const first = walkReplyJson(text, objectStart, false);
    const firstRecoverable = first.end === 'closed' || first.end === 'eof';
    const firstValue = objectLed && firstRecoverable ? parseObjectOrUndefined(first.out) : undefined;
    const firstFaithful = firstValue != null && llmReplyRepairFidelity({ original: text, repaired: firstValue }).ok;
    // Pass 2 only when pass 1 did not produce a faithful object, and never over a pass-1 truncation.
    const second = objectLed && !firstFaithful && first.end !== 'truncated' ? walkReplyJson(text, objectStart, true) : undefined;
    const secondValue = second != null && (second.end === 'closed' || second.end === 'eof') ? parseObjectOrUndefined(second.out) : undefined;
    const secondFaithful = secondValue != null && llmReplyRepairFidelity({ original: text, repaired: secondValue }).ok;
    const winner = !firstFaithful && secondFaithful ? second : first;
    const { score, faultAt } = scoreOfWalk(text, objectStart, winner?.faults ?? first.faults);
    const truncated = first.end === 'truncated' || (first.end === 'fault' && (second?.end === 'truncated' || endsLikeTruncation(text, objectStart)));
    const repairedValue = repairedValueOf({ firstFaithful, firstValue, secondFaithful, secondValue });
    const verdict = repairVerdictOf({ objectLed, repaired: repairedValue != null, truncated, score });
    const shape: LlmReplyJsonShape = { verdict, score, objectLed, objectStart, ...(faultAt == null ? {} : { faultAt }), faults: (winner ?? first).faults, unclosed: (winner ?? first).unclosed, length: text.length };

    if (repairedValue != null && winner != null) {
      const ops: Partial<Record<LlmReplyRepairOpKind, number>> = { ...winner.ops };

      if (fenced) {
        ops['strip-code-fence'] = (ops['strip-code-fence'] ?? 0) + 1;
      }

      result = { shape, repaired: { text: winner.out, value: repairedValue, ops, pass: firstFaithful ? 1 : 2 } };
    } else {
      result = { shape };
    }
  }

  return result;
}

/**
 * Score one reply without keeping the repair — the shape {@link repairLlmReplyJson} computes.
 *
 * @param text - The model's reply text.
 * @returns The shape.
 */
export function scoreLlmReplyJson(text: string): LlmReplyJsonShape {
  return repairLlmReplyJson(text).shape;
}

/**
 * The JSON escapes a raw reply may carry, decoded back to their characters.
 */
const JSON_ESCAPED_CHARACTER: Readonly<Record<string, string>> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };

/**
 * Decode the JSON escapes in raw reply text (`\n`, `\"`, `\uXXXX`, …) so it compares with parsed values.
 *
 * @param text - Raw reply text.
 * @returns The text with escapes decoded.
 */
function decodeJsonEscapes(text: string): string {
  return text.replaceAll(/\\(?:u([\da-fA-F]{4})|([\s\S]))/g, (_match: string, hex: string | undefined, escaped: string | undefined) => (hex == null ? (JSON_ESCAPED_CHARACTER[escaped ?? ''] ?? escaped ?? '') : String.fromCodePoint(Number.parseInt(hex, 16))));
}

/**
 * The fidelity comparison key — whitespace, quotes and backslashes stripped, so escaping and layout never count as
 * a content change.
 *
 * @param text - The text to key.
 * @returns Its comparison key.
 */
function fidelityKeyOf(text: string): string {
  return text.replaceAll(/[\s"\\]/g, '');
}

/**
 * Collect a parsed value's string leaves + object keys and number leaves.
 *
 * @param value - The parsed value.
 * @param strings - The string / key accumulator.
 * @param numbers - The number accumulator.
 */
function collectLeaves(value: unknown, strings: string[], numbers: number[]): void {
  if (typeof value === 'string') {
    strings.push(value);
  } else if (typeof value === 'number') {
    numbers.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectLeaves(item, strings, numbers));
  } else if (isLlmReplyObject(value)) {
    Object.entries(value).forEach(([key, item]) => {
      strings.push(key);
      collectLeaves(item, strings, numbers);
    });
  }
}

/**
 * Prove a repair invented and dropped nothing — the runtime gate on BOTH repair tiers.
 *
 * - Nothing invented: every string leaf, object key and number of the repaired value appears in the original
 *   (strings compared on {@link fidelityKeyOf}, numbers as numeric tokens).
 * - Nothing dropped: at least {@link LLM_REPLY_REPAIR_MIN_COVERAGE} of the original's content literals (string literals
 *   of ≥ {@link LLM_REPLY_REPAIR_CONTENT_LITERAL_MIN_CHARS} chars, taken from the `lever` region when the original is an
 *   envelope) appear in the repaired value.
 *
 * @param config - The original reply text and the repaired value.
 * @returns The fidelity verdict.
 */
export function llmReplyRepairFidelity(config: LlmReplyRepairFidelityConfig): LlmReplyRepairFidelity {
  const { original, repaired } = config;
  const strings: string[] = [];
  const numbers: number[] = [];
  collectLeaves(repaired, strings, numbers);

  const originalKey = fidelityKeyOf(decodeJsonEscapes(original));
  // Both signs of every numeric token: `"id-643"` must still vouch for a `643` the repair kept.
  const originalNumbers = new Set((original.match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? []).flatMap((token) => [Number(token), Math.abs(Number(token))]));
  const invented: string[] = [];

  strings.forEach((leaf) => {
    const key = fidelityKeyOf(leaf);

    if (key !== '' && !originalKey.includes(key) && invented.length < 8) {
      invented.push(leaf);
    }
  });
  numbers.forEach((leaf) => {
    if (!originalNumbers.has(leaf) && invented.length < 8) {
      invented.push(String(leaf));
    }
  });

  const leverKey = /"lever"\s*:/.exec(original);
  const region = leverKey == null ? original : original.slice(leverKey.index + leverKey[0].length);
  const repairedKey = strings.map(fidelityKeyOf).join('\u0001');
  let checked = 0;
  let covered = 0;

  for (const literal of region.matchAll(/"((?:[^"\\]|\\[\s\S])*)"/g)) {
    const decoded = decodeJsonEscapes(literal[1]);
    const key = fidelityKeyOf(decoded);

    if (decoded.length >= LLM_REPLY_REPAIR_CONTENT_LITERAL_MIN_CHARS && key !== '') {
      checked += 1;
      covered += repairedKey.includes(key) ? 1 : 0;
    }
  }

  const coverage = checked === 0 ? 1 : covered / checked;
  return { ok: invented.length === 0 && coverage >= LLM_REPLY_REPAIR_MIN_COVERAGE, invented, coverage, checked };
}

/**
 * The plain-words reading of a fault kind, for the fixer's one-line diagnosis.
 */
const FAULT_DIAGNOSIS: Readonly<Record<LlmReplyJsonFaultKind, string>> = {
  unclosed: 'the object ends with containers still open',
  'trailing-comma': 'a trailing comma sits before a closing bracket',
  'missing-comma': 'a comma is missing between two members',
  'mismatched-closer': 'a closing bracket does not match its opener',
  'stray-closer': 'a closing bracket has no opener',
  'control-in-string': 'a raw control character sits inside a string',
  'inner-quote': 'an unescaped quote sits inside a string',
  'trailing-prose': 'non-JSON text follows the object',
  'ends-in-string': 'the reply ends inside a string',
  dangling: 'the reply ends before a value',
  unexpected: 'an unexpected character appears where JSON syntax was expected'
};

/**
 * The fixer's one-line `[D]` diagnosis of a reply's shape — where parsing fails, and why.
 *
 * @param shape - The scorer's shape.
 * @returns One line.
 */
export function llmReplyRepairDiagnosis(shape: LlmReplyJsonShape): string {
  const decisive = shape.faults.find((fault) => fault.kind === 'unexpected') ?? shape.faults.find((fault) => !EOF_FAULT_KINDS.has(fault.kind)) ?? shape.faults[0];
  const open = shape.unclosed.length;
  const containerNote = open === 1 ? 'container is' : 'containers are';
  const openNote = open === 0 ? '' : `; ${open} ${containerNote} still open there`;
  return decisive == null ? `The reply of ${shape.length} characters does not parse as JSON.` : `Parsing fails at character ${Math.min(decisive.at + 1, shape.length)} of ${shape.length}: ${FAULT_DIAGNOSIS[decisive.kind]}${openNote}.`;
}
