import { Component } from '@angular/core';
import { AbstractFormExpandableSectionWrapperDirective, AbstractFormExpandableSectionConfig } from './expandable.wrapper.delegate';

export type DbxFormExpandWrapperButtonType = 'button' | 'text';

export interface DbxFormExpandWrapperConfig<T extends object = object> extends AbstractFormExpandableSectionConfig<T> {
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
        <span class="dbx-form-expand-wrapper-button" (click)="open()">{{ expandLabel }}</span>
      </ng-container>
    </ng-container>
  `
})
export class DbxFormExpandWrapperComponent<T extends object = object> extends AbstractFormExpandableSectionWrapperDirective<T, DbxFormExpandWrapperConfig<T>> {
  get buttonType(): DbxFormExpandWrapperButtonType {
    return this.expandableSection.buttonType ?? 'button';
  }
}
