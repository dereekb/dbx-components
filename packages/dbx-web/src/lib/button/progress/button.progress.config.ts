import { InjectionToken } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { ProgressSpinnerMode } from '@angular/material/progress-spinner';
import { type Maybe } from '@dereekb/util';
import { DbxThemeColor } from '../../layout/style/style';
import { DbxButtonType } from '../button.component';
import { DbxButtonWorking } from '@dereekb/dbx-core';

export interface DbxProgressButtonConfig {
  readonly working?: Maybe<DbxButtonWorking>;
  readonly text?: Maybe<string>;
  readonly spinnerText?: Maybe<string>;
  readonly buttonColor?: Maybe<ThemePalette | DbxThemeColor>;
  readonly spinnerColor?: Maybe<ThemePalette | DbxThemeColor>;
  readonly barColor?: Maybe<ThemePalette | DbxThemeColor>;
  /**
   * Whether or not to render as an icon button.
   */
  readonly iconOnly?: Maybe<boolean>;
  readonly spinnerSize?: Maybe<number>;
  readonly spinnerRatio?: Maybe<number>;
  readonly mode?: Maybe<ProgressSpinnerMode>;
  /**
   * @deprecated use working instead
   */
  readonly value?: Maybe<DbxButtonWorking>;
  readonly fullWidth?: Maybe<boolean>;
  readonly disabled?: Maybe<boolean>;
  readonly customStyle?: Maybe<{ [key: string]: string }>;
  readonly customClass?: Maybe<string>;
  /**
   * Custom spinner color. Overrides the normal spinner color if provided.
   */
  readonly customSpinnerColor?: Maybe<string>;
  readonly buttonIcon?: Maybe<DbxProgressButtonIcon>;
  readonly id?: Maybe<string>;
  /**
   * The type of button to render.
   */
  readonly buttonType?: Maybe<DbxButtonType>;

  /**
   * The HTML attribute "type" to add to the button.
   */
  readonly buttonTypeAttribute?: Maybe<string>;

  /**
   * @deprecated use buttonType=raised instead
   */
  readonly raised?: Maybe<boolean>;
  /**
   * @deprecated use buttonType=stroked instead
   */
  readonly stroked?: Maybe<boolean>;
  /**
   * @deprecated use buttonType=flat instead
   */
  readonly flat?: Maybe<boolean>;

  /**
   * Whether or not this is a floating action button.
   */
  readonly fab?: Maybe<boolean>;

  /**
   * @deprecated use buttonTypeAttribute instead
   */
  readonly type?: Maybe<string>;
}

export interface DbxProgressButtonIcon {
  readonly color?: Maybe<ThemePalette | DbxThemeColor>;
  readonly fontIcon?: Maybe<string>;
  readonly fontSet?: Maybe<string>;
  readonly inline?: Maybe<boolean>;
  readonly svgIcon?: Maybe<string>;
  readonly customClass?: Maybe<string>;
}

export interface DbxProgressButtonTargetedConfig extends DbxProgressButtonConfig {
  readonly id?: Maybe<string>;
}

export type DbxProgressButtonGlobalConfig = DbxProgressButtonTargetedConfig[];

export const DBX_PROGRESS_BUTTON_GLOBAL_CONFIG = new InjectionToken<DbxProgressButtonGlobalConfig>('DbxProgressButtonGlobalConfig');

// MARK: Compat
/**
 * @deprecated use DbxProgressButtonConfig instead.
 */
export type DbxProgressButtonOptions = DbxProgressButtonConfig;
