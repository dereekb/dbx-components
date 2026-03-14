import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type DbxSectionHeaderConfig, DbxSubSectionComponent } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { type FieldTypeConfig, FieldWrapper } from '@ngx-formly/core';

/**
 * Configuration for the subsection wrapper, using the standard section header config.
 */
export type DbxFormSubsectionConfig = DbxSectionHeaderConfig;

/**
 * Formly wrapper that renders the wrapped field inside a `dbx-subsection` layout
 * with an optional header and hint text.
 *
 * Registered as Formly wrapper `'subsection'`.
 *
 * @selector dbx-form-subsection-wrapper
 */
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
