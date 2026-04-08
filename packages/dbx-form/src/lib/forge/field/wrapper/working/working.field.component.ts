import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { type FieldTree } from '@angular/forms/signals';
import type { DynamicText, FieldMeta, ValidationMessages } from '@ng-forge/dynamic-forms';
import type { ForgeWorkingFieldProps } from './working.field';

/**
 * Forge ValueFieldComponent that renders a loading indicator.
 *
 * Displays a Material indeterminate progress bar when the watched field's
 * FieldTree indicates a pending validation state. The component monitors
 * its own field tree's pending signal as a proxy for async validation status.
 *
 * Note: In the current implementation, the progress bar visibility is driven
 * by the component's own FieldTree pending state. Full integration with a
 * sibling field's validation state requires access to the parent form's FieldTree,
 * which can be added when the use case arises.
 */
@Component({
  selector: 'dbx-forge-working-field',
  template: `
    @if (showLoadingSignal()) {
      <mat-progress-bar mode="indeterminate" class="dbx-forge-working-bar"></mat-progress-bar>
    }
  `,
  styles: `
    :host {
      display: block;
      min-height: 4px;
    }

    .dbx-forge-working-bar {
      margin-top: 4px;
    }
  `,
  imports: [MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[class]': 'className()'
  }
})
export class ForgeWorkingFieldComponent {
  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<unknown>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<ForgeWorkingFieldProps | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  readonly showLoadingSignal = computed((): boolean => {
    const fieldState = this.field()();
    return fieldState.pending?.() ?? false;
  });
}
