import { type ArrayOrValue, asArray, flattenArray } from './array';
import { unique, filterUniqueValues } from './array.unique';
import { type ReadKeyFunction } from '../key';
import { caseInsensitiveString } from '../string/string';
import { containsAllValues, containsAnyValue, hasDifferentValues } from '../set/set';
import { mapIterable } from '../iterable/iterable.map';
import { isMapIdentityFunction, mapArrayFunction, type MapFunction, mapIdentityFunction } from '../value/map';
import { stringToLowercaseFunction, stringToUppercaseFunction, stringTrimFunction, transformStringFunction, type TransformStringFunctionConfig } from '../string/transform';

/**
 * Compares two string arrays and returns whether they contain different values, ignoring case.
 *
 * @param a - First array of strings to compare.
 * @param b - Second array of strings to compare.
 * @returns `true` if the arrays contain different values when compared case-insensitively.
 */
export function hasDifferentStringsNoCase(a: string[], b: string[]): boolean {
  return hasDifferentValues(a.map(caseInsensitiveString), b.map(caseInsensitiveString));
}

/**
 * Maps an array of strings to their trimmed equivalents.
 *
 * @param input - array of strings to trim
 * @returns a new array with each string trimmed of leading and trailing whitespace
 */
export const trimArray = mapArrayFunction(stringTrimFunction);

/**
 * Maps an array of strings to their uppercase equivalents.
 *
 * @param input - array of strings to convert
 * @returns a new array with each string converted to uppercase
 */
export const arrayToUppercase = mapArrayFunction(stringToUppercaseFunction);

/**
 * Maps an array of strings to their lowercase equivalents.
 *
 * @param input - array of strings to convert
 * @returns a new array with each string converted to lowercase
 */
export const arrayToLowercase = mapArrayFunction(stringToLowercaseFunction);

/**
 * A function that transforms an array of strings into another array of strings.
 */
export type TransformStringsFunction = MapFunction<string[], string[]>;

/**
 * Creates a {@link TransformStringsFunction} from the given configuration. If the configuration results
 * in an identity transform, the returned function will be an identity function.
 *
 * @param config - Configuration describing the string transformations to apply.
 * @returns Operator that runs the configured per-string transform across every element, returning an identity transform when no rewriting is needed.
 */
export function transformStrings(config: TransformStringFunctionConfig): TransformStringsFunction {
  const transform = transformStringFunction(config);

  return isMapIdentityFunction(transform) ? mapIdentityFunction() : mapArrayFunction(transform);
}

/**
 * Converts an iterable of strings to a lowercase string array for case-insensitive operations.
 *
 * @param values - Iterable of strings to convert.
 * @returns Lower-cased materialization suitable for case-insensitive comparisons.
 */
export function toCaseInsensitiveStringArray(values: Iterable<string>): string[] {
  return mapIterable<string, string>(values, caseInsensitiveString);
}

/**
 * Returns an array of unique strings from the input, compared case-insensitively. All returned strings are lowercase.
 *
 * @param values - Iterable of strings to deduplicate.
 * @returns Deduped lower-cased values preserving first-seen order.
 */
export function uniqueCaseInsensitiveStrings(values: Iterable<string>): string[] {
  return Array.from(uniqueCaseInsensitiveStringsSet(values));
}

/**
 * Returns a {@link Set} of unique lowercase strings from the input, compared case-insensitively.
 *
 * @param values - Iterable of strings to deduplicate.
 * @returns Membership-only collection of the deduped lower-cased values.
 */
export function uniqueCaseInsensitiveStringsSet(values: Iterable<string>): Set<string> {
  return new Set(toCaseInsensitiveStringArray(values));
}

/**
 * Flattens a two-dimensional array of strings into a single array of unique lowercase strings, compared case-insensitively.
 *
 * @param array - Two-dimensional array of strings to flatten and deduplicate.
 * @returns Single-dimension deduped lower-cased values drawn from every nested row.
 */
export function flattenArrayUniqueCaseInsensitiveStrings(array: string[][]): string[] {
  return unique(flattenArray<string>(array).map<string>(caseInsensitiveString));
}

/**
 * Filters an array of models to only include items with unique keys when compared case-insensitively.
 * Items whose keys match the additional keys are also excluded.
 *
 * @param models - Array of models to filter.
 * @param readKey - Function that extracts the string key from each model.
 * @param additionalKeys - Optional keys to treat as already seen, excluding models with matching keys.
 * @returns The filtered array of models with unique case-insensitive keys.
 */
export function filterUniqueCaseInsensitiveStrings<T, K extends string = string>(models: T[], readKey: ReadKeyFunction<T, K>, additionalKeys: K[] = []): T[] {
  return filterUniqueValues(models, (x: T) => caseInsensitiveString(readKey(x)), toCaseInsensitiveStringArray(additionalKeys));
}

/**
 * Checks whether the given iterable contains the specified string, ignoring case.
 *
 * @param values - Iterable of strings to search.
 * @param valueToFind - Value to search for, compared case-insensitively.
 * @param mustContainAtleastOneItem - If `true`, returns `false` when the values iterable is empty.
 * @returns `true` if the string is found case-insensitively.
 */
export function containsStringAnyCase(values: Iterable<string>, valueToFind: string, mustContainAtleastOneItem?: boolean): boolean {
  return containsAnyStringAnyCase(values, [valueToFind], mustContainAtleastOneItem);
}

/**
 * Checks whether the given iterable contains any of the specified strings, ignoring case.
 *
 * @param values - Iterable of strings to search.
 * @param valuesToFind - Iterable of strings to search for.
 * @param mustContainAtleastOneItem - If `true`, returns `false` when the values iterable is empty.
 * @returns `true` if at least one of the strings is found case-insensitively.
 */
export function containsAnyStringAnyCase(values: Iterable<string>, valuesToFind: Iterable<string>, mustContainAtleastOneItem = false): boolean {
  return containsAnyValue(toCaseInsensitiveStringArray(values), toCaseInsensitiveStringArray(valuesToFind), !mustContainAtleastOneItem);
}

/**
 * Checks whether the given iterable contains all of the specified strings, ignoring case.
 * Returns `true` if there are no strings to find.
 *
 * @param values - Iterable of strings to search.
 * @param valuesToFind - Iterable of strings that must all be present.
 * @param mustContainAtleastOneItem - If `true`, returns `false` when the values iterable is empty.
 * @returns `true` if all of the strings are found case-insensitively.
 */
export function containsAllStringsAnyCase(values: Iterable<string>, valuesToFind: Iterable<string>, mustContainAtleastOneItem = false): boolean {
  const valuesToFindArray = toCaseInsensitiveStringArray(valuesToFind);
  return valuesToFindArray.length ? containsAllValues(toCaseInsensitiveStringArray(values), valuesToFindArray, !mustContainAtleastOneItem) : true;
}

/**
 * Configuration for creating a {@link FilterUniqueTransform} that transforms and deduplicates an array of strings.
 */
export interface FilterUniqueStringsTransformConfig extends TransformStringFunctionConfig {
  /**
   * Whether or not to compare values as lowercase when finding uniqueness.
   *
   * Ignored if toLowercase or toUppercase is used for transforming.
   */
  readonly caseInsensitive?: boolean;
  /**
   * Will exclude these values from the result.
   */
  readonly exclude?: ArrayOrValue<string>;
}

/**
 * Transforms an array of strings into an array of unique strings.
 */
export type FilterUniqueTransform = TransformStringsFunction;

/**
 * Creates a function that transforms an array of strings and removes duplicates based on the given configuration.
 * When `caseInsensitive` is enabled, uniqueness is determined before transformation; otherwise, transformation
 * is applied first and then duplicates are removed.
 *
 * @param config - Configuration describing transformation, uniqueness comparison, and exclusions.
 * @returns Operator that transforms then dedupes an input array per the supplied configuration.
 */
export function filterUniqueTransform(config: FilterUniqueStringsTransformConfig): FilterUniqueTransform {
  const { exclude: excludeInput } = config;
  const exclude = excludeInput ? asArray(excludeInput) : undefined;

  const transform: TransformStringsFunction = transformStrings(config);
  const caseInsensitiveCompare = config.caseInsensitive && !config.toLowercase && !config.toUppercase;

  // When case-insensitive compare is needed, transform after finding unique values.
  // Otherwise, transform before and then use a set to find unique values.
  return caseInsensitiveCompare ? (input: string[]) => transform(filterUniqueCaseInsensitiveStrings(input, (x) => x, exclude)) : (input: string[]) => unique(transform(input), exclude);
}
