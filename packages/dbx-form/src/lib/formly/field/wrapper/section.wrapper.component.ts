import { Component } from '@angular/core';
import { DbxSectionHeaderConfig } from '@dereekb/dbx-web';
import { Maybe } from '@dereekb/util';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';

export type DbxFormSectionConfig = DbxSectionHeaderConfig;

@Component({
  template: `
    <dbx-section [headerConfig]="headerConfig">
      <ng-container #fieldComponent></ng-container>
    </dbx-section>
  `
})
export class DbxFormSectionWrapperComponent extends FieldWrapper<FormlyFieldConfig<DbxFormSectionConfig>> {
  get headerConfig(): Maybe<DbxSectionHeaderConfig> {
    return this.props;
  }
}
