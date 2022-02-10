import { Component } from '@angular/core';
import { AbstractFormExpandableSectionWrapperDirective, AbstractFormExpandableSectionConfig } from './expandable.wrapper.delegate';

export type DbxFormExpandWrapperButtonType = 'button' | 'text';

export interface DbxFormExpandWrapperConfig<T = any> extends AbstractFormExpandableSectionConfig<T> {
  buttonType?: DbxFormExpandWrapperButtonType;
}

/**
 * Section that is expandable by a button until a value is set, or the button is pressed.
 */
@Component({
  template: `
  <ng-container [ngSwitch]="show$ | async">
    <ng-container *ngSwitchCase="true">
      <ng-container #fieldComponent></ng-container>
    </ng-container>
    <ng-container *ngSwitchCase="false">
      <span class="dbx-form-expandable-section-button" (click)="open()">{{ expandLabel }}</span>
    </ng-container>
  </ng-container>
  `
})
export class DbxFormExpandWrapperComponent
  extends AbstractFormExpandableSectionWrapperDirective<DbxFormExpandWrapperConfig> {

  get buttonType(): DbxFormExpandWrapperButtonType {
    return this.expandableSection?.buttonType ?? 'button';
  }

}
