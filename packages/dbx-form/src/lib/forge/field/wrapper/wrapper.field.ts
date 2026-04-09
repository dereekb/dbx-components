import { computed, Directive, effect, forwardRef, inject, input, signal, untracked, type Provider, type Signal, type Type, type WritableSignal } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import type { DynamicText, FieldDef, FieldMeta, FormConfig, ValidationMessages } from '@ng-forge/dynamic-forms';
import { DbxForgeFormContext } from '../../form/forge.context';

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
 * Abstract DI token for forge wrapper field directives.
 *
 * Exposes the child form config and value signals that
 * {@link ForgeWrapperContentComponent} needs to render the nested `DynamicForm`.
 * Concrete wrapper components extend {@link AbstractForgeWrapperFieldComponent}
 * and register themselves via {@link provideDbxForgeWrapperFieldDirective}.
 */
@Directive()
export abstract class ForgeWrapperFieldDirective {
  /**
   * FormConfig derived from the wrapper's child field definitions.
   */
  abstract readonly childConfigSignal: Signal<FormConfig>;

  /**
   * The current value of the nested child form.
   */
  abstract readonly childValueSignal: WritableSignal<Record<string, unknown> | undefined>;
}

/**
 * Creates Angular providers that register a concrete wrapper field component
 * as a {@link ForgeWrapperFieldDirective} for DI.
 *
 * @param sourceType - The concrete wrapper component class to provide.
 * @returns An array of Angular providers.
 *
 * @example
 * ```typescript
 * @Component({
 *   providers: provideDbxForgeWrapperFieldDirective(ForgeDbxSectionFieldWrapperComponent),
 *   ...
 * })
 * export class ForgeDbxSectionFieldWrapperComponent extends AbstractForgeWrapperFieldComponent<ForgeSectionFieldProps> {}
 * ```
 */
export function provideDbxForgeWrapperFieldDirective<S extends ForgeWrapperFieldDirective>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: ForgeWrapperFieldDirective,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}

/**
 * Abstract base class for forge wrapper field components.
 *
 * Provides the standard ng-forge ValueFieldComponent inputs and manages
 * two-way value synchronization between the parent field tree and a nested
 * `DynamicForm` rendered by {@link ForgeWrapperContentComponent}.
 *
 * Subclasses only need to define their template, placing
 * `<dbx-forge-wrapper-content />` inside their layout component
 * (e.g. `<dbx-section>`, `<dbx-subsection>`). The content component
 * automatically picks up config and value via DI.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     <dbx-section [headerConfig]="headerConfigSignal()">
 *       <dbx-forge-wrapper-content />
 *     </dbx-section>
 *   `,
 *   providers: provideDbxForgeWrapperFieldDirective(ForgeDbxSectionFieldWrapperComponent),
 *   ...
 * })
 * export class ForgeDbxSectionFieldWrapperComponent extends AbstractForgeWrapperFieldComponent<ForgeSectionFieldProps> { ... }
 * ```
 */
@Directive()
export abstract class AbstractForgeWrapperFieldComponent<TProps extends ForgeWrapperFieldProps> extends ForgeWrapperFieldDirective {
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
  private readonly _parentContext = inject(DbxForgeFormContext, { optional: true });

  readonly childValueSignal = signal<Record<string, unknown> | undefined>(undefined);

  readonly childConfigSignal: Signal<FormConfig> = computed(() => {
    const fields = this.props()?.fields;

    if (!fields || fields.length === 0) {
      return { fields: [] } as unknown as FormConfig;
    }

    const parentConfig = this._parentContext?.config;

    return {
      fields,
      customFnConfig: parentConfig?.customFnConfig,
      defaultValidationMessages: parentConfig?.defaultValidationMessages
    } as unknown as FormConfig;
  });

  private _initialized = false;

  constructor() {
    super();

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
