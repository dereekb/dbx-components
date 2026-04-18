import { ChangeDetectionStrategy, Component, computed, input, viewChild, ViewContainerRef } from '@angular/core';
import { type FieldWrapperContract, WrapperFieldInputs } from '@ng-forge/dynamic-forms';
import { DynamicTextPipe } from '@ng-forge/dynamic-forms';
import { AsyncPipe } from '@angular/common';
import { DbxForgeArrayFieldWrapperProps } from './array-field.wrapper';

/**
 * Forge wrapper component that wraps an ng-forge `array` field with
 * a section header (label + hint/description).
 *
 * Add/remove buttons and per-item rendering are handled by ng-forge's
 * built-in array field component. This wrapper only provides the outer
 * section chrome.
 */
@Component({
  selector: 'dbx-forge-array-field-wrapper',
  templateUrl: './array-field.wrapper.component.html',
  imports: [DynamicTextPipe, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeArrayFieldWrapperComponent implements FieldWrapperContract {
  readonly fieldComponent = viewChild.required('fieldComponent', { read: ViewContainerRef });

  readonly fieldInputs = input<WrapperFieldInputs>();

  private readonly wrapperProps = computed(() => (this.fieldInputs()?.props ?? {}) as DbxForgeArrayFieldWrapperProps);

  readonly labelSignal = computed(() => this.wrapperProps().label ?? '');
  readonly hintSignal = computed(() => this.wrapperProps().hint ?? '');
}
