import { Component, Input } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { ProvideDbNgxButton, AbstractDbNgxButtonDirective } from '@dereekb/dbx-core';
import { MatProgressButtonOptions } from 'mat-progress-buttons';

export enum DbNgxButtonDisplayType {
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
  // TODO: styleUrls: ['./button.scss'],
  providers: ProvideDbNgxButton(DbNgxButtonComponent)
})
export class DbNgxButtonComponent extends AbstractDbNgxButtonDirective {

  @Input()
  type?: DbNgxButtonDisplayType;

  @Input()
  get raised(): boolean {
    return this.type === DbNgxButtonDisplayType.RAISED;
  }

  set raised(raised: boolean) {
    if (raised) {
      this.type = DbNgxButtonDisplayType.RAISED;
    }
  }

  @Input()
  get stroked(): boolean {
    return this.type === DbNgxButtonDisplayType.STROKED;
  }

  set stroked(stroked: boolean) {
    if (stroked) {
      this.type = DbNgxButtonDisplayType.STROKED;
    }
  }

  @Input()
  get flat(): boolean {
    return this.type === DbNgxButtonDisplayType.FLAT;
  }

  set flat(flat: boolean) {
    if (flat) {
      this.type = DbNgxButtonDisplayType.FLAT;
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
