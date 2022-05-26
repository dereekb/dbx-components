import { Component } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { FieldTypeConfig, FieldWrapper, FormlyFieldConfig, FormlyTemplateOptions } from '@ngx-formly/core';

export interface DbxFormSubsectionConfig {
  header?: string;
  hint?: string;
}

export interface DbxFormSubsectionWrapperTemplateOptions extends FormlyTemplateOptions {
  subsectionWrapper?: DbxFormSubsectionConfig;
}

export interface DbxFormSubsectionFormlyConfig extends FormlyFieldConfig {
  templateOptions?: DbxFormSubsectionWrapperTemplateOptions;
}

@Component({
  template: `
    <dbx-subsection [header]="header" [hint]="hint">
      <ng-container #fieldComponent></ng-container>
    </dbx-subsection>
  `
})
export class DbxFormSubsectionWrapperComponent extends FieldWrapper<DbxFormSubsectionFormlyConfig & FieldTypeConfig> {
  get header(): Maybe<string> {
    return this.to.subsectionWrapper?.header;
  }

  get hint(): Maybe<string> {
    return this.to.subsectionWrapper?.hint;
  }
}
