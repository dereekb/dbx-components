import { Component } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { FieldTypeConfig, FieldWrapper, FormlyFieldConfig, FormlyTemplateOptions } from '@ngx-formly/core';

export interface FormSubsectionConfig {
  header?: string;
  hint?: string;
}

export interface FormSubsectionWrapperTemplateOptions extends FormlyTemplateOptions {
  subsection?: FormSubsectionConfig;
}

export interface FormSubsectionFormlyConfig extends FormlyFieldConfig {
  templateOptions?: FormSubsectionWrapperTemplateOptions;
}

@Component({
  template: `
  <dbx-subsection [header]="header" [hint]="hint">
    <ng-container #fieldComponent></ng-container>
  </dbx-subsection>
  `
})
export class FormSubsectionWrapperComponent extends FieldWrapper<FormSubsectionFormlyConfig & FieldTypeConfig> {

  get header(): Maybe<string> {
    return this.to.subsection?.header;
  }

  get hint(): Maybe<string> {
    return this.to.subsection?.hint;
  }

}
