import { type ThemePalette } from '@angular/material/core';
import { type ProgressSpinnerMode } from '@angular/material/progress-spinner';
import type { DbxThemeColor } from '../layout';

/**
 * Material button display variant used by dbx-button components.
 */
export type DbxButtonType = 'basic' | 'raised' | 'stroked' | 'flat' | 'tonal' | 'icon';

/**
 * Programmatic style configuration for a dbx-button, providing fine-grained control
 * over button type, colors, spinner appearance, and floating action button mode.
 */
export interface DbxButtonStyle {
  /**
   * Material button variant.
   */
  readonly type?: DbxButtonType;
  /**
   * Progress spinner mode (determinate or indeterminate).
   */
  readonly mode?: ProgressSpinnerMode;
  /**
   * Material theme palette or custom theme color for the button.
   */
  readonly color?: ThemePalette | DbxThemeColor;
  /**
   * Material theme palette or custom theme color for the loading spinner.
   */
  readonly spinnerColor?: ThemePalette | DbxThemeColor;
  /**
   * Custom CSS background color for the button.
   */
  readonly customButtonColor?: string;
  /**
   * Custom CSS text color for the button label.
   */
  readonly customTextColor?: string;
  /**
   * Custom CSS color for the spinner stroke.
   */
  readonly customSpinnerColor?: string;
  /**
   * Whether to render as a floating action button (FAB).
   */
  readonly fab?: boolean;
}
