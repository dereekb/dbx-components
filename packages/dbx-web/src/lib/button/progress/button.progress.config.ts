import { InjectionToken } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { ProgressSpinnerMode } from '@angular/material/progress-spinner';
import { Maybe } from '@dereekb/util';

export interface DbxProgressButtonOptions {
  /**
   * @deprecated alias for working
   */
  active?: boolean;
  working?: boolean;
  text?: string;
  spinnerText?: string;
  buttonColor?: ThemePalette;
  spinnerColor?: ThemePalette;
  barColor?: ThemePalette;
  raised?: boolean;
  stroked?: boolean;
  flat?: boolean;
  fab?: boolean;
  spinnerSize?: number;
  spinnerRatio?: number;
  mode?: ProgressSpinnerMode;
  value?: number;
  fullWidth?: boolean;
  disabled?: boolean;
  icon?: DbxProgressButtonIcon;
  type?: string;
  customStyle?: { [key: string]: any; };
  customClass?: string;
  /**
   * Custom spinner color. Overrides the normal spinner color if provided.
   */
  customSpinnerColor?: Maybe<string>;
  buttonIcon?: DbxProgressButtonIcon;
  id?: string;
}

export interface DbxProgressButtonIcon {
  color?: ThemePalette;
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

export const DBX_MAT_PROGRESS_BUTTON_GLOBAL_CONFIG = new InjectionToken<DbxProgressButtonGlobalConfig>('DbxMatProgressButtonGlobalConfig');
