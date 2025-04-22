import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxSectionHeaderConfig, DbxSectionLayoutModule } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';

export type DbxFormSectionConfig = DbxSectionHeaderConfig;

@Component({
  selector: 'dbx-form-section-wrapper',
  template: `
    <dbx-section [headerConfig]="headerConfig">
      <ng-container #fieldComponent></ng-container>
    </dbx-section>
  `,
  imports: [DbxSectionLayoutModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFormSectionWrapperComponent extends FieldWrapper<FormlyFieldConfig<DbxFormSectionConfig>> {
  get headerConfig(): Maybe<DbxSectionHeaderConfig> {
    return this.props;
  }
}
