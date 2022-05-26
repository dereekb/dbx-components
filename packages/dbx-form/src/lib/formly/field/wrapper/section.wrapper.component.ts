import { Component } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { FieldTypeConfig, FieldWrapper, FormlyFieldConfig, FormlyTemplateOptions } from '@ngx-formly/core';

export interface DbxFormSectionConfig {
  header?: string;
  hint?: string;
}

export interface DbxFormSectionWrapperTemplateOptions extends FormlyTemplateOptions {
  sectionWrapper?: DbxFormSectionConfig;
}

export interface FormSectionFormlyConfig extends FormlyFieldConfig {
  templateOptions?: DbxFormSectionWrapperTemplateOptions;
}

@Component({
  template: `
    <dbx-section [header]="header" [hint]="hint">
      <ng-container #fieldComponent></ng-container>
    </dbx-section>
  `
})
export class DbxFormSectionWrapperComponent extends FieldWrapper<FormSectionFormlyConfig & FieldTypeConfig> {
  get header(): Maybe<string> {
    return this.to.sectionWrapper?.header;
  }

  get hint(): Maybe<string> {
    return this.to.sectionWrapper?.hint;
  }
}
