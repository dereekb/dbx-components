import { type ArrayOrValue, asArray } from './../array/array';
import { type Maybe } from '../value/maybe.type';
import { joinStringsWithSpaces } from './string';
import { iterableToArray } from '../iterable';

/**
 * Represents a single CSS class
 */
export type CssClass = string;

/**
 * Represents one or more CssClasses that are space separated.
 */
export type SpaceSeparatedCssClasses = string;

/**
 * One or more arrays of one or more CSS classes/arrays of classes.
 */
export type CssClassesArray = ArrayOrValue<ArrayOrValue<SpaceSeparatedCssClasses>>;

/**
 * Joins together various array of classes and only keeps the unique values.
 *
 * @param cssClasses
 * @returns
 */
export function spaceSeparatedCssClasses(cssClasses: Maybe<CssClassesArray>): SpaceSeparatedCssClasses {
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
export function cssClassesSet(cssClasses: Maybe<CssClassesArray>): Set<CssClass> {
  let result: Set<CssClass>;

  if (cssClasses) {
    const arrayOfClasses = iterableToArray(cssClasses, false);
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
