/**
 * Matches text that is exactly one markdown code fence: an opening fence with any info string, the body, an optional
 * newline, then the closing fence. Tolerates CRLF line endings.
 */
const MARKDOWN_CODE_FENCE_REGEX = /^```[^\r\n]*\r?\n([\s\S]*?)(?:\r?\n)?```$/;

/**
 * Removes one wrapping markdown code fence from text, such as a model reply wrapped in ```` ```json ```` despite being
 * asked for bare output.
 *
 * When the TRIMMED text is exactly one fenced block, returns its body (not trimmed). Any info string is allowed after the
 * opening fence (` ```json5 `, ` ```ts title="x" `), and the newline before the closing fence is optional. Otherwise
 * returns `text` unchanged (not trimmed).
 *
 * @param text - The text that may be wrapped in a code fence.
 * @returns The fenced body, or the input unchanged.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilTags markdown, code, fence, strip, unwrap, json, llm, reply
 * @dbxUtilRelated cut-string
 *
 * @example
 * ```ts
 * stripMarkdownCodeFence('```json\n{"a":1}\n```'); // '{"a":1}'
 * stripMarkdownCodeFence('plain text'); // 'plain text'
 * ```
 */
export function stripMarkdownCodeFence(text: string): string {
  const fenced = MARKDOWN_CODE_FENCE_REGEX.exec(text.trim());
  return fenced == null ? text : fenced[1];
}
