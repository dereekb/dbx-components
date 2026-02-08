import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { provideDbxButton, AbstractDbxButtonDirective } from '@dereekb/dbx-core';
import { Configurable, isDefinedAndNotFalse, type Maybe } from '@dereekb/util';
import { DbxProgressButtonConfig } from './progress/button.progress.config';
import { type DbxThemeColor } from '../layout/style/style';
import { DbxProgressSpinnerButtonComponent, DbxProgressBarButtonComponent } from './progress';
import { ProgressSpinnerMode } from '@angular/material/progress-spinner';
import { NgTemplateOutlet } from '@angular/common';
import { DbxButtonStyle, DbxButtonType } from './button';

/**
 * @deprecated use DbxButtonType instead.
 */
export enum DbxButtonDisplayType {
  RAISED = 'raised',
  STROKED = 'stroked',
  FLAT = 'flag',
  ICON_ONLY = 'icon'
}

/**
 * Complex button that supports loading states.
 */
@Component({
  selector: 'dbx-button',
  template: `
    @if (bar()) {
      <dbx-progress-bar-button (btnClick)="clickButton()" [config]="configSignal()">
        <ng-template [ngTemplateOutlet]="content"></ng-template>
      </dbx-progress-bar-button>
    } @else {
      <dbx-progress-spinner-button (btnClick)="clickButton()" [config]="configSignal()">
        <ng-template [ngTemplateOutlet]="content"></ng-template>
      </dbx-progress-spinner-button>
    }
    <!-- Content -->
    <ng-template #content>
      <ng-content></ng-content>
    </ng-template>
  `,
  providers: provideDbxButton(DbxButtonComponent),
  imports: [DbxProgressSpinnerButtonComponent, DbxProgressBarButtonComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxButtonComponent extends AbstractDbxButtonDirective {
  readonly bar = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });

  readonly type = input<Maybe<DbxButtonType>>();
  readonly buttonStyle = input<Maybe<DbxButtonStyle>>();

  readonly color = input<ThemePalette | DbxThemeColor>(undefined);
  readonly spinnerColor = input<ThemePalette | DbxThemeColor>(undefined);
  readonly customButtonColor = input<Maybe<string>>();
  readonly customTextColor = input<Maybe<string>>();
  readonly customSpinnerColor = input<Maybe<string>>();

  readonly basic = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });
  readonly raised = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });
  readonly stroked = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });
  readonly flat = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });
  readonly iconOnly = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });
  readonly fab = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });

  readonly mode = input<Maybe<ProgressSpinnerMode>>();

  readonly typeSignal = computed(() => {
    const style = this.buttonStyle();
    let type = this.type() ?? style?.type;

    if (!type) {
      type = 'basic';

      if (this.raised()) {
        type = 'raised';
      } else if (this.stroked()) {
        type = 'stroked';
      } else if (this.flat()) {
        type = 'flat';
      } else if (this.iconOnly()) {
        type = 'icon';
      }
    }

    return type;
  });

  readonly configSignal = computed<DbxProgressButtonConfig>(() => {
    // configure custom style
    const customStyle = {} as {
      [key: string]: string;
    };

    const buttonStyle = this.buttonStyle();
    const customButtonColorValue = this.customButtonColor() ?? buttonStyle?.customButtonColor;

    if (customButtonColorValue) {
      customStyle['background'] = customButtonColorValue;
    }

    const customTextColorValue = this.customTextColor() ?? buttonStyle?.customTextColor;

    if (customTextColorValue) {
      customStyle['color'] = customTextColorValue;
    }

    const customSpinnerColorValue = this.customSpinnerColor() ?? buttonStyle?.customSpinnerColor;
    const customSpinnerColor: Maybe<string> = customSpinnerColorValue ?? customTextColorValue;

    const buttonColor = this.color() ?? buttonStyle?.color;
    const spinnerColor = this.spinnerColor() ?? buttonStyle?.spinnerColor ?? buttonColor;

    const disabledSignalValue = this.disabledSignal();
    const disabled = !this.isWorkingSignal() && disabledSignalValue; // Only disabled if we're not working, in order to show the animation.

    const iconValue = this.iconSignal();
    const buttonIcon = iconValue ? { fontIcon: iconValue } : undefined;

    const textValue = this.textSignal();
    const isIconOnlyButton = buttonIcon && !textValue;
    const fab = this.fab() || buttonStyle?.fab;

    const mode = this.mode() ?? buttonStyle?.mode;
    const working = this.workingSignal();
    const buttonType = this.typeSignal();

    const config: Configurable<DbxProgressButtonConfig> = {
      fab,
      working,
      buttonIcon,
      customStyle,
      customClass: 'dbx-button ' + (isIconOnlyButton ? 'dbx-button-no-text' : ''),
      text: textValue ?? '',
      buttonType,
      buttonColor,
      barColor: 'accent',
      mode,
      spinnerColor,
      customSpinnerColor,
      disabled
    };

    return config;
  });
}
