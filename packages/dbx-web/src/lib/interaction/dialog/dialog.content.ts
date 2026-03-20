import { type MatDialogConfig } from '@angular/material/dialog';
import { type Maybe, cssClassesSet } from '@dereekb/util';

/**
 * Configuration for dialog content, extending MatDialogConfig but omitting internal properties.
 */
export type DbxDialogContentConfig = Omit<MatDialogConfig, 'viewContainerRef' | 'injector' | 'id' | 'data'>;

/**
 * Sanitizes a {@link DbxDialogContentConfig} by normalizing the panelClass into an array.
 *
 * @param input - The dialog content config to sanitize, or null/undefined
 * @returns A new config with panelClass normalized to an array of CSS class strings
 *
 * @example
 * ```ts
 * const config = sanitizeDbxDialogContentConfig({ panelClass: 'my-panel my-other-panel' });
 * ```
 */
export function sanitizeDbxDialogContentConfig(input: Maybe<DbxDialogContentConfig>): DbxDialogContentConfig {
  const panelClass = input?.panelClass;

  return {
    ...input,
    panelClass: panelClass ? [...cssClassesSet(input?.panelClass)] : undefined
  };
}
