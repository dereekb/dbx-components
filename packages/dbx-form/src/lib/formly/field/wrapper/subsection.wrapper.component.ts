import { Component } from '@angular/core';
import { DbxSectionHeaderConfig } from '@dereekb/dbx-web';
import { Maybe } from '@dereekb/util';
import { FieldTypeConfig, FieldWrapper } from '@ngx-formly/core';

export interface DbxFormSubsectionConfig extends DbxSectionHeaderConfig {}

@Component({
  template: `
    <dbx-subsection [headerConfig]="headerConfig">
      <ng-container #fieldComponent></ng-container>
    </dbx-subsection>
  `
})
export class DbxFormSubsectionWrapperComponent extends FieldWrapper<FieldTypeConfig<DbxFormSubsectionConfig>> {
  get headerConfig(): Maybe<DbxSectionHeaderConfig> {
    return this.props;
  }
}
