import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { provideDbxButton, AbstractDbxButtonDirective } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import { DbxProgressButtonOptions } from './progress/button.progress.config';
import { DbxThemeColor } from '../layout/style/style';

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
    <dbx-spinner-button (btnClick)="clickButton()" [options]="btnOptions">
      <ng-content></ng-content>
    </dbx-spinner-button>
  `,
  providers: provideDbxButton(DbxButtonComponent),
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxButtonComponent extends AbstractDbxButtonDirective {
  @Input()
  type?: DbxButtonType;

  @Input()
  get basic(): boolean {
    return !this.type || this.type === 'basic';
  }

  set basic(basic: boolean) {
    if (basic) {
      this.type = 'basic';
    }
  }

  @Input()
  get raised(): boolean {
    return this.type === 'raised';
  }

  set raised(raised: boolean) {
    if (raised) {
      this.type = 'raised';
    }
  }

  @Input()
  get stroked(): boolean {
    return this.type === 'stroked';
  }

  set stroked(stroked: boolean) {
    if (stroked) {
      this.type = 'stroked';
    }
  }

  @Input()
  get flat(): boolean {
    return this.type === 'flat';
  }

  set flat(flat: boolean) {
    if (flat) {
      this.type = 'flat';
    }
  }

  @Input()
  get iconOnly(): boolean {
    return this.type === 'icon';
  }

  set iconOnly(iconOnly: boolean) {
    if (iconOnly) {
      this.type = 'icon';
    }
  }

  @Input()
  public color: ThemePalette | DbxThemeColor = undefined;

  @Input()
  public spinnerColor: ThemePalette | DbxThemeColor = undefined;

  @Input()
  public customButtonColor: Maybe<string>;

  @Input()
  public customTextColor: Maybe<string>;

  @Input()
  public customSpinnerColor: Maybe<string>;

  public get btnOptions(): DbxProgressButtonOptions {
    const buttonIcon = this.icon
      ? {
          fontIcon: this.icon
        }
      : undefined;

    const customStyle = {} as {
      [key: string]: string;
    };

    if (this.customButtonColor) {
      customStyle['background'] = this.customButtonColor;
    }

    if (this.customTextColor) {
      customStyle['color'] = this.customTextColor;
    }

    const customSpinnerColor: Maybe<string> = this.customSpinnerColor ?? this.customTextColor;
    const disabled = !this.working && this.disabled; // Only disabled if we're not working, in order to show the animation.

    const isIconOnlyButton = buttonIcon && !this.text;

    return {
      fab: false,
      working: this.working,
      buttonIcon,
      customStyle,
      customClass: 'dbx-button ' + (isIconOnlyButton ? 'dbx-button-no-text' : ''),
      text: this.text ?? '',
      buttonColor: this.color,
      barColor: 'accent',
      raised: this.raised,
      stroked: this.stroked,
      flat: this.flat,
      iconOnly: this.iconOnly,
      mode: 'indeterminate',
      spinnerColor: this.spinnerColor ?? this.color,
      customSpinnerColor,
      disabled
    };
  }
}
