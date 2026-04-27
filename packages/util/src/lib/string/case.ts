/**
 * Pure string-case converters that do not pull in the
 * {@link change-case-all} dependency.
 *
 * Use these for the common SCREAMING_SNAKE ↔ camelCase conversions
 * (constant-name ↔ symbol-name flips) without paying for the full
 * change-case bundle. For arbitrary case detection / round-tripping
 * across mixed inputs, prefer the dedicated package.
 */

/**
 * Converts a SCREAMING_SNAKE_CASE string into camelCase.
 *
 * Empty segments (e.g. leading underscores in `_USER_ID`) are skipped.
 *
 * @param input The SCREAMING_SNAKE_CASE input.
 * @returns The camelCase form.
 */
export function screamingSnakeToCamelCase(input: string): string {
  const parts = input.split('_').filter((p) => p.length > 0);
  let result = '';
  for (const [i, part_] of parts.entries()) {
    const part = part_.toLowerCase();
    if (i === 0) {
      result += part;
    } else {
      result += part.charAt(0).toUpperCase() + part.slice(1);
    }
  }
  return result;
}

/**
 * Converts a camelCase or PascalCase string into SCREAMING_SNAKE_CASE.
 *
 * Each upper-case character (other than the first) is preceded by an
 * underscore, then the whole result is upper-cased.
 *
 * @param input The camelCase / PascalCase input.
 * @returns The SCREAMING_SNAKE_CASE form.
 */
export function camelOrPascalToScreamingSnake(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charAt(i);
    const isUpper = ch >= 'A' && ch <= 'Z';
    if (isUpper && i > 0) {
      out += '_';
    }
    out += ch.toUpperCase();
  }
  return out;
}
