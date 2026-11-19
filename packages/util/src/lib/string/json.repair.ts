/**
 * The deterministic JSON-object repair tier — decide how JSON-like a malformed text is ({@link scoreJsonObjectText}), fix
 * the shape slips that need no judgment ({@link repairJsonObjectText}), and prove a repair invented and dropped nothing
 * ({@link checkJsonRepairFidelity}). Pure: no I/O. Built for model replies that should have been one JSON object.
 *
 * ONE LENIENT WALK. A string-aware tokenizer carries a container stack and an EXPECT state, records every fault with
 * its index, and rebuilds the text as it goes, applying a recovery op wherever one exists. The score, the verdict and
 * the repair all derive from that one walk. Pass 2 re-walks with the inner-quote heuristic only when pass 1 could not
 * produce a parseable object.
 *
 * WHAT IS NEVER REPAIRED. A text that ends INSIDE a string, or right after a `:`, a `,`, a bare key or an opener, is
 * `truncated-looking`: that is the signature of cut content, and no tier may invent the end of a value. Python
 * literals, unquoted keys, comments and single quotes are left to a judgment tier.
 */

import { isPlainObject } from '../object/object';
import { type Maybe } from '../value/maybe.type';
import { parseJsonObjectOrUndefined, scanJsonStringLiteral } from './json';
import { escapeStringForRegex } from './replace';

/**
 * The scorer's verdict on one text.
 *
 * - `near-miss` — every fault is one the deterministic tier recovers, the rebuilt text parses into an object, and the
 *   repair is faithful.
 * - `mangled` — object-led, not truncated-looking, but some fault needs judgment (or the rebuilt text failed parse /
 *   fidelity).
 * - `truncated-looking` — ends inside a string, or right after `:` / `,` / a bare key / an opener. Never repaired.
 * - `not-json` — no `{`, not object-led, or less than a fifth of the object reads as JSON.
 */
export type JsonRepairVerdict = 'near-miss' | 'mangled' | 'truncated-looking' | 'not-json';

/**
 * One kind of structural fault the scorer's walk found.
 */
export type JsonRepairFaultKind = 'unclosed' | 'trailing-comma' | 'missing-comma' | 'mismatched-closer' | 'stray-closer' | 'control-in-string' | 'inner-quote' | 'trailing-prose' | 'ends-in-string' | 'dangling' | 'unexpected';

/**
 * One recorded fault — its kind and the index in the ORIGINAL text it was found at.
 */
export interface JsonRepairFault {
  /**
   * The fault's kind.
   */
  readonly kind: JsonRepairFaultKind;
  /**
   * The index in the original text the fault was found at.
   */
  readonly at: number;
}

/**
 * The scorer's reading of one text.
 */
export interface JsonRepairShape {
  /**
   * The verdict ({@link JsonRepairVerdict}).
   */
  readonly verdict: JsonRepairVerdict;
  /**
   * The fraction of the object text (first `{` → trimmed end) that is valid JSON before the FIRST structural fault.
   * A text whose only fault is stopping with containers open scores 1.
   */
  readonly score: number;
  /**
   * Whether the first non-whitespace character (after one optional leading code-fence line) is `{`.
   */
  readonly objectLed: boolean;
  /**
   * The index of the object's opening `{`, `-1` when there is none.
   */
  readonly objectStart: number;
  /**
   * The index of the first structural fault (excluding the end-of-input faults), when there is one.
   */
  readonly faultAt?: number;
  /**
   * The recorded faults, in order (capped at {@link JSON_REPAIR_MAX_RECORDED_FAULTS}).
   */
  readonly faults: ReadonlyArray<JsonRepairFault>;
  /**
   * The open-container stack where the walk ended, e.g. `'{'` — `''` when balanced.
   */
  readonly unclosed: string;
  /**
   * The text length (UTF-16 code units).
   */
  readonly length: number;
}

/**
 * One deterministic recovery op.
 */
export type JsonRepairOpKind = 'close-object' | 'close-array' | 'drop-trailing-comma' | 'insert-missing-comma' | 'insert-missing-closer' | 'drop-stray-closer' | 'escape-control' | 'escape-inner-quote' | 'strip-trailing-prose' | 'strip-code-fence';

/**
 * The ops a repair applied, counted by kind.
 */
export type JsonRepairOpCounts = Readonly<Partial<Record<JsonRepairOpKind, number>>>;

/**
 * A deterministic repair's product.
 */
export interface JsonRepairProduct {
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
  readonly ops: JsonRepairOpCounts;
  /**
   * Which pass produced it — pass 2 is the inner-quote re-walk.
   */
  readonly pass: 1 | 2;
}

/**
 * The result of {@link repairJsonObjectText} — the shape, plus the repair iff the verdict is `near-miss`.
 */
export interface JsonRepairResult {
  /**
   * The scorer's shape of the text.
   */
  readonly shape: JsonRepairShape;
  /**
   * The repair, present iff the verdict is `near-miss`.
   */
  readonly repaired?: JsonRepairProduct;
}

/**
 * The fidelity verdict of one repair.
 */
export interface JsonRepairFidelity {
  /**
   * Nothing invented AND coverage ≥ {@link JSON_REPAIR_MIN_COVERAGE}.
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
 * Optional settings for {@link repairJsonObjectText} and {@link scoreJsonObjectText}.
 */
export interface RepairJsonObjectTextConfig {
  /**
   * Start the fidelity coverage check at the first `"<key>":` in the original (the region then runs to the end of the
   * text). Unset ⇒ the whole text is checked.
   */
  readonly coverageFromKey?: Maybe<string>;
}

/**
 * The input of {@link checkJsonRepairFidelity}.
 */
export interface CheckJsonRepairFidelityConfig extends RepairJsonObjectTextConfig {
  /**
   * The original text.
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
export const JSON_REPAIR_MIN_COVERAGE = 0.9;

/**
 * The shortest string literal the coverage check counts as CONTENT (shorter ones are ids / enum values / keys).
 */
export const JSON_REPAIR_CONTENT_LITERAL_MIN_CHARS = 12;

/**
 * The most faults one shape records (the op counts are never capped).
 */
export const JSON_REPAIR_MAX_RECORDED_FAULTS = 32;

/**
 * Below this score a malformed object-led text reads as `not-json`.
 */
export const JSON_REPAIR_NOT_JSON_MAX_SCORE = 0.2;

/**
 * The faults that sit at EOF and so do not count against the score.
 */
export const JSON_REPAIR_EOF_FAULT_KINDS: ReadonlySet<JsonRepairFaultKind> = new Set<JsonRepairFaultKind>(['unclosed', 'ends-in-string', 'dangling']);

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
interface JsonRepairWalk {
  readonly out: string;
  readonly ops: JsonRepairOpCounts;
  readonly faults: ReadonlyArray<JsonRepairFault>;
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
 * Whether the `"` at `quoteIndex` is an INNER quote (pass 2) — the next non-whitespace character cannot follow a
 * string close (`,` `:` `}` `]` `"` or EOF can).
 *
 * @param text - The text.
 * @param quoteIndex - The index of the quote.
 * @returns True when the quote is inside the string.
 */
function isInnerQuote(text: string, quoteIndex: number): boolean {
  let index = quoteIndex + 1;

  while (index < text.length && /\s/.test(text[index])) {
    index += 1;
  }

  return index < text.length && !',:}]"'.includes(text[index]);
}

/**
 * The escape that replaces one raw control character inside a string.
 *
 * @param character - The raw control character.
 * @returns Its JSON escape.
 */
function escapeControlCharacter(character: string): string {
  return CONTROL_ESCAPE[character] ?? String.raw`\u${(character.codePointAt(0) ?? 0).toString(16).padStart(4, '0')}`;
}

/**
 * Walk one text from its opening `{`, rebuilding it with every recoverable fault fixed.
 *
 * @param text - The text.
 * @param start - The index of the opening `{`.
 * @param innerQuotes - Pass 2: treat a `"` that cannot close a string as an inner quote.
 * @returns The walk's product.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity -- one string-aware state machine; splitting it scatters one walk's state across closures
function walkJsonObjectText(text: string, start: number, innerQuotes: boolean): JsonRepairWalk {
  const stack: Array<'{' | '['> = [];
  const ops: Partial<Record<JsonRepairOpKind, number>> = {};
  const faults: JsonRepairFault[] = [];
  let out = '';
  let expect: WalkExpect = 'value';
  let index = start;
  let end: WalkEnd | undefined;
  // The OUT index of the last real comma, so a trailing one can be cut back out.
  let lastCommaOut = -1;

  const countOp = (kind: JsonRepairOpKind, by: number = 1): void => {
    ops[kind] = (ops[kind] ?? 0) + by;
  };
  const recordFault = (kind: JsonRepairFaultKind, at: number): void => {
    if (faults.length < JSON_REPAIR_MAX_RECORDED_FAULTS) {
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
    const scan = scanJsonStringLiteral({ text, start: at, isInnerQuote: innerQuotes ? isInnerQuote : undefined });
    let built = '';
    let from = at;

    // Every issue is recorded in text order, whether or not the literal closed.
    scan.issues.forEach((issue) => {
      if (issue.kind === 'control-character') {
        recordFault('control-in-string', issue.at);
        countOp('escape-control');
        built += text.slice(from, issue.at) + escapeControlCharacter(text[issue.at]);
      } else {
        recordFault('inner-quote', issue.at);
        countOp('escape-inner-quote');
        built += text.slice(from, issue.at) + String.raw`\"`;
      }

      from = issue.at + 1;
    });

    built += text.slice(from, scan.end);
    return { closed: scan.closed, text: built, next: scan.end };
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
 * Whether a text's tail reads as CUT content by a plain string-aware scan — EOF inside a string, or the last
 * significant character a `:` / `,`. The fallback truncation test for a walk that stopped at an earlier fault.
 *
 * @param text - The text.
 * @param start - The index of the opening `{`.
 * @returns True when the tail looks truncated.
 */
function endsLikeTruncation(text: string, start: number): boolean {
  let index = start;
  let unclosed = false;
  let last = '';

  while (!unclosed && index < text.length) {
    const character = text[index];

    if (character === '"') {
      const scan = scanJsonStringLiteral({ text, start: index });
      unclosed = !scan.closed;
      last = '"';
      index = scan.end;
    } else {
      if (!/\s/.test(character)) {
        last = character;
      }

      index += 1;
    }
  }

  return unclosed || last === ':' || last === ',';
}

/**
 * The score of one walk — the fraction of the object text before its first non-EOF fault.
 *
 * @param text - The text.
 * @param start - The index of the opening `{`.
 * @param faults - The walk's faults.
 * @returns The score and the first fault's index.
 */
function scoreOfWalk(text: string, start: number, faults: ReadonlyArray<JsonRepairFault>): { readonly score: number; readonly faultAt?: number } {
  const first = faults.find((fault) => !JSON_REPAIR_EOF_FAULT_KINDS.has(fault.kind));
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
 * Where a text's object starts, and whether the text LEADS with it (after one optional leading fence line).
 *
 * @param text - The text.
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
 * The verdict of one object-bearing text.
 *
 * @param facts - Whether it is object-led, repaired and truncated-looking, and its score.
 * @returns The verdict.
 */
function repairVerdictOf(facts: RepairVerdictFacts): JsonRepairVerdict {
  let verdict: JsonRepairVerdict;

  if (!facts.objectLed) {
    verdict = 'not-json';
  } else if (facts.repaired) {
    verdict = 'near-miss';
  } else if (facts.truncated) {
    verdict = 'truncated-looking';
  } else if (facts.score < JSON_REPAIR_NOT_JSON_MAX_SCORE) {
    verdict = 'not-json';
  } else {
    verdict = 'mangled';
  }

  return verdict;
}

/**
 * Scores a text that should have been one JSON object and, when it is a near miss, repairs it.
 *
 * The repair fixes only slips that need no judgment: containers left open at EOF, trailing and missing commas, a missing or
 * stray closer, raw control characters in strings, inner quotes (second pass), and a code fence or prose around the object.
 * A repair is kept only when {@link checkJsonRepairFidelity} proves it invented and dropped nothing. A text that looks cut
 * off is never repaired. A rebuilt text that does not parse is reported through the verdict, never thrown.
 *
 * @param text - The text that should hold one JSON object.
 * @param config - Optional settings; `coverageFromKey` limits the fidelity coverage region.
 * @returns The shape, plus the repair iff the verdict is `near-miss`.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilTags json, repair, lenient, fix, object, llm, reply, parse
 * @dbxUtilRelated score-json-object-text, check-json-repair-fidelity, repair-json-object-or-undefined
 *
 * @example
 * ```ts
 * repairJsonObjectText('{"a":1,"b":[1,2,],}').repaired?.value; // { a: 1, b: [1, 2] }
 * repairJsonObjectText('{"a":"cut').shape.verdict; // 'truncated-looking'
 * ```
 */
export function repairJsonObjectText(text: string, config?: Maybe<RepairJsonObjectTextConfig>): JsonRepairResult {
  const coverageFromKey = config?.coverageFromKey;
  const { objectStart, objectLed, fenced } = objectLeadOf(text);
  let result: JsonRepairResult;

  if (objectStart < 0) {
    result = { shape: { verdict: 'not-json', score: 0, objectLed: false, objectStart, faults: [], unclosed: '', length: text.length } };
  } else {
    const first = walkJsonObjectText(text, objectStart, false);
    const firstRecoverable = first.end === 'closed' || first.end === 'eof';
    const firstValue = objectLed && firstRecoverable ? parseJsonObjectOrUndefined(first.out) : undefined;
    const firstFaithful = firstValue != null && checkJsonRepairFidelity({ original: text, repaired: firstValue, coverageFromKey }).ok;
    // Pass 2 only when pass 1 did not produce a faithful object, and never over a pass-1 truncation.
    const second = objectLed && !firstFaithful && first.end !== 'truncated' ? walkJsonObjectText(text, objectStart, true) : undefined;
    const secondValue = second != null && (second.end === 'closed' || second.end === 'eof') ? parseJsonObjectOrUndefined(second.out) : undefined;
    const secondFaithful = secondValue != null && checkJsonRepairFidelity({ original: text, repaired: secondValue, coverageFromKey }).ok;
    const winner = !firstFaithful && secondFaithful ? second : first;
    const { score, faultAt } = scoreOfWalk(text, objectStart, winner?.faults ?? first.faults);
    const truncated = first.end === 'truncated' || (first.end === 'fault' && (second?.end === 'truncated' || endsLikeTruncation(text, objectStart)));
    const repairedValue = repairedValueOf({ firstFaithful, firstValue, secondFaithful, secondValue });
    const verdict = repairVerdictOf({ objectLed, repaired: repairedValue != null, truncated, score });
    const shape: JsonRepairShape = { verdict, score, objectLed, objectStart, ...(faultAt == null ? {} : { faultAt }), faults: (winner ?? first).faults, unclosed: (winner ?? first).unclosed, length: text.length };

    if (repairedValue != null && winner != null) {
      const ops: Partial<Record<JsonRepairOpKind, number>> = { ...winner.ops };

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
 * Scores a text that should have been one JSON object, without keeping the repair.
 *
 * @param text - The text that should hold one JSON object.
 * @param config - Optional settings; `coverageFromKey` limits the fidelity coverage region.
 * @returns The shape {@link repairJsonObjectText} computes.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilTags json, repair, score, verdict, lenient, object, llm, reply
 * @dbxUtilRelated repair-json-object-text
 *
 * @example
 * ```ts
 * scoreJsonObjectText('{"a":1,').verdict; // 'truncated-looking'
 * scoreJsonObjectText('no json here').verdict; // 'not-json'
 * ```
 */
export function scoreJsonObjectText(text: string, config?: Maybe<RepairJsonObjectTextConfig>): JsonRepairShape {
  return repairJsonObjectText(text, config).shape;
}

/**
 * Parses text into a JSON object, falling back to the deterministic repair when it does not parse.
 *
 * Valid object JSON returns its parsed value. Otherwise the repair's value is returned when the text is a faithful near miss,
 * and `undefined` when it is not. Its `(text) => value` shape lets it stand in wherever a plain JSON decoder is accepted, so
 * repair stays an explicit opt-in.
 *
 * @param text - The text that should hold one JSON object.
 * @param config - Optional repair settings.
 * @returns The parsed or repaired object, or `undefined`.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilTags json, repair, parse, lenient, object, decode, llm, reply
 * @dbxUtilRelated repair-json-object-text, parse-json-object-or-undefined
 *
 * @example
 * ```ts
 * repairJsonObjectOrUndefined('{"a":1'); // { a: 1 }
 * repairJsonObjectOrUndefined('{"a":"cut'); // undefined
 * ```
 */
export function repairJsonObjectOrUndefined(text: Maybe<string>, config?: Maybe<RepairJsonObjectTextConfig>): Maybe<Record<string, unknown>> {
  let value = parseJsonObjectOrUndefined(text);

  if (value == null && text) {
    value = repairJsonObjectText(text, config).repaired?.value;
  }

  return value;
}

/**
 * The JSON escapes a raw text may carry, decoded back to their characters.
 */
const JSON_ESCAPED_CHARACTER: Readonly<Record<string, string>> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };

/**
 * Decode the JSON escapes in raw text (`\n`, `\"`, `\uXXXX`, …) so it compares with parsed values.
 *
 * @param text - Raw text.
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
  } else if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, item]) => {
      strings.push(key);
      collectLeaves(item, strings, numbers);
    });
  }
}

/**
 * The region of the original text whose content literals the coverage check counts.
 *
 * @param original - The original text.
 * @param coverageFromKey - The key the region starts after, when set.
 * @returns The whole text, or the text after the first `"<key>":`.
 */
function coverageRegionOf(original: string, coverageFromKey: Maybe<string>): string {
  const keyMatch = coverageFromKey == null ? null : new RegExp(String.raw`"${escapeStringForRegex(coverageFromKey)}"\s*:`).exec(original);
  return keyMatch == null ? original : original.slice(keyMatch.index + keyMatch[0].length);
}

/**
 * Proves a repair invented and dropped nothing — the runtime gate on any repair of a JSON object text.
 *
 * - Nothing invented: every string leaf, object key and number of the repaired value appears in the original (strings
 *   compared with whitespace, quotes and backslashes removed; numbers as numeric tokens).
 * - Nothing dropped: at least {@link JSON_REPAIR_MIN_COVERAGE} of the original's content literals (string literals of at
 *   least {@link JSON_REPAIR_CONTENT_LITERAL_MIN_CHARS} characters, taken after `coverageFromKey` when it is set and found)
 *   appear in the repaired value.
 *
 * @param config - The original text, the repaired value, and the optional coverage key.
 * @returns The fidelity verdict.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilTags json, repair, fidelity, verify, coverage, llm, reply
 * @dbxUtilRelated repair-json-object-text
 *
 * @example
 * ```ts
 * checkJsonRepairFidelity({ original: '{"a":1', repaired: { a: 1 } }).ok; // true
 * checkJsonRepairFidelity({ original: '{"a":1', repaired: { a: 2 } }).invented; // ['2']
 * ```
 */
export function checkJsonRepairFidelity(config: CheckJsonRepairFidelityConfig): JsonRepairFidelity {
  const { original, repaired, coverageFromKey } = config;
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

  const region = coverageRegionOf(original, coverageFromKey);
  const repairedKey = strings.map(fidelityKeyOf).join('\u0001');
  let checked = 0;
  let covered = 0;

  for (const literal of region.matchAll(/"((?:[^"\\]|\\[\s\S])*)"/g)) {
    const decoded = decodeJsonEscapes(literal[1]);
    const key = fidelityKeyOf(decoded);

    if (decoded.length >= JSON_REPAIR_CONTENT_LITERAL_MIN_CHARS && key !== '') {
      checked += 1;
      covered += repairedKey.includes(key) ? 1 : 0;
    }
  }

  const coverage = checked === 0 ? 1 : covered / checked;
  return { ok: invented.length === 0 && coverage >= JSON_REPAIR_MIN_COVERAGE, invented, coverage, checked };
}
