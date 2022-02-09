import { Component } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { FieldTypeConfig, FieldWrapper, FormlyFieldConfig, FormlyTemplateOptions } from '@ngx-formly/core';

export interface FormSectionConfig {
  header?: string;
  hint?: string;
}

export interface FormSectionWrapperTemplateOptions extends FormlyTemplateOptions {
  section?: FormSectionConfig;
}

export interface FormSectionFormlyConfig extends FormlyFieldConfig {
  templateOptions?: FormSectionWrapperTemplateOptions;
}

@Component({
  template: `
    <dbx-section [header]="header" [hint]="hint">
      <ng-container #fieldComponent></ng-container>
    </dbx-section>
  `
})
export class FormSectionWrapperComponent extends FieldWrapper<FormSectionFormlyConfig & FieldTypeConfig> {

  get header(): Maybe<string> {
    return this.to.section?.header;
  }

  get hint(): Maybe<string> {
    return this.to.section?.hint;
  }

}
