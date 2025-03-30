import { InjectionToken } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { ProgressSpinnerMode } from '@angular/material/progress-spinner';
import { type Maybe } from '@dereekb/util';
import { DbxThemeColor } from '../../layout/style/style';

export interface DbxProgressButtonOptions {
  working?: boolean;
  text?: string;
  spinnerText?: string;
  buttonColor?: ThemePalette | DbxThemeColor;
  spinnerColor?: ThemePalette | DbxThemeColor;
  barColor?: ThemePalette | DbxThemeColor;
  raised?: boolean;
  stroked?: boolean;
  flat?: boolean;
  fab?: boolean;
  /**
   * Whether or not to render as an icon button.
   */
  iconOnly?: boolean;
  spinnerSize?: number;
  spinnerRatio?: number;
  mode?: ProgressSpinnerMode;
  value?: number;
  fullWidth?: boolean;
  disabled?: boolean;
  type?: string;
  customStyle?: { [key: string]: string };
  customClass?: string;
  /**
   * Custom spinner color. Overrides the normal spinner color if provided.
   */
  customSpinnerColor?: Maybe<string>;
  buttonIcon?: DbxProgressButtonIcon;
  id?: string;
}

export interface DbxProgressButtonIcon {
  color?: ThemePalette | DbxThemeColor;
  fontIcon?: string;
  fontSet?: string;
  inline?: boolean;
  svgIcon?: string;
  customClass?: string;
}

export interface DbxProgressButtonTargetedConfig extends DbxProgressButtonOptions {
  id?: string;
}

export type DbxProgressButtonGlobalConfig = DbxProgressButtonTargetedConfig[];

export const DBX_PROGRESS_BUTTON_GLOBAL_CONFIG = new InjectionToken<DbxProgressButtonGlobalConfig>('DbxProgressButtonGlobalConfig');
