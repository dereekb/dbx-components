import { Component } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { FieldTypeConfig, FieldWrapper } from '@ngx-formly/core';

export interface DbxFormSubsectionConfig {
  header?: string;
  hint?: string;
}

@Component({
  template: `
    <dbx-subsection [header]="header" [hint]="hint">
      <ng-container #fieldComponent></ng-container>
    </dbx-subsection>
  `
})
export class DbxFormSubsectionWrapperComponent extends FieldWrapper<FieldTypeConfig<DbxFormSubsectionConfig>> {
  get header(): Maybe<string> {
    return this.props.header;
  }

  get hint(): Maybe<string> {
    return this.props.hint;
  }
}
