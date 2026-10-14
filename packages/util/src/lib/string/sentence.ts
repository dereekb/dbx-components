import { type Maybe } from '../value/maybe.type';
import { normalizeLineBreaks } from './string';

/**
 * Default text appended by {@link firstSentence} when the sentence is cut to fit `maxLength`.
 */
export const DEFAULT_FIRST_SENTENCE_END_TEXT = '…';

/**
 * Configuration for {@link firstSentence}.
 */
export interface FirstSentenceConfig {
  /**
   * Maximum length of the returned text, including `endText`. A longer sentence is cut at the last word boundary that fits.
   */
  readonly maxLength?: Maybe<number>;
  /**
   * Text appended when the sentence is cut.
   *
   * Defaults to {@link DEFAULT_FIRST_SENTENCE_END_TEXT}.
   */
  readonly endText?: Maybe<string>;
}

/**
 * Abbreviations whose trailing period never ends a sentence.
 */
const FIRST_SENTENCE_NON_TERMINAL_ABBREVIATIONS = new Set(['e.g', 'i.e', 'cf', 'vs']);

/**
 * Matches a sentence terminator (`.`, `!` or `?`) plus optional closing quotes/brackets.
 */
const FIRST_SENTENCE_TERMINATOR_REGEX = /[.!?]["')\]]*/g;

/**
 * Returns the first sentence of the first paragraph of the input.
 *
 * - The first paragraph ends at the first blank line.
 * - Soft line breaks and runs of whitespace are collapsed to single spaces.
 * - A sentence ends at `.`, `!` or `?` (plus optional closing `"`, `'`, `)` or `]`) followed by the end of the text, or by whitespace and a character that is not a lowercase letter.
 * - A period after `e.g`, `i.e`, `cf` or `vs` never ends a sentence.
 * - With no terminator, the whole flattened paragraph is returned.
 * - When `maxLength` is set and exceeded, the text is cut at the last space that fits and `endText` is appended.
 *
 * @param input - The text to read, typically a JSDoc description.
 * @param config - Optional length cap and end text.
 * @returns The first sentence, flattened to a single line.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilTags sentence, summary, first-line, truncate, paragraph, description
 * @dbxUtilRelated js-doc-inline-links-to-text
 *
 * @example
 * ```ts
 * firstSentence('Creates the\nthing for the user. Then more.');
 * // 'Creates the thing for the user.'
 * ```
 */
export function firstSentence(input: string, config?: Maybe<FirstSentenceConfig>): string {
  const normalized = normalizeLineBreaks(input).trim();
  const paragraph = normalized.split(/\n[ \t]*\n/)[0];
  const flattened = paragraph.replaceAll(/\s+/g, ' ').trim();

  let sentence = flattened;

  for (const match of flattened.matchAll(FIRST_SENTENCE_TERMINATOR_REGEX)) {
    const index = match.index;
    const end = index + match[0].length;

    if (isFirstSentenceBoundary(flattened, index, end)) {
      sentence = flattened.slice(0, end);
      break;
    }
  }

  const maxLength = config?.maxLength;
  let result = sentence;

  if (maxLength != null && sentence.length > maxLength) {
    const endText = config?.endText ?? DEFAULT_FIRST_SENTENCE_END_TEXT;
    const available = Math.max(0, maxLength - endText.length);
    const lastSpace = sentence.lastIndexOf(' ', available);
    const cutAt = lastSpace > 0 ? lastSpace : available;
    result = `${sentence.slice(0, cutAt).trimEnd()}${endText}`;
  }

  return result;
}

function isFirstSentenceBoundary(text: string, index: number, end: number): boolean {
  let boundary: boolean;

  if (end >= text.length) {
    boundary = true;
  } else if (text[end] === ' ') {
    const next = text[end + 1];
    const nextIsLowercase = next != null && next !== next.toUpperCase() && next === next.toLowerCase();

    if (nextIsLowercase) {
      boundary = false;
    } else if (text[index] === '.') {
      const precedingWord = text.slice(0, index).split(' ').pop() ?? '';
      boundary = !FIRST_SENTENCE_NON_TERMINAL_ABBREVIATIONS.has(precedingWord.toLowerCase());
    } else {
      boundary = true;
    }
  } else {
    boundary = false;
  }

  return boundary;
}
