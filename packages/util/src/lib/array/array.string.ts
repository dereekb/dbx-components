import { flattenArray } from './array';
import { unique, findUnique } from './array.unique';
import { ReadKeyFunction } from '../key';
import { caseInsensitiveString } from '../string';
import { containsAllValues, containsAnyValue, hasDifferentValues } from '../set/set';
import { mapIterable } from '../iterable/iterable.map';
import { mapArrayFunction, MapFunction, mapIdentityFunction } from '../value';

export function hasDifferentStringsNoCase(a: string[], b: string[]): boolean {
  return hasDifferentValues(a.map(caseInsensitiveString), b.map(caseInsensitiveString));
}

export function arrayToUppercase(input: string[]): string[] {
  return input.map((x) => x.toUpperCase());
}

export function arrayToLowercase(input: string[]): string[] {
  return input.map((x) => x.toLowerCase());
}

export type TransformStringsConfig = {
  /**
   * Whether or not to store all values as lowercase. Ignored if transform is provided.
   */
  toLowercase?: boolean;
  /**
   * Whether or not to store all values as uppercase. Ignored if transform is provided.
   */
  toUppercase?: boolean;
  /**
   * Optional transform function for text.
   */
  transform?: TransformSingleStringFunction;
};

export type TransformSingleStringFunction = MapFunction<string, string>;
export type TransformStringsFunction = MapFunction<string[], string[]>;

export function transformStrings(config: TransformStringsConfig): TransformStringsFunction {
  const transform: TransformStringsFunction = config.transform ? mapArrayFunction(config.transform) : config.toLowercase ? arrayToLowercase : config.toUppercase ? arrayToUppercase : mapIdentityFunction();
  return transform;
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

export interface FindUniqueStringsTransformConfig extends TransformStringsConfig {
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
