/**
 * A string with at least one character (non-empty).
 */
export const NON_EMPTY_STRING = 'string > 0' as const;

/**
 * A valid email address string.
 */
export const EMAIL_STRING = 'string.email' as const;

/**
 * Creates an ArkType string definition for a non-empty string with a maximum length.
 *
 * Composes {@link NON_EMPTY_STRING} with an upper-bound length constraint, producing a
 * DSL fragment that can be interpolated directly into an ArkType `type({ ... })` schema.
 *
 * @param maxLength - The maximum number of characters allowed (inclusive).
 * @returns The ArkType string definition.
 *
 * @example
 * ```ts
 * const userType = type({
 *   displayName: nonEmptyStringWithMaxLength(64)
 * });
 * ```
 */
export function nonEmptyStringWithMaxLength<N extends number>(maxLength: N) {
  return `${NON_EMPTY_STRING} & string <= ${maxLength}` as const;
}
