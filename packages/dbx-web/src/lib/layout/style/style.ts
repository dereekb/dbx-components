import { type CharacterPrefixSuffixCleanString, type CssClass, CssClassesArray, CssToken, cssTokenVar, CssTokenVar, DASH_CHARACTER_PREFIX_INSTANCE, type DashPrefixString, type Maybe } from '@dereekb/util';

// MARK: App Styling
/**
 * An kebab-case style name that uniquely identifies a styling for an app.
 *
 * Examples: 'doc-app'
 */
export type DbxStyleName = string;

/**
 * A suffix that can be added to a style class to differentiate a separate mode.
 *
 * Dark mode is an example, with the suffix 'dark' or '-dark'. The suffix does not have to
 */
export type DbxStyleClassSuffix = DbxStyleClassCleanSuffix | DbxStyleClassDashSuffix;

/**
 * A DbxStyleClassSuffix that does not start with a dash.
 *
 * Dark mode is an example, with the suffix 'dark'.
 */
export type DbxStyleClassCleanSuffix = CharacterPrefixSuffixCleanString;

/**
 * A DbxStyleClassSuffix that starts with a dash.
 *
 * Dark mode is an example, with the suffix '-dark'.
 */
export type DbxStyleClassDashSuffix = DashPrefixString;

/**
 * Strips a leading dash from a style class suffix string, producing a clean suffix.
 */
export const dbxStyleClassCleanSuffix = DASH_CHARACTER_PREFIX_INSTANCE.cleanString;

/**
 * A style class that is a combination of a style name and a suffix.
 *
 * Examples:
 * - 'doc-app': the default style of an app
 * - 'doc-app-dark': the dark mode style of an app
 */
export type DbxStyleClass = string | `${DbxStyleName}${DbxStyleClassSuffix}`;

/**
 * The standard suffix used for dark mode styling.
 */
export const DBX_DARK_STYLE_CLASS_SUFFIX: DbxStyleClassSuffix = '-dark';

/**
 * Configuration for an application's style, including the root style class and allowed suffixes for variant modes (e.g., dark mode).
 */
export interface DbxStyleConfig {
  /**
   * Root style class name.
   */
  readonly style: DbxStyleClass;
  /**
   * Set of all allowed DbxStyleClassSuffixes for the DbxStyleClass in the config, if applicable.
   */
  readonly suffixes?: Set<DbxStyleClassSuffix>;
}

// MARK: Theme
/**
 * The five core Material Design M3 theme palette colors.
 *
 * - 'secondary' is the M3 secondary palette color (equivalent to 'accent')
 * - 'tertiary' is the M3 tertiary palette color
 */
export type DbxThemeColorMain = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'warn';

/**
 * Additional semantic theme colors beyond the core Material palettes.
 */
export type DbxThemeColorExtra = 'notice' | 'ok' | 'success' | 'grey';

/**
 * Secondary theme colors representing neutral or inactive states.
 */
export type DbxThemeColorExtraSecondary = 'default' | 'disabled';

/**
 * Union of main and extra theme colors, excluding secondary states.
 */
export type DbxThemeColorMainOrExtra = DbxThemeColorMain | DbxThemeColorExtra;

/**
 * All available theme colors, including main, extra, and secondary variants.
 */
export type DbxThemeColor = DbxThemeColorMainOrExtra | DbxThemeColorExtraSecondary;

export const DBX_THEME_COLORS_MAIN: DbxThemeColorMain[] = ['primary', 'secondary', 'tertiary', 'accent', 'warn'];
export const DBX_THEME_COLORS_EXTRA: DbxThemeColorExtra[] = ['notice', 'ok', 'success', 'grey'];
export const DBX_THEME_COLORS_EXTRA_SECONDARY: DbxThemeColorExtraSecondary[] = ['default', 'disabled'];
export const DBX_THEME_COLORS: DbxThemeColor[] = [...DBX_THEME_COLORS_MAIN, ...DBX_THEME_COLORS_EXTRA, ...DBX_THEME_COLORS_EXTRA_SECONDARY];

/**
 * Returns the CSS class name for a themed background color.
 *
 * @example
 * ```ts
 * dbxColorBackground('primary'); // 'dbx-primary-bg'
 * dbxColorBackground(undefined); // 'dbx-default'
 * ```
 *
 * @param color - the theme color to convert, or nullish/empty for the default class
 * @returns the CSS class name for the themed background (e.g., `'dbx-primary-bg'` or `'dbx-default'`)
 */
export function dbxColorBackground(color: Maybe<DbxThemeColor | ''>): CssClass {
  let cssClass = 'dbx-default'; // background by default

  switch (color) {
    case 'primary':
    case 'secondary':
    case 'tertiary':
    case 'accent':
    case 'warn':
    case 'notice':
    case 'ok':
    case 'success':
    case 'grey':
    case 'disabled':
    case 'default':
      cssClass = `dbx-${color}-bg`;
      break;
    default:
      break;
  }

  return cssClass;
}

/**
 * Maps each {@link DbxThemeColor} to its corresponding CSS token reference string.
 */
const DBX_THEME_COLOR_CSS_VAR_MAP: Record<DbxThemeColor, CssToken> = {
  primary: '--dbx-primary-color',
  secondary: '--dbx-secondary-color',
  tertiary: '--dbx-tertiary-color',
  accent: '--dbx-accent-color',
  warn: '--dbx-warn-color',
  notice: '--dbx-notice-color',
  ok: '--dbx-ok-color',
  success: '--dbx-success-color',
  grey: '--dbx-grey-color',
  disabled: '--dbx-disabled-color',
  default: '--dbx-default-color'
};

/**
 * Returns the CSS token reference string for a given {@link DbxThemeColor}.
 *
 * @example
 * ```ts
 * dbxThemeColorCssToken('primary'); // '--dbx-primary-color'
 * dbxThemeColorCssToken(undefined); // undefined
 * ```
 *
 * @param color - the theme color, or nullish/empty for the default
 * @returns CSS token reference string (e.g., `'--dbx-primary-color'`) or undefined if the color is not valid.
 */
export function dbxThemeColorCssToken(color: Maybe<DbxThemeColor>, returnDefault: true): CssToken;
export function dbxThemeColorCssToken(color: Maybe<DbxThemeColor>, returnDefault?: Maybe<boolean>): Maybe<CssToken>;
export function dbxThemeColorCssToken(color: Maybe<DbxThemeColor>, returnDefault?: Maybe<boolean>): Maybe<CssToken> {
  let result: Maybe<CssToken>;

  if (color && color in DBX_THEME_COLOR_CSS_VAR_MAP) {
    result = DBX_THEME_COLOR_CSS_VAR_MAP[color as DbxThemeColor];
  } else if (returnDefault) {
    result = DBX_THEME_COLOR_CSS_VAR_MAP.default;
  }

  return result;
}

/**
 * Returns the CSS token var() reference string for a given {@link DbxThemeColor}.
 *
 * @example
 * ```ts
 * dbxThemeColorCssTokenVar('primary'); // 'var(--dbx-primary-color)'
 * dbxThemeColorCssTokenVar(undefined); // undefined
 * ```
 *
 * @param color - the theme color, or nullish/empty for the default
 * @returns CSS token var() reference string (e.g., `'var(--dbx-primary-color)'`) or undefined if the color is not valid.
 */
export function dbxThemeColorCssTokenVar(color: Maybe<DbxThemeColor>, returnDefault: true): CssTokenVar;
export function dbxThemeColorCssTokenVar(color: Maybe<DbxThemeColor>, returnDefault?: Maybe<boolean>): Maybe<CssTokenVar>;
export function dbxThemeColorCssTokenVar(color: Maybe<DbxThemeColor>, returnDefault?: Maybe<boolean>): Maybe<CssTokenVar> {
  const cssVar = dbxThemeColorCssToken(color, returnDefault);
  let result: Maybe<CssTokenVar>;

  if (cssVar) {
    result = cssTokenVar(cssVar);
  }

  return result;
}

// MARK: Compat
/**
 * @deprecated Use {@link dbxThemeColorCssToken} instead.
 */
export const dbxThemeColorCssVariable = dbxThemeColorCssToken;

/**
 * @deprecated Use {@link dbxThemeColorCssTokenVar} instead.
 */
export const dbxThemeColorCssVariableVar = dbxThemeColorCssTokenVar;
