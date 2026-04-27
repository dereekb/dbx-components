import { type ArrayOrValue, asArray } from './../array/array';
import { type Maybe } from '../value/maybe.type';
import { joinStringsWithSpaces } from './string';
import { iterableToArray } from '../iterable';
import { type PrimativeValue } from '../type';

// MARK: HTML
/**
 * HTML heading level corresponding to `<h1>` through `<h6>`.
 */
export type HtmlHeaderLevel = 1 | 2 | 3 | 4 | 5 | 6;

// MARK: CSS
/**
 * Represents a single CSS Class
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-util:css
 */
export type CssClass = string;

/**
 * The name portion of a CSS token, without the leading `--` prefix.
 *
 * @example
 * ```ts
 * const name: CssTokenName = 'dbx-primary-color';
 * ```
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-util:css
 */
export type CssTokenName = string;

/**
 * Represents a CSS custom property token (CSS variable).
 *
 * @example
 * ```ts
 * const token: CssToken = '--dbx-primary-color';
 * ```
 */
export type CssToken<T extends CssTokenName = CssTokenName> = `--${T}`;

/**
 * A CSS token wrapped in a var() call.
 *
 * @example
 * ```ts
 * const tokenVar: CssTokenVar = 'var(--dbx-primary-color)';
 * ```
 */
export type CssTokenVar<T extends CssToken = CssToken> = `var(${T})`;

/**
 * Converts a CSS token into a var() string.
 *
 * @example
 * ```ts
 * cssTokenVar('--dbx-primary-color'); // 'var(--dbx-primary-color)'
 * ```
 *
 * @param cssToken - the CSS token to convert
 * @returns the var() string
 */
export function cssTokenVar<T extends CssToken>(cssToken: T): CssTokenVar<T> {
  return `var(${cssToken})`;
}

// MARK: Compat
/**
 * @deprecated Use {@link CssToken} instead.
 */
export type CssVariable = CssToken;

/**
 * @deprecated Use {@link CssTokenVar} instead.
 */
export type CssVariableVar<T extends CssToken = CssToken> = CssTokenVar<T>;

/**
 * @deprecated Use {@link cssTokenVar} instead.
 */
export const cssVariableVar = cssTokenVar;

/**
 * Represents a single CSS Style
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-util:css
 */
export type CssStyle = string;

/**
 * Represents one or more CssClasses that are space separated.
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-util:css
 */
export type SpaceSeparatedCssClasses = string;

/**
 * Key-value object of CSS style values.
 */
export type CssStyleObject = Record<string, Maybe<PrimativeValue>>;

/**
 * Represents one or more CssStyles that are space separated.
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-util:css
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
