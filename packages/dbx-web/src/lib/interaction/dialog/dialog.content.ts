import { MatDialogConfig } from '@angular/material/dialog';
import { Maybe, cssClassesSet } from '@dereekb/util';

export type DbxDialogContentConfig = Omit<MatDialogConfig, 'viewContainerRef' | 'injector' | 'id' | 'data'>;

export function sanitizeDbxDialogContentConfig(input: Maybe<DbxDialogContentConfig>): DbxDialogContentConfig {
  const panelClass = input?.panelClass;

  return {
    ...input,
    panelClass: panelClass ? Array.from(cssClassesSet(input?.panelClass)) : undefined
  };
}
