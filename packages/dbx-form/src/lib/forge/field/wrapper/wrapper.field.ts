import { computed, Directive, effect, input, signal, untracked, type Signal } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import type { DynamicText, FieldDef, FieldMeta, FormConfig, ValidationMessages } from '@ng-forge/dynamic-forms';

/**
 * Base props interface for forge wrapper fields that contain child field definitions.
 *
 * All wrapper field props must include a `fields` array. Concrete wrapper types
 * extend this with additional configuration (e.g. header config for sections).
 */
export interface ForgeWrapperFieldProps {
  /**
   * Child field definitions to render inside the wrapper.
   */
  readonly fields: FieldDef<unknown>[];
}

/**
 * Abstract base class for forge wrapper field components.
 *
 * Provides the standard ng-forge ValueFieldComponent inputs and manages
 * two-way value synchronization between the parent field tree and a nested
 * `DynamicForm` rendered by {@link ForgeWrapperContentComponent}.
 *
 * Subclasses only need to define their template, wrapping
 * `<dbx-forge-wrapper-content>` with whatever layout component they need
 * (e.g. `<dbx-section>`, `<dbx-subsection>`).
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     <dbx-section [headerConfig]="headerConfigSignal()">
 *       <dbx-forge-wrapper-content [config]="childConfigSignal()" [(value)]="childValueSignal" />
 *     </dbx-section>
 *   `,
 *   ...
 * })
 * export class ForgeSectionFieldComponent extends AbstractForgeWrapperFieldComponent<ForgeSectionFieldProps> { ... }
 * ```
 */
@Directive()
export abstract class AbstractForgeWrapperFieldComponent<TProps extends ForgeWrapperFieldProps> {
  // MARK: ng-forge ValueFieldComponent Inputs
  readonly field = input.required<FieldTree<Record<string, unknown>>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<TProps | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  // MARK: Child Form State
  /**
   * The current value of the nested child form. Two-way bound to
   * `ForgeWrapperContentComponent` via `[(value)]`.
   */
  readonly childValueSignal = signal<Record<string, unknown> | undefined>(undefined);

  /**
   * FormConfig derived from the wrapper's `props.fields`.
   * Passed to `ForgeWrapperContentComponent` via `[config]`.
   */
  readonly childConfigSignal: Signal<FormConfig> = computed(() => {
    const fields = this.props()?.fields;

    if (!fields || fields.length === 0) {
      return { fields: [] } as unknown as FormConfig;
    }

    return { fields } as unknown as FormConfig;
  });

  private _initialized = false;

  constructor() {
    // Initialize child value from parent field tree on first read
    effect(() => {
      const fieldState = this.field()();
      const currentValue = fieldState.value();

      if (!this._initialized && currentValue != null) {
        this._initialized = true;
        untracked(() => {
          this.childValueSignal.set(currentValue as Record<string, unknown>);
        });
      }
    });

    // Sync child value changes back to the parent field tree
    effect(() => {
      const childValue = this.childValueSignal();

      untracked(() => {
        if (!this._initialized) {
          return;
        }

        const fieldState = this.field()();
        fieldState.value.set(childValue ?? {});
        fieldState.markAsTouched();
        fieldState.markAsDirty();
      });
    });
  }
}
