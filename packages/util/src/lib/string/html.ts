import { type ArrayOrValue, asArray } from './../array/array';
import { type Maybe } from '../value/maybe.type';
import { joinStringsWithSpaces } from './string';
import { iterableToArray } from '../iterable';
import { type PrimativeValue } from '../type';

/**
 * Represents a single CSS Class
 */
export type CssClass = string;

/**
 * Represents a CSS Variable
 *
 * i.e. "--dbx-primary-color"
 */
export type CssVariable = `--${string}`;

/**
 * A CSS variable wrapped in a var() call.
 *
 * i.e. "var(--dbx-primary-color)"
 */
export type CssVariableVar<T extends CssVariable = CssVariable> = `var(${T})`;

/**
 * Converts a CSS variable into a var() string.
 *
 * @param cssVariable - the CSS variable to convert
 * @returns the var() string
 */
export function cssVariableVar<T extends CssVariable>(cssVariable: T): CssVariableVar<T> {
  return `var(${cssVariable})`;
}

/**
 * Represents a single CSS Style
 */
export type CssStyle = string;

/**
 * Represents one or more CssClasses that are space separated.
 */
export type SpaceSeparatedCssClasses = string;

/**
 * Key-value object of CSS style values.
 */
export type CssStyleObject = Record<string, Maybe<PrimativeValue>>;

/**
 * Represents one or more CssStyles that are space separated.
 */
export type SpaceSeparatedCssStyles = string;

/**
 * One or more arrays of one or more CSS classes/arrays of classes.
 */
export type CssClassesArray = ArrayOrValue<ArrayOrValue<SpaceSeparatedCssClasses>>;

/**
 * Joins together various arrays of CSS classes into a single space-separated string of unique class names.
 *
 * @param cssClasses - one or more CSS class values or arrays of class values
 * @returns a space-separated string of unique CSS class names, or an empty string if input is null/undefined
 */
export function spaceSeparatedCssClasses(cssClasses: Maybe<CssClassesArray>): SpaceSeparatedCssClasses {
  let result: SpaceSeparatedCssClasses = '';

  if (cssClasses) {
    const allClasses = cssClassesSet(cssClasses);
    result = joinStringsWithSpaces([...allClasses]);
  }

  return result;
}

/**
 * Parses and deduplicates CSS classes from various array/string inputs into a Set.
 * Space-separated class strings are split into individual class names.
 *
 * @param cssClasses - one or more CSS class values or arrays of class values
 * @returns a Set of unique CSS class names, or an empty Set if input is null/undefined
 */
export function cssClassesSet(cssClasses: Maybe<CssClassesArray>): Set<CssClass> {
  let result: Set<CssClass>;

  if (cssClasses) {
    const arrayOfClasses = iterableToArray(cssClasses, false);
    const arrayOfAllClassValues = arrayOfClasses.flatMap((x) => asArray(x).flatMap((x) => x.split(' ')));

    result = new Set(arrayOfAllClassValues);
  } else {
    result = new Set();
  }

  return result;
}
