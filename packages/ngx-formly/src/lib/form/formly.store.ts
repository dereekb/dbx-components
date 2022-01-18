import { FormlyFieldConfig } from '@ngx-formly/core/lib/components/formly.field.config';
import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';

export interface FormlyContextState<T> {
  initialValue?: T;
  fields: FormlyFieldConfig[];
}

@Injectable()
export class FormlyContextStore<T> extends ComponentStore<FormlyContextState<T>> {

  constructor() {
    super({
      initialValue: undefined,
      fields: []
    });
  }

}
