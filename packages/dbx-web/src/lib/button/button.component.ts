import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { provideDbxButton, AbstractDbxButtonDirective } from '@dereekb/dbx-core';
import { Configurable, isDefinedAndNotFalse, type Maybe } from '@dereekb/util';
import { DbxProgressButtonConfig } from './progress/button.progress.config';
import { type DbxThemeColor } from '../layout/style/style';
import { DbxProgressSpinnerButtonComponent } from './progress';

export type DbxButtonType = 'basic' | 'raised' | 'stroked' | 'flat' | 'icon';

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
    <dbx-progress-spinner-button (btnClick)="clickButton()" [config]="configSignal()">
      <ng-content></ng-content>
    </dbx-progress-spinner-button>
  `,
  providers: provideDbxButton(DbxButtonComponent),
  imports: [DbxProgressSpinnerButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxButtonComponent extends AbstractDbxButtonDirective {
  readonly type = input<Maybe<DbxButtonType>>();

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

  readonly typeSignal = computed(() => {
    let type = this.type();

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

    const customButtonColorValue = this.customButtonColor();

    if (customButtonColorValue) {
      customStyle['background'] = customButtonColorValue;
    }

    const customTextColorValue = this.customTextColor();

    if (customTextColorValue) {
      customStyle['color'] = customTextColorValue;
    }

    const customSpinnerColorValue = this.customSpinnerColor();
    const customSpinnerColor: Maybe<string> = customSpinnerColorValue ?? customTextColorValue;

    const disabledSignalValue = this.disabledSignal();
    const disabled = !this.workingSignal() && disabledSignalValue; // Only disabled if we're not working, in order to show the animation.

    const iconValue = this.iconSignal();
    const buttonIcon = iconValue ? { fontIcon: iconValue } : undefined;

    const textValue = this.textSignal();
    const isIconOnlyButton = buttonIcon && !textValue;

    const config: Configurable<DbxProgressButtonConfig> = {
      fab: this.fab(),
      working: this.workingSignal(),
      buttonIcon,
      customStyle,
      customClass: 'dbx-button ' + (isIconOnlyButton ? 'dbx-button-no-text' : ''),
      text: textValue ?? '',
      buttonType: this.typeSignal(),
      buttonColor: this.color(),
      barColor: 'accent',
      mode: 'indeterminate',
      spinnerColor: this.spinnerColor() ?? this.color(),
      customSpinnerColor,
      disabled
    };

    return config;
  });
}
