import { FormlyFieldConfig } from '@ngx-formly/core/lib/core';
import {
  Component, ElementRef, OnDestroy, OnInit, Type, ViewChild, ViewContainerRef
} from '@angular/core';
import { Observable } from 'rxjs';
import { FieldType } from '@ngx-formly/core';
import { EnumValueFieldOption } from './enum';

export interface EnumValueFieldsFieldConfig<T> {
  getEnums: () => Observable<EnumValueFieldOption<T>[]>;
}

export interface EnumValueFieldsFormlyFieldConfig<T> extends EnumValueFieldsFieldConfig<T>, FormlyFieldConfig { }

@Component({
  templateUrl: 'dynamic.enum.field.component.html',
  styleUrls: ['./generic.scss']
})
export class DbNgxDynamicEnumFieldComponent<T> extends FieldType<EnumValueFieldsFormlyFieldConfig<T>> {

  // TODO: ...

}
