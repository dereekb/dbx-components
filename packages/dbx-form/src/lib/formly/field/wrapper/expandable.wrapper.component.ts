import { Component } from '@angular/core';
import { FormExpandableSectionFormlyConfig, AbstractFormExpandableSectionWrapperDirective } from './expandable.wrapper.delegate';

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
export class FormExpandableSectionWrapperComponent<T = any, F extends FormExpandableSectionFormlyConfig<T> = FormExpandableSectionFormlyConfig<T>>
  extends AbstractFormExpandableSectionWrapperDirective<T, F> {

}
