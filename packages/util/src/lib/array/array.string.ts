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
 * @param a - first array of strings to compare
 * @param b - second array of strings to compare
 * @returns `true` if the arrays contain different values when compared case-insensitively
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
 * @param config - configuration describing the string transformations to apply
 * @returns a function that applies the configured transformations to an array of strings
 */
export function transformStrings(config: TransformStringFunctionConfig): TransformStringsFunction {
  const transform = transformStringFunction(config);

  return isMapIdentityFunction(transform) ? mapIdentityFunction() : mapArrayFunction(transform);
}

/**
 * Converts an iterable of strings to a lowercase string array for case-insensitive operations.
 *
 * @param values - iterable of strings to convert
 * @returns an array of lowercase strings
 */
export function toCaseInsensitiveStringArray(values: Iterable<string>): string[] {
  return mapIterable<string, string>(values, caseInsensitiveString);
}

/**
 * Returns an array of unique strings from the input, compared case-insensitively. All returned strings are lowercase.
 *
 * @param values - iterable of strings to deduplicate
 * @returns an array of unique lowercase strings
 */
export function uniqueCaseInsensitiveStrings(values: Iterable<string>): string[] {
  return Array.from(uniqueCaseInsensitiveStringsSet(values));
}

/**
 * Returns a {@link Set} of unique lowercase strings from the input, compared case-insensitively.
 *
 * @param values - iterable of strings to deduplicate
 * @returns a set of unique lowercase strings
 */
export function uniqueCaseInsensitiveStringsSet(values: Iterable<string>): Set<string> {
  return new Set(toCaseInsensitiveStringArray(values));
}

/**
 * Flattens a two-dimensional array of strings into a single array of unique lowercase strings, compared case-insensitively.
 *
 * @param array - two-dimensional array of strings to flatten and deduplicate
 * @returns a flat array of unique lowercase strings
 */
export function flattenArrayUniqueCaseInsensitiveStrings(array: string[][]): string[] {
  return unique(flattenArray<string>(array).map<string>(caseInsensitiveString));
}

/**
 * Filters an array of models to only include items with unique keys when compared case-insensitively.
 * Items whose keys match the additional keys are also excluded.
 *
 * @param models - array of models to filter
 * @param readKey - function that extracts the string key from each model
 * @param additionalKeys - optional keys to treat as already seen, excluding models with matching keys
 * @returns the filtered array of models with unique case-insensitive keys
 */
export function filterUniqueCaseInsensitiveStrings<T, K extends string = string>(models: T[], readKey: ReadKeyFunction<T, K>, additionalKeys: K[] = []): T[] {
  return filterUniqueValues(models, (x: T) => caseInsensitiveString(readKey(x)), toCaseInsensitiveStringArray(additionalKeys));
}

/**
 * Checks whether the given iterable contains the specified string, ignoring case.
 *
 * @param values - iterable of strings to search
 * @param valueToFind - the string to search for
 * @param mustContainAtleastOneItem - if `true`, returns `false` when the values iterable is empty
 * @returns `true` if the string is found case-insensitively
 */
export function containsStringAnyCase(values: Iterable<string>, valueToFind: string, mustContainAtleastOneItem?: boolean): boolean {
  return containsAnyStringAnyCase(values, [valueToFind], mustContainAtleastOneItem);
}

/**
 * Checks whether the given iterable contains any of the specified strings, ignoring case.
 *
 * @param values - iterable of strings to search
 * @param valuesToFind - iterable of strings to search for
 * @param mustContainAtleastOneItem - if `true`, returns `false` when the values iterable is empty
 * @returns `true` if at least one of the strings is found case-insensitively
 */
export function containsAnyStringAnyCase(values: Iterable<string>, valuesToFind: Iterable<string>, mustContainAtleastOneItem = false): boolean {
  return containsAnyValue(toCaseInsensitiveStringArray(values), toCaseInsensitiveStringArray(valuesToFind), !mustContainAtleastOneItem);
}

/**
 * Checks whether the given iterable contains all of the specified strings, ignoring case.
 * Returns `true` if there are no strings to find.
 *
 * @param values - iterable of strings to search
 * @param valuesToFind - iterable of strings that must all be present
 * @param mustContainAtleastOneItem - if `true`, returns `false` when the values iterable is empty
 * @returns `true` if all of the strings are found case-insensitively
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
 * @param config - configuration describing transformation, uniqueness comparison, and exclusions
 * @returns a function that transforms and deduplicates an input array of strings
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
