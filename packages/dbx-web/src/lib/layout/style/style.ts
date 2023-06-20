import { Maybe } from '@dereekb/util';

export type DbxThemeColor = 'primary' | 'accent' | 'warn' | 'ok' | 'success' | 'background' | 'grey' | 'disabled';

export function dbxColorBackground(color: Maybe<DbxThemeColor | ''>): string {
  let cssClass = 'dbx-bg';

  switch (color) {
    case 'primary':
      cssClass = 'dbx-primary-bg';
      break;
    case 'accent':
      cssClass = 'dbx-accent-bg';
      break;
    case 'ok':
      cssClass = 'dbx-ok-bg';
      break;
    case 'success':
      cssClass = 'dbx-success-bg';
      break;
    case 'warn':
      cssClass = 'dbx-warn-bg';
      break;
    case 'grey':
      cssClass = 'dbx-grey-bg';
      break;
    case 'disabled':
      cssClass = 'dbx-disabled-bg';
      break;
  }

  return cssClass;
}
