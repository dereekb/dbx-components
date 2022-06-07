import { Component } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';

export interface DbxFormSectionConfig {
  header?: string;
  hint?: string;
}

export interface DbxFormSectionWrapperProps {
  sectionWrapper?: DbxFormSectionConfig;
}

@Component({
  template: `
    <dbx-section [header]="header" [hint]="hint">
      <ng-container #fieldComponent></ng-container>
    </dbx-section>
  `
})
export class DbxFormSectionWrapperComponent extends FieldWrapper<FormlyFieldConfig<DbxFormSectionWrapperProps>> {
  get header(): Maybe<string> {
    return this.props.sectionWrapper?.header;
  }

  get hint(): Maybe<string> {
    return this.props.sectionWrapper?.hint;
  }
}
