import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';
import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { EnumValueFieldOption } from './enum';

export interface EnumValueFieldsFieldConfig<T> {
  getEnums: () => Observable<EnumValueFieldOption<T>[]>;
}

export interface EnumValueFieldsFormlyFieldConfig<T> extends EnumValueFieldsFieldConfig<T>, FormlyFieldConfig { }

@Component({
  templateUrl: 'dynamic.enum.field.component.html',
  // TODO: styleUrls: ['./generic.scss']
})
export class DbNgxDynamicEnumFieldComponent<T> extends FieldType<EnumValueFieldsFormlyFieldConfig<T>> {

  // TODO: ...

}
