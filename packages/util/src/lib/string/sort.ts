import { type SortCompareFunction } from '../sort';
import { type ReadStringFunction } from './string';

/**
 * SortCompareFunction by string.
 */
export type SortByStringFunction<T> = SortCompareFunction<T>;

/**
 * Pre-configured comparator that sorts strings in ascending alphabetical order using `localeCompare`.
 *
 * Use this directly with `Array.sort()` / `Array.toSorted()` instead of inlining
 * `(a, b) => a.localeCompare(b)` everywhere, and to satisfy the no-default-sort
 * lint rule for string arrays.
 *
 * The order follows the host's ICU locale, so two hosts can order the same strings differently
 * (case, accents, punctuation). When the order feeds bytes that must match across hosts — a prompt,
 * a persisted row, a cache key — use {@link compareStringsByCodeUnit} instead.
 *
 * @param a - The first string to compare.
 * @param b - The second string to compare.
 * @returns A negative number when `a` sorts before `b`, positive when after, `0` when equal.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilKind const
 * @dbxUtilTags string, sort, compare, alphabetical, locale
 * @dbxUtilRelated compare-strings-numeric, compare-strings-by-code-unit, sort-by-string-function
 *
 * @example
 * ```ts
 * ['b', 'a', 'c'].sort(compareStrings); // ['a', 'b', 'c']
 * ```
 */
export const compareStrings: SortByStringFunction<string> = (a, b) => a.localeCompare(b);

/**
 * Pre-configured comparator that sorts strings in ascending UTF-16 code-unit order (the `<` / `>` order),
 * never a locale.
 *
 * The result is the same on every host and runtime, so use it whenever the order feeds bytes that must
 * be deterministic: prompt text, a cache prefix, a persisted or rendered row, a file order. Uppercase
 * sorts before lowercase, and accented letters sort after every ASCII letter.
 *
 * @param a - The first string to compare.
 * @param b - The second string to compare.
 * @returns `-1` when `a` sorts before `b`, `1` when after, `0` when equal.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilKind const
 * @dbxUtilTags string, sort, compare, code-unit, ordinal, deterministic
 * @dbxUtilRelated compare-strings
 *
 * @example
 * ```ts
 * ['b', 'B', 'a'].sort(compareStringsByCodeUnit); // ['B', 'a', 'b']
 * ```
 */
export const compareStringsByCodeUnit: SortByStringFunction<string> = (a, b) => Number(a > b) - Number(a < b);

/**
 * Pre-configured comparator that sorts strings in ascending order using `localeCompare`
 * with the `numeric` collation option enabled, so numeric substrings are compared by value
 * (e.g. `"2"` sorts before `"10"`).
 *
 * @param a - The first string to compare.
 * @param b - The second string to compare.
 * @returns A negative number when `a` sorts before `b`, positive when after, `0` when equal.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilKind const
 * @dbxUtilTags string, sort, compare, numeric, natural, locale
 * @dbxUtilRelated compare-strings, sort-by-string-function
 *
 * @example
 * ```ts
 * ['10', '2', '1'].sort(compareStringsNumeric); // ['1', '2', '10']
 * ```
 */
export const compareStringsNumeric: SortByStringFunction<string> = (a, b) => a.localeCompare(b, undefined, { numeric: true });

/**
 * Creates a {@link SortByStringFunction} that sorts values in ascending alphabetical order using `localeCompare`.
 *
 * @param readStringFn - Function to extract a string from each value for comparison.
 * @returns A comparator function suitable for use with `Array.sort()`.
 *
 * @dbxUtil
 * @dbxUtilCategory string
 * @dbxUtilKind factory
 * @dbxUtilTags string, sort, compare, alphabetical, factory, locale
 * @dbxUtilRelated sort-by-label-function, compare-strings
 *
 * @__NO_SIDE_EFFECTS__
 */
export function sortByStringFunction<T>(readStringFn: ReadStringFunction<T>): SortByStringFunction<T> {
  return (a: T, b: T) => {
    const as = readStringFn(a);
    const bs = readStringFn(b);
    return as.localeCompare(bs);
  };
}

// MARK: Configured
/**
 * Input type for objects that can be sorted by their `label` property.
 */
export interface SortByLabelInput {
  label: string;
}

/**
 * Pre-configured sort comparator that sorts objects by their `label` property in ascending alphabetical order.
 */
export const sortByLabelFunction: SortByStringFunction<SortByLabelInput> = sortByStringFunction((x) => x.label);
