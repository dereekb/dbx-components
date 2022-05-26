import { Component, Input } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { provideDbxButton, AbstractDbxButtonDirective } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import { DbxProgressButtonOptions } from './progress/button.progress.config';

export enum DbxButtonDisplayType {
  RAISED,
  STROKED,
  FLAT
}

/**
 * Complex button that supports loading states.
 */
@Component({
  selector: 'dbx-button',
  template: `
    <dbx-spinner-button class="page-button" (btnClick)="clickButton()" [options]="btnOptions">
      <ng-content></ng-content>
    </dbx-spinner-button>
  `,
  providers: provideDbxButton(DbxButtonComponent)
})
export class DbxButtonComponent extends AbstractDbxButtonDirective {
  @Input()
  type?: DbxButtonDisplayType;

  @Input()
  get raised(): boolean {
    return this.type === DbxButtonDisplayType.RAISED;
  }

  set raised(raised: boolean) {
    if (raised) {
      this.type = DbxButtonDisplayType.RAISED;
    }
  }

  @Input()
  get stroked(): boolean {
    return this.type === DbxButtonDisplayType.STROKED;
  }

  set stroked(stroked: boolean) {
    if (stroked) {
      this.type = DbxButtonDisplayType.STROKED;
    }
  }

  @Input()
  get flat(): boolean {
    return this.type === DbxButtonDisplayType.FLAT;
  }

  set flat(flat: boolean) {
    if (flat) {
      this.type = DbxButtonDisplayType.FLAT;
    }
  }

  @Input()
  public color: ThemePalette = 'primary';

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

    return {
      fab: false,
      active: this.working,
      buttonIcon,
      customStyle,
      customClass: 'dbx-button ' + (buttonIcon && !this.text ? 'dbx-button-no-text' : ''),
      // buttonIcon: icon,
      text: this.text ?? '',
      buttonColor: this.color,
      barColor: 'accent',
      raised: this.raised,
      stroked: this.stroked,
      flat: this.flat,
      mode: 'indeterminate',
      spinnerColor: this.color === 'primary' ? 'accent' : 'primary',
      customSpinnerColor,
      disabled
    };
  }
}
