import { flattenArray } from './array';
import { unique, findUnique } from './array.unique';
import { ReadKeyFunction, ReadKeysFunction } from '../key';
import { caseInsensitiveString } from '../string/string';
import { containsAllValues, containsAnyValue, hasDifferentValues } from '../set/set';
import { mapIterable } from '../iterable/iterable.map';
import { isMapIdentityFunction, mapArrayFunction, MapFunction, mapIdentityFunction } from '../value/map';
import { DecisionFunctionFactory } from '../value/decision';
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

export function findUniqueCaseInsensitiveStrings<T, K extends string = string>(models: T[], readKey: ReadKeyFunction<T, K>, additionalKeys: K[] = []): T[] {
  return findUnique(models, (x: T) => caseInsensitiveString(readKey(x)), toCaseInsensitiveStringArray(additionalKeys));
}

export function containsStringAnyCase(values: Iterable<string>, valueToFind: string): boolean {
  return containsAnyStringAnyCase(values, [valueToFind]);
}

export function containsAnyStringAnyCase(values: Iterable<string>, valuesToFind: Iterable<string>): boolean {
  return containsAnyValue(toCaseInsensitiveStringArray(values), toCaseInsensitiveStringArray(valuesToFind));
}

export function containsAllStringsAnyCase(values: Iterable<string>, valuesToFind: Iterable<string>): boolean {
  const valuesToFindArray = toCaseInsensitiveStringArray(valuesToFind);
  return valuesToFindArray.length ? containsAllValues(toCaseInsensitiveStringArray(values), valuesToFindArray) : true;
}

export interface FindUniqueStringsTransformConfig extends TransformStringFunctionConfig {
  /**
   * Whether or not to compare values as lowercase when finding uniqueness.
   *
   * Ignored if toLowercase or toUppercase is used for transforming.
   */
  caseInsensitive?: boolean;
}

export type FindUniqueTransform = TransformStringsFunction;

export function findUniqueTransform(config: FindUniqueStringsTransformConfig): FindUniqueTransform {
  const transform: TransformStringsFunction = transformStrings(config);
  const caseInsensitiveCompare = config.caseInsensitive && !config.toLowercase && !config.toUppercase;

  if (caseInsensitiveCompare) {
    // transform after finding unique values
    return (input: string[]) => transform(findUniqueCaseInsensitiveStrings(input, (x) => x));
  } else {
    // transform before, and then use a set to find unique values
    return (input: string[]) => Array.from(new Set(transform(input)));
  }
}

// MARK: Search Strings
/**
 * Filters values by the input filter text.
 */
export type SearchStringFilterFunction<T> = (filterText: string, values: T[]) => T[];

export interface SearchStringFilterConfig<T> {
  readStrings: ReadKeysFunction<T, string>;
  decisionFactory: DecisionFunctionFactory<string, string>;
}

export function searchStringFilterFunction<T>(config: SearchStringFilterConfig<T>): SearchStringFilterFunction<T> {
  const { readStrings, decisionFactory } = config;

  return (filterText: string, values: T[]) => {
    const decision = decisionFactory(filterText);

    return values.filter((value: T) => {
      const strings = readStrings(value);
      const keep = strings.findIndex(decision) !== -1;
      return keep;
    });
  };
}

export const caseInsensitiveFilterByIndexOfDecisionFactory: DecisionFunctionFactory<string, string> = (filterText: string) => {
  const searchString = filterText.toLocaleLowerCase();
  return (string: string) => string.toLocaleLowerCase().indexOf(searchString) !== -1;
};
