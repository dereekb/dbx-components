import { type DbxFormComponentFieldConfig, type DbxFormComponentFormlyFieldConfig } from './component.field.component';

export type ComponentFieldConfig<T = unknown> = DbxFormComponentFieldConfig<T>;

export function componentField<T = unknown>(config: ComponentFieldConfig<T>): DbxFormComponentFormlyFieldConfig<T> {
  return {
    type: 'component',
    componentField: config
  };
}
