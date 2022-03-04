import { DbxFormComponentFieldConfig, DbxFormComponentFormlyFieldConfig } from "./component.field.component";

export interface ComponentFieldConfig<T = any> extends DbxFormComponentFieldConfig<T> { }

export function componentField<T>(config: ComponentFieldConfig<T>): DbxFormComponentFormlyFieldConfig {
  return {
    type: 'component',
    componentField: config
  };
}
