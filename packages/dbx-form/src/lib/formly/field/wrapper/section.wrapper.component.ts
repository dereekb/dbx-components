import { Component } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';

export interface DbxFormSectionConfig {
  header?: string;
  hint?: string;
}

@Component({
  template: `
    <dbx-section [header]="header" [hint]="hint">
      <ng-container #fieldComponent></ng-container>
    </dbx-section>
  `
})
export class DbxFormSectionWrapperComponent extends FieldWrapper<FormlyFieldConfig<DbxFormSectionConfig>> {
  get header(): Maybe<string> {
    return this.props.header;
  }

  get hint(): Maybe<string> {
    return this.props.hint;
  }
}
