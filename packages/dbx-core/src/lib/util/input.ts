/**
 * Transforms an empty string to undefined.
 *
 * Used for Angular inputs that are optional and share the same alias as the directive.
 */
export const transformEmptyStringInputToUndefined = <T>(value: T | '') => (value === '' ? undefined : value);
