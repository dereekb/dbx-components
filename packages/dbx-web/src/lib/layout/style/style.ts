import { CssClass, Maybe } from '@dereekb/util';

export type DbxThemeColor = 'primary' | 'accent' | 'warn' | 'ok' | 'success' | 'background' | 'grey' | 'disabled' | 'notice';

export const DBX_THEME_COLORS: DbxThemeColor[] = ['primary', 'accent', 'warn', 'ok', 'success', 'background', 'grey', 'disabled', 'notice'];

export function dbxColorBackground(color: Maybe<DbxThemeColor | ''>): CssClass {
  let cssClass = 'dbx-bg';

  switch (color) {
    case 'primary':
    case 'accent':
    case 'ok':
    case 'success':
    case 'warn':
    case 'grey':
    case 'disabled':
    case 'notice':
      cssClass = `dbx-${color}-bg`;
      break;
  }

  return cssClass;
}
