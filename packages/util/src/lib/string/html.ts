import { type ArrayOrValue, asArray } from './../array/array';
import { type Maybe } from '../value/maybe.type';
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
    const allClasses = cssClassesSet(cssClasses);
    result = joinStringsWithSpaces(Array.from(allClasses));
  }

  return result;
}

/**
 * Joins together various array of classes and returns the set of unique CSS classes.
 *
 * @param cssClasses
 * @returns
 */
export function cssClassesSet(cssClasses: Maybe<ArrayOrValue<ArrayOrValue<SpaceSeparatedCssClasses>>>): Set<CssClass> {
  let result: Set<CssClass>;

  if (cssClasses) {
    const arrayOfClasses = asArray(cssClasses);
    const arrayOfAllClassValues = arrayOfClasses
      .map((x) =>
        asArray(x)
          .map((x) => x.split(' '))
          .flat()
      )
      .flat();

    result = new Set(arrayOfAllClassValues);
  } else {
    result = new Set();
  }

  return result;
}
