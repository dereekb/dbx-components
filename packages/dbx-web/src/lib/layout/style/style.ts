import { type CharacterPrefixSuffixCleanString, type CssClass, DASH_CHARACTER_PREFIX_INSTANCE, type DashPrefixString, type Maybe } from '@dereekb/util';

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
 * The three core Material Design theme palette colors.
 */
export type DbxThemeColorMain = 'primary' | 'accent' | 'warn';

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

export const DBX_THEME_COLORS_MAIN: DbxThemeColorMain[] = ['primary', 'accent', 'warn'];
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
 */
export function dbxColorBackground(color: Maybe<DbxThemeColor | ''>): CssClass {
  let cssClass = 'dbx-default'; // background by default

  switch (color) {
    case 'primary':
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
  }

  return cssClass;
}
