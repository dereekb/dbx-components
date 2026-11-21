import { isPlainObject } from '../object/object';
import { type Maybe } from '../value/maybe.type';

/**
 * A json encoded string.
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-util:encoding
 */
export type JSONEncodedString = string;

/**
 * The outcome of one guarded `JSON.parse`.
 */
interface JsonParseAttempt {
  readonly value: unknown;
  readonly failed: boolean;
  readonly error?: unknown;
}

/**
 * Runs `JSON.parse` and keeps the failure instead of throwing it.
 *
 * @param text - The candidate JSON text.
 * @returns The parsed value, or the failure.
 */
function attemptJsonParse(text: string): JsonParseAttempt {
  let attempt: JsonParseAttempt;

  try {
    attempt = { value: JSON.parse(text), failed: false };
  } catch (error) {
    attempt = { value: undefined, failed: true, error };
  }

  return attempt;
}

/**
 * Parses JSON text, returning `undefined` instead of throwing when the text is not JSON.
 *
 * Empty, `null` and `undefined` input return `undefined`. A JSON `null` returns `null`. The value is not checked against `T`.
 *
 * @param text - The candidate JSON text.
 * @returns The parsed value, or `undefined` when the text is missing or not valid JSON.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilTags json, parse, safe, lenient, decode
 * @dbxUtilRelated parse-json-object-or-undefined, repair-json-object-or-undefined
 *
 * @example
 * ```ts
 * parseJsonOrUndefined<number[]>('[1,2]'); // [1, 2]
 * parseJsonOrUndefined('{"a":'); // undefined
 * ```
 */
export function parseJsonOrUndefined<T = unknown>(text: Maybe<string>): Maybe<T> {
  let value: Maybe<T>;

  if (text) {
    try {
      value = JSON.parse(text);
    } catch {
      value = undefined;
    }
  }

  return value;
}

/**
 * Parses JSON text into a plain object, returning `undefined` instead of throwing.
 *
 * Empty, `null`, `undefined` and malformed input return `undefined`, as does JSON that parses to an array, a primitive or `null`.
 *
 * @param text - The candidate JSON text.
 * @returns The parsed object, or `undefined` when the text is missing, malformed or not a JSON object.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilTags json, parse, safe, lenient, object, decode
 * @dbxUtilRelated parse-json-or-undefined, read-json-object-from-text
 *
 * @example
 * ```ts
 * parseJsonObjectOrUndefined('{"a":1}'); // { a: 1 }
 * parseJsonObjectOrUndefined('[1]'); // undefined
 * ```
 */
export function parseJsonObjectOrUndefined(text: Maybe<string>): Maybe<Record<string, unknown>> {
  const value: unknown = parseJsonOrUndefined(text);
  return isPlainObject(value) ? value : undefined;
}

/**
 * The kind of one issue found inside a JSON string literal: a raw control character, or an inner quote.
 */
export type JsonStringLiteralIssueKind = 'control-character' | 'inner-quote';

/**
 * One raw control character (code point below `0x20`) or one inner quote found inside a JSON string literal.
 */
export interface JsonStringLiteralIssue {
  /**
   * The issue's kind.
   */
  readonly kind: JsonStringLiteralIssueKind;
  /**
   * The index in the scanned text of the offending character.
   */
  readonly at: number;
}

/**
 * The result of {@link scanJsonStringLiteral}.
 */
export interface JsonStringLiteralScan {
  /**
   * Whether a closing quote was found.
   */
  readonly closed: boolean;
  /**
   * The index just past the closing quote, or the text length when the literal never closes.
   */
  readonly end: number;
  /**
   * The issues found inside the literal, in text order.
   */
  readonly issues: ReadonlyArray<JsonStringLiteralIssue>;
}

/**
 * Decides whether an unescaped `"` inside a string literal is an INNER quote (part of the string) rather than its close.
 */
export type JsonStringLiteralInnerQuoteFunction = (text: string, quoteIndex: number) => boolean;

/**
 * The input of {@link scanJsonStringLiteral}.
 */
export interface ScanJsonStringLiteralConfig {
  /**
   * The text holding the literal.
   */
  readonly text: string;
  /**
   * The index of the literal's opening `"`.
   */
  readonly start: number;
  /**
   * When given and true for an unescaped `"`, the quote is recorded as an `inner-quote` issue and the scan continues.
   */
  readonly isInnerQuote?: Maybe<JsonStringLiteralInnerQuoteFunction>;
}

/**
 * Scans one JSON string literal from its opening quote to its closing quote.
 *
 * A `\` skips the next character, so an escaped quote or an escaped control character is neither a close nor an issue. A `\`
 * as the last character leaves the literal unclosed. Raw control characters are recorded as issues and do not end the scan.
 *
 * @param config - The text, the index of the opening quote, and the optional inner-quote predicate.
 * @returns Whether the literal closed, where it ends, and the issues found inside it.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilTags json, string, literal, scan, quote, escape, lenient
 * @dbxUtilRelated slice-balanced-json-object
 *
 * @example
 * ```ts
 * scanJsonStringLiteral({ text: '{"a\\"b":1}', start: 1 }); // { closed: true, end: 7, issues: [] }
 * scanJsonStringLiteral({ text: '"cut', start: 0 }); // { closed: false, end: 4, issues: [] }
 * ```
 */
export function scanJsonStringLiteral(config: ScanJsonStringLiteralConfig): JsonStringLiteralScan {
  const { text, start, isInnerQuote } = config;
  const issues: JsonStringLiteralIssue[] = [];
  let cursor = start + 1;
  let closed = false;

  while (!closed && cursor < text.length) {
    const character = text[cursor];

    if (character === '\\') {
      cursor = cursor + 1 >= text.length ? text.length : cursor + 2;
    } else if (character === '"') {
      if (isInnerQuote?.(text, cursor)) {
        issues.push({ kind: 'inner-quote', at: cursor });
      } else {
        closed = true;
      }

      cursor += 1;
    } else {
      if ((character.codePointAt(0) ?? 0) < 0x20) {
        issues.push({ kind: 'control-character', at: cursor });
      }

      cursor += 1;
    }
  }

  return { closed, end: closed ? cursor : text.length, issues };
}

/**
 * Returns the balanced `{…}` slice that starts at an opening brace.
 *
 * Braces inside string literals do not count. Returns `undefined` when the object never closes; nothing here repairs a
 * missing brace.
 *
 * @param text - The text holding the object.
 * @param start - The index of the opening `{`.
 * @returns The balanced slice, or `undefined` when the object never closes.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilTags json, object, slice, balanced, brace, scan, lenient
 * @dbxUtilRelated scan-json-string-literal, read-json-object-from-text
 *
 * @example
 * ```ts
 * sliceBalancedJsonObject('x {"a":"}"} }', 2); // '{"a":"}"}'
 * sliceBalancedJsonObject('{"a":1', 0); // undefined
 * ```
 */
export function sliceBalancedJsonObject(text: string, start: number): Maybe<string> {
  let depth = 0;
  let end = -1;
  let index = start;

  while (end < 0 && index < text.length) {
    const character = text[index];

    if (character === '"') {
      index = scanJsonStringLiteral({ text, start: index }).end;
    } else {
      if (character === '{') {
        depth += 1;
      } else if (character === '}') {
        depth -= 1;
        end = depth === 0 ? index + 1 : end;
      }

      index += 1;
    }
  }

  return end < 0 ? undefined : text.slice(start, end);
}

/**
 * The result of {@link readJsonObjectFromText}.
 */
export interface JsonObjectInText {
  /**
   * Whether the text holds a `{` with a `}` somewhere after it.
   */
  readonly found: boolean;
  /**
   * The parsed object, absent when no candidate slice parsed into one.
   */
  readonly value?: Record<string, unknown>;
  /**
   * The first parse failure, present only when `found` is true and no candidate parsed.
   */
  readonly error?: unknown;
}

/**
 * Finds and parses the JSON object inside surrounding text, such as prose or a code fence around a model reply.
 *
 * The read is layered so the second pass only adds readings:
 *
 * 1. The greedy slice (first `{` to last `}`). When it parses to an object, that object wins.
 * 2. Otherwise each top-level `{…}` object in order (its balanced slice, then the next `{` after that slice). The first that
 *    parses to an object wins. An object that never closes ends the scan, because everything after it is nested inside it,
 *    so a truncated object never resolves to an inner object that happened to close.
 *
 * @param text - The text holding the object.
 * @returns Whether an object-like block was found, the parsed object, and the first parse failure when none parsed.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilTags json, object, parse, extract, lenient, prose, fence, llm, reply
 * @dbxUtilRelated slice-balanced-json-object, parse-json-object-or-undefined
 *
 * @example
 * ```ts
 * readJsonObjectFromText('Here: {"a":1}}'); // { found: true, value: { a: 1 } }
 * readJsonObjectFromText('{"a":'); // { found: false }
 * ```
 */
export function readJsonObjectFromText(text: string): JsonObjectInText {
  const greedy = /\{[\s\S]*\}/.exec(text);
  let error: unknown;
  let failed = false;
  let value: Maybe<Record<string, unknown>>;

  const parseCandidate = (candidate: string): Maybe<Record<string, unknown>> => {
    const attempt = attemptJsonParse(candidate);

    if (attempt.failed && !failed) {
      failed = true;
      error = attempt.error;
    }

    return isPlainObject(attempt.value) ? attempt.value : undefined;
  };

  if (greedy != null) {
    value = parseCandidate(greedy[0]);

    let index = value == null ? text.indexOf('{') : -1;

    while (index >= 0) {
      const slice = sliceBalancedJsonObject(text, index);
      value = slice == null ? undefined : parseCandidate(slice);
      index = value != null || slice == null ? -1 : text.indexOf('{', index + slice.length);
    }
  }

  return { found: greedy != null, ...(value == null ? {} : { value }), ...(greedy != null && value == null ? { error } : {}) };
}
