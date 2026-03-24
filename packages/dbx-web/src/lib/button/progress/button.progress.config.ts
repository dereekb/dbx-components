import { InjectionToken } from '@angular/core';
import { type ThemePalette } from '@angular/material/core';
import { type ProgressSpinnerMode } from '@angular/material/progress-spinner';
import { type Maybe } from '@dereekb/util';
import { type DbxThemeColor } from '../../layout/style/style';
import { type DbxButtonType } from '../button';
import { type DbxButtonEcho, type DbxButtonWorking } from '@dereekb/dbx-core';

/**
 * Full configuration for a progress button, controlling appearance, working state,
 * colors, spinner behavior, and button type.
 */
export interface DbxProgressButtonConfig {
  /**
   * Current working state. A boolean enables indeterminate mode; a number (0-100) enables determinate mode.
   */
  readonly working?: Maybe<DbxButtonWorking>;
  /**
   * Button label text.
   */
  readonly text?: Maybe<string>;
  /**
   * Text displayed alongside the spinner while working.
   */
  readonly spinnerText?: Maybe<string>;
  /**
   * Theme color for the button itself.
   */
  readonly buttonColor?: Maybe<ThemePalette | DbxThemeColor>;
  /**
   * Theme color for the progress spinner.
   */
  readonly spinnerColor?: Maybe<ThemePalette | DbxThemeColor>;
  /**
   * Theme color for the progress bar (bar mode only).
   */
  readonly barColor?: Maybe<ThemePalette | DbxThemeColor>;
  /**
   * When true, renders only the icon button without text.
   */
  readonly iconOnly?: Maybe<boolean>;
  /**
   * Explicit spinner diameter in pixels.
   */
  readonly spinnerSize?: Maybe<number>;
  /**
   * Ratio of spinner size relative to button height (0-1).
   */
  readonly spinnerRatio?: Maybe<number>;
  /**
   * Spinner mode: determinate or indeterminate.
   */
  readonly mode?: Maybe<ProgressSpinnerMode>;
  /**
   * Whether the button stretches to full container width.
   */
  readonly fullWidth?: Maybe<boolean>;
  /**
   * Whether the button is disabled.
   */
  readonly disabled?: Maybe<boolean>;
  /**
   * Custom inline styles applied to the button element.
   */
  readonly customStyle?: Maybe<{ [key: string]: string }>;
  /**
   * Custom CSS class applied to the button element.
   */
  readonly customClass?: Maybe<string>;
  /**
   * Custom CSS color for the spinner stroke. Overrides `spinnerColor` when provided.
   */
  readonly customSpinnerColor?: Maybe<string>;
  /**
   * Icon configuration for the button.
   */
  readonly buttonIcon?: Maybe<DbxProgressButtonIcon>;
  /**
   * Identifier used for matching against global configuration.
   */
  readonly id?: Maybe<string>;
  /**
   * Material button variant to render.
   */
  readonly buttonType?: Maybe<DbxButtonType>;
  /**
   * HTML `type` attribute for the underlying button element (e.g. "submit", "button").
   */
  readonly buttonTypeAttribute?: Maybe<string>;
  /**
   * Whether to render as a floating action button (FAB).
   */
  readonly fab?: Maybe<boolean>;
  /**
   * Accessible label for the button, applied as `aria-label`.
   * Especially important for icon-only buttons that lack visible text.
   */
  readonly ariaLabel?: Maybe<string>;
  /**
   * Active button echo. When set, the button's text/icon fade out (preserving width)
   * and a centered echo icon overlay appears, mirroring the spinner working animation.
   */
  readonly buttonEcho?: Maybe<DbxButtonEcho>;
}

/**
 * Configuration for the icon displayed inside a progress button.
 */
export interface DbxProgressButtonIcon {
  /**
   * Theme color for the icon.
   */
  readonly color?: Maybe<ThemePalette | DbxThemeColor>;
  /**
   * Material icon font ligature name (e.g. "save", "delete").
   */
  readonly fontIcon?: Maybe<string>;
  /**
   * Icon font set to use (e.g. for extended icon libraries).
   */
  readonly fontSet?: Maybe<string>;
  /**
   * Whether to render the icon inline with text.
   */
  readonly inline?: Maybe<boolean>;
  /**
   * SVG icon name registered with MatIconRegistry.
   */
  readonly svgIcon?: Maybe<string>;
  /**
   * Custom CSS class applied to the icon element.
   */
  readonly customClass?: Maybe<string>;
}

/**
 * Progress button configuration that includes an identifier, used for matching
 * buttons against global configuration overrides.
 */
export interface DbxProgressButtonTargetedConfig extends DbxProgressButtonConfig {
  readonly id?: Maybe<string>;
}

/**
 * Array of targeted progress button configurations, provided globally to override
 * defaults for buttons matching specific IDs.
 */
export type DbxProgressButtonGlobalConfig = DbxProgressButtonTargetedConfig[];

/**
 * Injection token for providing a global array of progress button configurations.
 */
export const DBX_PROGRESS_BUTTON_GLOBAL_CONFIG = new InjectionToken<DbxProgressButtonGlobalConfig>('DbxProgressButtonGlobalConfig');
