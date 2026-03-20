import { Component, ChangeDetectionStrategy } from '@angular/core';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { FieldType, type FormlyFieldConfig } from '@ngx-formly/core';

/**
 * Configuration for the custom component to inject into the form field. Alias for {@link DbxInjectionComponentConfig}.
 */
export type DbxFormComponentFieldConfig<T> = DbxInjectionComponentConfig<T>;

/**
 * Formly field config extended with a {@link DbxFormComponentFieldConfig} for custom component rendering.
 */
export interface DbxFormComponentFormlyFieldConfig<T = unknown> extends FormlyFieldConfig {
  componentField: DbxFormComponentFieldConfig<T>;
}

/**
 * Formly field component that renders a custom Angular component via dynamic injection.
 *
 * Uses {@link DbxInjectionComponent} to instantiate the component class specified in the field's
 * `componentField` configuration.
 */
@Component({
  template: `
    <div class="dbx-form-component" dbx-injection [config]="config"></div>
  `,
  imports: [DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFormComponentFieldComponent<T = unknown> extends FieldType<DbxFormComponentFormlyFieldConfig<T>> {
  get config(): DbxInjectionComponentConfig<T> {
    return this.field.componentField;
  }
}
