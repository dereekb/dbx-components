/**
 * Literal, order-sensitive token substitution — the in-process replacement for
 * the chained `sed -e "s:TOKEN:value:g"` calls in `setup-project.sh`.
 *
 * Each token is applied as a global literal string replace (not a regex), in
 * the order given, exactly mirroring how the script chains its `-e` expressions.
 */

import { type SetupToken } from './tokens.js';

/**
 * Applies an ordered list of literal token replacements to file content.
 *
 * @param content - The template file content.
 * @param tokens - Ordered tokens; each `search` is replaced globally (literal, not regex) by its `replace`.
 * @returns The substituted content.
 */
export function applyTokens(content: string, tokens: readonly SetupToken[]): string {
  let result = content;
  for (const token of tokens) {
    result = result.replaceAll(token.search, token.replace);
  }
  return result;
}
