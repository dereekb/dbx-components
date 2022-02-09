import { Component } from '@angular/core';
import { AbstractFormExpandableSectionWrapperDirective, AbstractFormExpandableSectionConfig } from './expandable.wrapper.delegate';

export type FormExpandableSectionWrapperButtonType = 'button' | 'text';

export interface FormExpandableSectionConfig<T = any> extends AbstractFormExpandableSectionConfig<T> {
  buttonType: FormExpandableSectionWrapperButtonType;
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
      <span class="form-expandable-section-button" (click)="open()">{{ expandLabel }}</span>
    </ng-container>
  </ng-container>
  `
})
export class FormExpandableSectionWrapperComponent
  extends AbstractFormExpandableSectionWrapperDirective<FormExpandableSectionConfig> {

  get buttonType(): FormExpandableSectionWrapperButtonType {
    return this.expandableSection?.buttonType ?? 'button';
  }

}
