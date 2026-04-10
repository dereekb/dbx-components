import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type DbxInjectionComponentConfig, DbxInjectionComponent } from '@dereekb/dbx-core';
import { type FieldTree } from '@angular/forms/signals';
import { type DynamicText, type FieldMeta, type ValidationMessages, type BaseValueField } from '@ng-forge/dynamic-forms';
import { type Maybe } from '@dereekb/util';

// MARK: Forge Component Field Props
/**
 * The custom forge field type name for the component field.
 */
export const FORGE_COMPONENT_FIELD_TYPE = 'dbx-component' as const;

/**
 * Props interface for the forge component field.
 *
 * Passed via the `props` property on the forge field definition.
 * Contains the {@link DbxInjectionComponentConfig} for rendering an arbitrary Angular component.
 */
export interface ForgeComponentFieldProps<T = unknown> {
  /**
   * The injection component configuration that describes which component to render.
   */
  readonly componentField: DbxInjectionComponentConfig<T>;
}

/**
 * Forge field definition interface for the component field.
 */
export interface ForgeComponentFieldDef<T = unknown> extends BaseValueField<ForgeComponentFieldProps<T>, unknown> {
  readonly type: typeof FORGE_COMPONENT_FIELD_TYPE;
}

/**
 * Forge ValueFieldComponent that renders a custom Angular component via dynamic injection.
 *
 * Uses {@link DbxInjectionComponent} to instantiate the component class specified in the
 * field's `props.componentField` configuration. This is the forge equivalent of
 * the formly `DbxFormComponentFieldComponent`.
 */
@Component({
  selector: 'dbx-forge-component-field',
  template: `
    <div class="dbx-form-component" dbx-injection [config]="configSignal()"></div>
  `,
  imports: [DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[class]': 'className()'
  }
})
export class DbxForgeComponentFieldComponent<T = unknown> {
  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<unknown>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<ForgeComponentFieldProps<T> | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  readonly configSignal = computed((): Maybe<DbxInjectionComponentConfig<T>> => {
    return this.props()?.componentField;
  });
}
