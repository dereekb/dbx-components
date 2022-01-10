import { Component, OnInit, OnDestroy, Input, NgZone } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { MatProgressButtonOptions } from 'mat-progress-buttons';
import { DbNgxButtonDirective, ProvideDbNgxButtonDirective } from './button.directive';

export enum AppButtonDisplayType {
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
    <mat-spinner-button class="page-button" (btnClick)="clickButton()" [options]="btnOptions"></mat-spinner-button>
  `,
  styleUrls: ['./button.scss'],
  providers: ProvideDbNgxButtonDirective(DbNgxButtonComponent)
})
export class DbNgxButtonComponent extends DbNgxButtonDirective {

  @Input()
  type?: AppButtonDisplayType;

  @Input()
  get raised(): boolean {
    return this.type === AppButtonDisplayType.RAISED;
  }

  set raised(raised: boolean) {
    if (raised) {
      this.type = AppButtonDisplayType.RAISED;
    }
  }

  @Input()
  get stroked(): boolean {
    return this.type === AppButtonDisplayType.STROKED;
  }

  set stroked(stroked: boolean) {
    if (stroked) {
      this.type = AppButtonDisplayType.STROKED;
    }
  }

  @Input()
  get flat(): boolean {
    return this.type === AppButtonDisplayType.FLAT;
  }

  set flat(flat: boolean) {
    if (flat) {
      this.type = AppButtonDisplayType.FLAT;
    }
  }

  @Input()
  public color: ThemePalette = 'primary';

  public get btnOptions(): MatProgressButtonOptions {
    const buttonIcon = (this.icon) ? {
      fontIcon: this.icon
    } : undefined;

    return {
      fab: false,
      active: this.working,
      buttonIcon,
      customClass: 'dbx-button ' + ((buttonIcon && !this.text) ? 'dbx-button-no-text' : ''),
      // buttonIcon: icon,
      text: this.text ?? '',
      buttonColor: this.color,
      barColor: 'accent',
      raised: this.raised,
      stroked: this.stroked,
      flat: this.flat,
      mode: 'indeterminate',
      spinnerSize: 18,
      spinnerColor: 'accent', // TODO: Set spinner color to opposite of button color.
      // Only disabled if we're not working, in order to show the animation.
      disabled: !this.working && this.disabled
    };
  }

}
