import { ThemePalette } from '@angular/material/core';
import { ProgressSpinnerMode } from '@angular/material/progress-spinner';
import type { DbxThemeColor } from '../layout';

/**
 * DbxButton display type
 */
export type DbxButtonType = 'basic' | 'raised' | 'stroked' | 'flat' | 'icon';

/**
 * DbxButton style configuration
 */
export interface DbxButtonStyle {
  readonly type?: DbxButtonType;
  readonly mode?: ProgressSpinnerMode;
  readonly color?: ThemePalette | DbxThemeColor;
  readonly spinnerColor?: ThemePalette | DbxThemeColor;
  readonly customButtonColor?: string;
  readonly customTextColor?: string;
  readonly customSpinnerColor?: string;
  readonly fab?: boolean;
}
