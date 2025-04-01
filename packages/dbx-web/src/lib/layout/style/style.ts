import { CssClass, type Maybe } from '@dereekb/util';

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
 * Dark mode is an example, with the suffix '-dark'.
 */
export type DbxStyleClassSuffix = string | `-${string}`;

/**
 * A style class that is a combination of a style name and a suffix.
 *
 * Examples:
 * - 'doc-app': the default style of an app
 * - 'doc-app-dark': the dark mode style of an app
 */
export type DbxStyleClass = string | `${DbxStyleName}${DbxStyleClassSuffix}`;

export const DBX_DARK_STYLE_CLASS_SUFFIX: DbxStyleClassSuffix = '-dark';

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
export type DbxThemeColorMain = 'primary' | 'accent' | 'warn';
export type DbxThemeColorExtra = 'notice' | 'ok' | 'success' | 'grey';
export type DbxThemeColorExtraSecondary = 'background' | 'disabled';
export type DbxThemeColorMainOrExtra = DbxThemeColorMain | DbxThemeColorExtra;
export type DbxThemeColor = DbxThemeColorMainOrExtra | DbxThemeColorExtraSecondary;

export const DBX_THEME_COLORS_MAIN: DbxThemeColorMain[] = ['primary', 'accent', 'warn'];
export const DBX_THEME_COLORS_EXTRA: DbxThemeColorExtra[] = ['notice', 'ok', 'success', 'grey'];
export const DBX_THEME_COLORS_EXTRA_SECONDARY: DbxThemeColorExtraSecondary[] = ['background', 'disabled'];
export const DBX_THEME_COLORS: DbxThemeColor[] = [...DBX_THEME_COLORS_MAIN, ...DBX_THEME_COLORS_EXTRA, ...DBX_THEME_COLORS_EXTRA_SECONDARY];

export function dbxColorBackground(color: Maybe<DbxThemeColor | ''>): CssClass {
  let cssClass = 'dbx-bg'; // background by default

  switch (color) {
    case 'primary':
    case 'accent':
    case 'warn':
    case 'notice':
    case 'ok':
    case 'success':
    case 'grey':
    case 'disabled':
      cssClass = `dbx-${color}-bg`;
      break;
  }

  return cssClass;
}
