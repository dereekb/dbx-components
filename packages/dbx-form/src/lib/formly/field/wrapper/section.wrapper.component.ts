import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type DbxSectionHeaderConfig, DbxSectionLayoutModule } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { FieldWrapper, type FormlyFieldConfig } from '@ngx-formly/core';

/**
 * Configuration for the section wrapper, using the standard section header config.
 */
export type DbxFormSectionConfig = DbxSectionHeaderConfig;

/**
 * Formly wrapper that renders the wrapped field inside a `dbx-section` layout
 * with an optional header and hint text.
 *
 * Registered as Formly wrapper `'section'`.
 *
 * @selector dbx-form-section-wrapper
 */
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
