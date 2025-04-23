import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxSectionHeaderConfig, DbxSubSectionComponent } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { FieldTypeConfig, FieldWrapper } from '@ngx-formly/core';

export type DbxFormSubsectionConfig = DbxSectionHeaderConfig;

@Component({
  selector: 'dbx-form-subsection-wrapper',
  template: `
    <dbx-subsection [headerConfig]="headerConfig">
      <ng-container #fieldComponent></ng-container>
    </dbx-subsection>
  `,
  imports: [DbxSubSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFormSubsectionWrapperComponent extends FieldWrapper<FieldTypeConfig<DbxFormSubsectionConfig>> {
  get headerConfig(): Maybe<DbxSectionHeaderConfig> {
    return this.props;
  }
}
