/**
 * The fence a library capability wraps an UNTRUSTED block in inside its live context — the critic's reply under review
 * and its context, the fixer's broken reply — so the model can see where each block ends. Internal: not on the
 * capability barrel.
 */

/**
 * The fence around an untrusted reply — the critic's reply under review, the fixer's broken reply.
 */
export const LLM_CAPABILITY_REPLY_FENCE = 'REPLY';

/**
 * The fence around the critic's untrusted context.
 */
export const LLM_CAPABILITY_CONTEXT_FENCE = 'CONTEXT';

/**
 * **The one fenced block**: `<<<FENCE`, the text, then `FENCE` on its own line.
 *
 * @param fence - The fence word.
 * @param text - The untrusted text the fence wraps.
 * @returns The block's lines.
 *
 * @example
 * ```ts
 * llmFencedBlockLines(LLM_CAPABILITY_REPLY_FENCE, '{"a":1');
 * // ['<<<REPLY', '{"a":1', 'REPLY']
 * ```
 */
export function llmFencedBlockLines(fence: string, text: string): string[] {
  return [`<<<${fence}`, text, fence];
}
