import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractFormExpandSectionWrapperDirective, AbstractFormExpandSectionConfig } from './expand.wrapper.delegate';

export type DbxFormExpandWrapperButtonType = 'button' | 'text';

export interface DbxFormExpandWrapperConfig<T extends object = object> extends AbstractFormExpandSectionConfig<T> {
  readonly buttonType?: DbxFormExpandWrapperButtonType;
}

/**
 * Section that is expandable by a button until a value is set, or the button is pressed.
 */
@Component({
  template: `
    @if (showSignal()) {
      <ng-container #fieldComponent></ng-container>
    } @else {
      <span class="dbx-form-expand-wrapper-button" (click)="open()">{{ expandLabel }}</span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFormExpandWrapperComponent<T extends object = object> extends AbstractFormExpandSectionWrapperDirective<T, DbxFormExpandWrapperConfig<T>> {
  get buttonType(): DbxFormExpandWrapperButtonType {
    return this.expandSection.buttonType ?? 'button';
  }
}
