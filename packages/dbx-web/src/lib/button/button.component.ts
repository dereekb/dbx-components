import { Component, Input } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { ProvideDbxButton, AbstractDbxButtonDirective } from '@dereekb/dbx-core';
import { MatProgressButtonOptions } from 'mat-progress-buttons';

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
    <mat-spinner-button class="page-button" (btnClick)="clickButton()" [options]="btnOptions"></mat-spinner-button>
  `,
  // TODO: styleUrls: ['./button.scss'],
  providers: ProvideDbxButton(DbxButtonComponent)
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
