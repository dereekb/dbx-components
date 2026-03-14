/**
 * A number encoded as a radix-36 string using digits 0-9 and letters a-z.
 *
 * Radix-36 encoding produces compact string representations of numbers,
 * useful for URL-safe identifiers and short codes.
 *
 * @example
 * ```ts
 * const encoded: Radix36EncodedNumber = 'z'; // represents 35
 * const largeEncoded: Radix36EncodedNumber = '2s'; // represents 100
 * ```
 */
export type Radix36EncodedNumber = string;

/**
 * Encodes a number as a radix-36 string.
 *
 * Uses digits 0-9 and lowercase letters a-z, producing compact representations
 * that are useful for URL-safe identifiers and short codes.
 *
 * @param number - The number to encode. Should be a non-negative integer for consistent results.
 * @returns The radix-36 encoded string representation.
 *
 * @example
 * ```ts
 * encodeRadix36Number(0);   // '0'
 * encodeRadix36Number(35);  // 'z'
 * encodeRadix36Number(100); // '2s'
 * ```
 */
export function encodeRadix36Number(number: number): Radix36EncodedNumber {
  return number.toString(36);
}

/**
 * Decodes a radix-36 encoded string back to a number.
 *
 * Parses a string containing digits 0-9 and letters a-z (case-insensitive)
 * as a base-36 number.
 *
 * @param encoded - The radix-36 encoded string to decode.
 * @returns The decoded numeric value. Returns `NaN` if the input is not a valid radix-36 string.
 *
 * @example
 * ```ts
 * decodeRadix36Number('0');  // 0
 * decodeRadix36Number('z');  // 35
 * decodeRadix36Number('2s'); // 100
 * ```
 */
export function decodeRadix36Number(encoded: Radix36EncodedNumber): number {
  return parseInt(encoded, 36);
}

// MARK: Hex
/**
 * A string containing only hexadecimal characters (0-9, a-f or A-F).
 */
export type HexString = string;

/**
 * Pattern that matches strings containing only hexadecimal characters (0-9, a-f, A-F).
 */
export const HEX_PATTERN = /^[0-9a-fA-F]+$/;

/**
 * Checks whether the input string contains only valid hexadecimal characters.
 *
 * @example
 * ```ts
 * isHex('a1b2c3'); // true
 * isHex('FF00AA'); // true
 * isHex('hello');  // false
 * isHex('');       // false
 * ```
 *
 * @param value - The string to check.
 * @returns True if the string is non-empty and contains only hex characters.
 */
export function isHex(value: string): value is HexString {
  return HEX_PATTERN.test(value);
}
