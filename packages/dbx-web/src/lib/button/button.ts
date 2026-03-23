import { type ThemePalette } from '@angular/material/core';
import { type ProgressSpinnerMode } from '@angular/material/progress-spinner';
import type { Maybe } from '@dereekb/util';
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
  readonly type?: Maybe<DbxButtonType>;
  /**
   * Progress spinner mode (determinate or indeterminate).
   */
  readonly mode?: Maybe<ProgressSpinnerMode>;
  /**
   * Material theme palette or custom theme color for the button.
   */
  readonly color?: Maybe<ThemePalette | DbxThemeColor>;
  /**
   * Material theme palette or custom theme color for the loading spinner.
   */
  readonly spinnerColor?: Maybe<ThemePalette | DbxThemeColor>;
  /**
   * Custom CSS background color for the button.
   */
  readonly customButtonColor?: Maybe<string>;
  /**
   * Custom CSS text color for the button label.
   */
  readonly customTextColor?: Maybe<string>;
  /**
   * Custom CSS color for the spinner stroke.
   */
  readonly customSpinnerColor?: Maybe<string>;
  /**
   * Whether to render as a floating action button (FAB).
   */
  readonly fab?: Maybe<boolean>;
}
