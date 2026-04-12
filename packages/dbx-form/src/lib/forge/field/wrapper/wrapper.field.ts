import { computed, Directive, effect, forwardRef, inject, input, signal, untracked, type Provider, type Signal, type Type, type WritableSignal } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import type { DynamicText, FieldDef, FieldMeta, FormConfig, ValidationMessages } from '@ng-forge/dynamic-forms';
import { DbxForgeFormContext } from '../../form/forge.context';
import { Maybe } from '@dereekb/util';

/**
 * Base props interface for forge wrapper fields that contain child field definitions.
 *
 * All wrapper field props must include a `fields` array. Concrete wrapper types
 * extend this with additional configuration (e.g. header config for sections).
 */
export interface DbxForgeWrapperFieldProps {
  /**
   * Child field definitions to render inside the wrapper.
   */
  readonly field?: Maybe<FieldDef<unknown>>;
  /**
   * Child field definitions to render inside the wrapper.
   */
  readonly fields?: Maybe<FieldDef<unknown>[]>;
}

/**
 * Abstract DI token for forge wrapper field directives.
 *
 * Exposes the child form config and value signals that
 * {@link DbxForgeWrapperContentComponent} needs to render the nested `DynamicForm`.
 * Concrete wrapper components extend {@link AbstractForgeWrapperFieldComponent}
 * and register themselves via {@link provideDbxForgeWrapperFieldDirective}.
 */
@Directive()
export abstract class DbxForgeWrapperFieldDirective {
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
 * as a {@link DbxForgeWrapperFieldDirective} for DI.
 *
 * @param sourceType - The concrete wrapper component class to provide.
 * @returns An array of Angular providers.
 *
 * @example
 * ```typescript
 * @Component({
 *   providers: provideDbxForgeWrapperFieldDirective(DbxForgeDbxSectionFieldWrapperComponent),
 *   ...
 * })
 * export class DbxForgeDbxSectionFieldWrapperComponent extends AbstractForgeWrapperFieldComponent<DbxForgeSectionFieldProps> {}
 * ```
 */
export function provideDbxForgeWrapperFieldDirective<S extends DbxForgeWrapperFieldDirective>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: DbxForgeWrapperFieldDirective,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}

/**
 * Abstract base class for forge wrapper field components.
 *
 * Provides the standard ng-forge ValueFieldComponent inputs and manages
 * two-way value synchronization between the parent field tree and a nested
 * `DynamicForm` rendered by {@link DbxForgeWrapperContentComponent}.
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
 *   providers: provideDbxForgeWrapperFieldDirective(DbxForgeDbxSectionFieldWrapperComponent),
 *   ...
 * })
 * export class DbxForgeDbxSectionFieldWrapperComponent extends AbstractForgeWrapperFieldComponent<DbxForgeSectionFieldProps> { ... }
 * ```
 */
@Directive()
export abstract class AbstractForgeWrapperFieldComponent<TProps extends DbxForgeWrapperFieldProps> extends DbxForgeWrapperFieldDirective {
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
    const field = this.props()?.field;
    const fields = this.props()?.fields ?? [];
    const parentConfig = this._parentContext?.config;

    return {
      fields: field ? [field] : fields,
      customFnConfig: parentConfig?.customFnConfig,
      defaultValidationMessages: parentConfig?.defaultValidationMessages
    } as unknown as FormConfig;
  });

  private _initialized = false;

  /**
   * Tracks the last value reference synced from parent → child.
   * Used to prevent the child → parent sync effect from re-writing a value
   * that originated from the parent, avoiding infinite update loops.
   */
  private _lastParentSyncRef: unknown;

  constructor() {
    super();

    // Sync parent field tree value → child form value (continuous).
    // Fires on initialization and whenever the parent value changes externally
    // (e.g. via context.setValue()), ensuring the child form always reflects
    // the current parent value and can validate it correctly.
    effect(() => {
      const fieldState = this.field()();
      const currentValue = fieldState.value();

      untracked(() => {
        if (currentValue != null || this._initialized) {
          this._initialized = true;
          this._lastParentSyncRef = currentValue;
          this.childValueSignal.set(currentValue as Record<string, unknown>);
        }
      });
    });

    // Sync child form value changes → parent field tree
    effect(() => {
      const childValue = this.childValueSignal();

      untracked(() => {
        // Only sync when initialized and when the value didn't originate from a parent → child sync
        if (this._initialized && childValue !== this._lastParentSyncRef) {
          const fieldState = this.field()();
          fieldState.value.set(childValue ?? {});
          fieldState.markAsTouched();
          fieldState.markAsDirty();
        }
      });
    });
  }
}
