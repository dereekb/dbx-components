import { FormlyFieldConfig } from "@ngx-formly/core";
import { of } from "rxjs";
import { FieldConfig, formlyField } from "../../field";
import { SearchableValueFieldValue } from "./searchable";
import { StringValueFieldsFieldConfig, StringValueFieldsFormlyFieldConfig } from "./searchable.field.component";

export interface ChipTextFieldConfig extends FieldConfig, StringValueFieldsFieldConfig { }
export interface ChipTextFieldFormlyConfig extends StringValueFieldsFormlyFieldConfig, FormlyFieldConfig {
  caseSensitive?: boolean;
}

export function chipTextField<C extends ChipTextFieldFormlyConfig>(config: C): C {
  const convertStringValue = (config.caseSensitive) ? ((x: string) => x) : ((x: string) => x?.toLowerCase());

  return formlyField<C>({
    type: 'searchablechipfield',
    allowStringValues: true,
    convertStringValue,
    ...config,
    displayForValue: (values: SearchableValueFieldValue<string>[]) => {
      return of(values.map(x => ({ ...x, label: x.value })));
    }
  });
}
