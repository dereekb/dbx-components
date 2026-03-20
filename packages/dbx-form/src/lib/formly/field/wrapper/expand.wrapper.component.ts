import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractFormExpandSectionWrapperDirective, type AbstractFormExpandSectionConfig } from './expand.wrapper.delegate';

/**
 * The visual style of the expand button: a styled button or plain text link.
 */
export type DbxFormExpandWrapperButtonType = 'button' | 'text';

/**
 * Configuration for the expand wrapper, extending the base expand section config
 * with an optional button type.
 */
export interface DbxFormExpandWrapperConfig<T extends object = object> extends AbstractFormExpandSectionConfig<T> {
  /**
   * Visual style of the expand trigger. Defaults to `'button'`.
   */
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
      <span class="dbx-form-expand-wrapper-button" tabindex="0" role="button" (click)="open()" (keydown.enter)="open()" (keydown.space)="open()">{{ expandLabel }}</span>
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
