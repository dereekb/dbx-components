import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { type FieldTree } from '@angular/forms/signals';
import type { DynamicText, FieldMeta, ValidationMessages } from '@ng-forge/dynamic-forms';
import { DbxForgeFormContext } from '../../../form/forge.context';
import type { ForgeAutoTouchFieldProps } from './autotouch.field';

/**
 * Forge ValueFieldComponent that implements auto-touch behavior.
 *
 * This is a hidden component with no visual output. It monitors the form's
 * value signal and marks the watched field as touched when its value changes
 * and the field is not pristine. This triggers validation message display.
 *
 * Injected into the form via the standard ng-forge field rendering pipeline,
 * but renders nothing (hidden: true on the field definition).
 */
@Component({
  selector: 'dbx-forge-autotouch-field',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class ForgeAutoTouchFieldComponent {
  private readonly _forgeContext = inject(DbxForgeFormContext, { optional: true });

  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<unknown>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<ForgeAutoTouchFieldProps | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  constructor() {
    // Monitor the field tree value and mark as touched when it changes
    effect(() => {
      const fieldState = this.field()();
      const value = fieldState.value();

      // Reading value registers the signal dependency.
      // If there's a value and the field is dirty, mark as touched.
      if (value !== undefined && fieldState.dirty?.()) {
        fieldState.markAsTouched();
      }
    });
  }
}
