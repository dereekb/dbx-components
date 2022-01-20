import { Type } from "@angular/core";
import { FormComponentFieldWrappedComponent, FormComponentFieldFieldConfig } from "./component.field.component";

export interface ComponentFieldConfig<T> {
  componentClass: Type<T>;
}

export function componentField<T extends FormComponentFieldWrappedComponent>({ componentClass }: ComponentFieldConfig<T>): FormComponentFieldFieldConfig<T> {
  return {
    type: 'component',
    componentClass
  };
}
