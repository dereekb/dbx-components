import { ArrayOrValue, asArray } from './../array/array';
import { Maybe } from '../value/maybe.type';
import { joinStringsWithSpaces } from './string';

/**
 * Represents a single CSS class
 */
export type CssClass = string;

/**
 * Represents one or more CssClasses that are space separated.
 */
export type SpaceSeparatedCssClasses = string;

/**
 * Joins together various array of classes and only keeps the unique values.
 *
 * @param cssClasses
 * @returns
 */
export function spaceSeparatedCssClasses(cssClasses: Maybe<ArrayOrValue<ArrayOrValue<SpaceSeparatedCssClasses>>>): SpaceSeparatedCssClasses {
  let result: SpaceSeparatedCssClasses = '';

  if (cssClasses) {
    const arrayOfClasses = asArray(cssClasses);
    const arrayOfAllClassValues = arrayOfClasses
      .map((x) =>
        asArray(x)
          .map((x) => x.split(' '))
          .flat()
      )
      .flat();

    const allClasses = new Set(arrayOfAllClassValues);
    result = joinStringsWithSpaces(Array.from(allClasses));
  }

  return result;
}
