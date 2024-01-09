import { flattenArray } from './array';
import { unique, filterUniqueValues } from './array.unique';
import { ReadKeyFunction } from '../key';
import { caseInsensitiveString } from '../string/string';
import { containsAllValues, containsAnyValue, hasDifferentValues } from '../set/set';
import { mapIterable } from '../iterable/iterable.map';
import { isMapIdentityFunction, mapArrayFunction, MapFunction, mapIdentityFunction } from '../value/map';
import { stringToLowercaseFunction, stringToUppercaseFunction, stringTrimFunction, transformStringFunction, TransformStringFunctionConfig } from '../string/transform';

export function hasDifferentStringsNoCase(a: string[], b: string[]): boolean {
  return hasDifferentValues(a.map(caseInsensitiveString), b.map(caseInsensitiveString));
}

export const trimArray = mapArrayFunction(stringTrimFunction);
export const arrayToUppercase = mapArrayFunction(stringToUppercaseFunction);
export const arrayToLowercase = mapArrayFunction(stringToLowercaseFunction);

export type TransformStringsFunction = MapFunction<string[], string[]>;

export function transformStrings(config: TransformStringFunctionConfig): TransformStringsFunction {
  const transform = transformStringFunction(config);

  if (isMapIdentityFunction(transform)) {
    return mapIdentityFunction();
  } else {
    return mapArrayFunction(transform);
  }
}

export function toCaseInsensitiveStringArray(values: Iterable<string>): string[] {
  return mapIterable<string, string>(values, caseInsensitiveString);
}

export function uniqueCaseInsensitiveStrings(values: Iterable<string>): string[] {
  return Array.from(uniqueCaseInsensitiveStringsSet(values));
}

export function uniqueCaseInsensitiveStringsSet(values: Iterable<string>): Set<string> {
  return new Set(toCaseInsensitiveStringArray(values));
}

export function flattenArrayUniqueCaseInsensitiveStrings(array: string[][]): string[] {
  return unique(flattenArray<string>(array).map<string>(caseInsensitiveString));
}

export function filterUniqueCaseInsensitiveStrings<T, K extends string = string>(models: T[], readKey: ReadKeyFunction<T, K>, additionalKeys: K[] = []): T[] {
  return filterUniqueValues(models, (x: T) => caseInsensitiveString(readKey(x)), toCaseInsensitiveStringArray(additionalKeys));
}

export function containsStringAnyCase(values: Iterable<string>, valueToFind: string, mustContainAtleastOneItem?: boolean): boolean {
  return containsAnyStringAnyCase(values, [valueToFind], mustContainAtleastOneItem);
}

export function containsAnyStringAnyCase(values: Iterable<string>, valuesToFind: Iterable<string>, mustContainAtleastOneItem = false): boolean {
  return containsAnyValue(toCaseInsensitiveStringArray(values), toCaseInsensitiveStringArray(valuesToFind), !mustContainAtleastOneItem);
}

export function containsAllStringsAnyCase(values: Iterable<string>, valuesToFind: Iterable<string>, mustContainAtleastOneItem = false): boolean {
  const valuesToFindArray = toCaseInsensitiveStringArray(valuesToFind);
  return valuesToFindArray.length ? containsAllValues(toCaseInsensitiveStringArray(values), valuesToFindArray, !mustContainAtleastOneItem) : true;
}

export interface FilterUniqueStringsTransformConfig extends TransformStringFunctionConfig {
  /**
   * Whether or not to compare values as lowercase when finding uniqueness.
   *
   * Ignored if toLowercase or toUppercase is used for transforming.
   */
  caseInsensitive?: boolean;
}

/**
 * Transforms an array of strings into an array of unique strings.
 */
export type FilterUniqueTransform = TransformStringsFunction;

export function filterUniqueTransform(config: FilterUniqueStringsTransformConfig): FilterUniqueTransform {
  const transform: TransformStringsFunction = transformStrings(config);
  const caseInsensitiveCompare = config.caseInsensitive && !config.toLowercase && !config.toUppercase;

  if (caseInsensitiveCompare) {
    // transform after finding unique values
    return (input: string[]) => transform(filterUniqueCaseInsensitiveStrings(input, (x) => x));
  } else {
    // transform before, and then use a set to find unique values
    return (input: string[]) => Array.from(new Set(transform(input)));
  }
}
