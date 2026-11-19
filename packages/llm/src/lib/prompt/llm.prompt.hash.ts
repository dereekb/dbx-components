/**
 * The short prompt hash — the 16-hex-char `@dereekb/util` `sha256HexPrefix` a call record stores in place of prompt bytes (census
 * rows, supplement rows, cache-prefix hashes). Tape keys use a different, 12-char prefix.
 */

import { type HexString, sha256HexPrefix } from '@dereekb/util';

/**
 * The length of a recorded prompt hash, in hex characters.
 */
export const LLM_PROMPT_CACHE_HASH_LENGTH = 16;

/**
 * Hash a string of prompt bytes to the recorded short digest — the first {@link LLM_PROMPT_CACHE_HASH_LENGTH} hex
 * characters of its SHA-256.
 *
 * @param text - The bytes.
 * @returns The truncated lowercase hex digest.
 *
 * @example
 * ```ts
 * llmPromptCacheHash('abc'); // 'ba7816bf8f01cfea'
 * ```
 */
export function llmPromptCacheHash(text: string): HexString {
  return sha256HexPrefix(text, LLM_PROMPT_CACHE_HASH_LENGTH);
}
