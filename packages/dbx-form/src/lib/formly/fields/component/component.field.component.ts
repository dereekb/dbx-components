import { Component, OnInit, Type } from '@angular/core';
import { DbxInjectedComponentConfig } from '@dereekb/dbx-core';
import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';
import { Maybe } from '@dereekb/util';

export interface FormComponentFieldWrappedComponent {
  field: FieldType<FormComponentFieldFieldConfig>;
}

export abstract class AbstractFormComponentFieldWrappedComponent implements FormComponentFieldWrappedComponent {
  abstract field: FieldType<FormComponentFieldFieldConfig>;
}

export interface FormComponentFieldFieldConfig<T extends FormComponentFieldWrappedComponent = any> extends FormlyFieldConfig {
  componentClass: Type<T>;
}

@Component({
  template: `
    <div class="form-wrapped-component" dbx-injected-content [config]="config"></div>
  `,
  // TODO: styleUrls: ['./fields.scss']
})
export class FormComponentFieldComponent<T extends FormComponentFieldWrappedComponent = any> extends FieldType<FormComponentFieldFieldConfig<T>> implements OnInit {

  private _config?: DbxInjectedComponentConfig;

  get config(): Maybe<DbxInjectedComponentConfig> {
    return this._config;
  }

  constructor() {
    super();
  }

  ngOnInit(): void {
    this._config = {
      componentClass: this.field.componentClass,
      init: (instance: FormComponentFieldWrappedComponent) => {
        instance.field = this;
      }
    };
  }

}
