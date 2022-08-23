import { Maybe } from '@dereekb/util';

export type DbxThemeColor = 'primary' | 'accent' | 'warn' | 'background';

export function dbxColorBackground(color: Maybe<DbxThemeColor>): string {
  let cssClass = 'dbx-bg';

  switch (color) {
    case 'primary':
      cssClass = 'dbx-primary-bg';
      break;
    case 'accent':
      cssClass = 'dbx-accent-bg';
      break;
    case 'warn':
      cssClass = 'dbx-warn-bg';
      break;
  }

  return cssClass;
}
