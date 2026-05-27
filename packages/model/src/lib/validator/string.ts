/**
 * A string with at least one character (non-empty).
 *
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind const
 * @dbxUtilTags validator, arktype, string, non-empty, required
 * @dbxUtilRelated email-string, non-empty-string-with-max-length
 *
 * @example
 * ```ts
 * type({ name: NON_EMPTY_STRING });
 * ```
 */
export const NON_EMPTY_STRING = 'string > 0' as const;

/**
 * A valid email address string.
 *
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind const
 * @dbxUtilTags validator, arktype, string, email
 *
 * @example
 * ```ts
 * type({ email: EMAIL_STRING });
 * ```
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
 * @dbxUtil
 * @dbxUtilCategory validator
 * @dbxUtilKind factory
 * @dbxUtilTags validator, arktype, string, non-empty, max-length, bounded
 * @dbxUtilRelated non-empty-string
 *
 * @example
 * ```ts
 * const userType = type({
 *   displayName: nonEmptyStringWithMaxLength(64)
 * });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function nonEmptyStringWithMaxLength<N extends number>(maxLength: N) {
  return `${NON_EMPTY_STRING} & string <= ${maxLength}` as const;
}
