import { CssClass, type Maybe } from '@dereekb/util';

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
