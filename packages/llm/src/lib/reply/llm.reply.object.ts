/**
 * The reply readers' object guard. Internal: `reply/index.ts` does not re-export this module, so it is not part of the
 * package surface; the envelope reader imports it by path.
 */

/**
 * Whether a value is a non-null object (the value / envelope guard). Arrays pass too.
 *
 * @param value - The value to test.
 * @returns `true` when it is a non-null object.
 */
export function isLlmReplyObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}
