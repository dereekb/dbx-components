import {
  Component, ComponentFactoryResolver, OnInit, Type, ViewChild, ViewContainerRef
} from '@angular/core';
import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';

export interface FormComponentFieldWrappedComponent {
  field: FieldType<FormComponentFieldFieldConfig>;
}

export abstract class AbstractFormComponentFieldWrappedComponent implements FormComponentFieldWrappedComponent {
  field: FieldType<FormComponentFieldFieldConfig>;
}

export interface FormComponentFieldFieldConfig<T extends FormComponentFieldWrappedComponent = any> extends FormlyFieldConfig {
  componentClass: Type<T>;
}

@Component({
  template: `
    <div class="form-wrapped-component">
      <ng-template #content></ng-template>
    </div>
  `,
  styleUrls: ['./fields.scss']
})
export class FormComponentFieldComponent<T extends FormComponentFieldWrappedComponent = any> extends FieldType<FormComponentFieldFieldConfig<T>> implements OnInit {

  @ViewChild('content', { static: true, read: ViewContainerRef })
  content: ViewContainerRef;

  constructor(private resolver: ComponentFactoryResolver) {
    super();
  }

  ngOnInit(): void {
    this.content.clear();
    const componentClass = this.field.componentClass;

    if (componentClass) {
      const factory = this.resolver.resolveComponentFactory(componentClass);
      const componentRef = this.content.createComponent(factory);
      componentRef.instance.field = this;
    }
  }

}

export function componentField<T extends FormComponentFieldWrappedComponent>({ componentClass }: { componentClass: Type<T> }): FormComponentFieldFieldConfig<T> {
  return {
    type: 'component',
    componentClass
  };
}
