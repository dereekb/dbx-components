import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { type Maybe } from '@dereekb/util';
import { map, type Observable } from 'rxjs';
import { AbstractConfigAsyncForgeFormDirective } from '../form/forge.directive';
import { DbxForgeFormComponentImportsModule, dbxForgeFormComponentProviders } from '../form/forge.component.template';
import { DbxFormValueChangeDirective } from '../../form/io/form.change.directive';
import { dbxFormSearchFormFields, type DbxFormSearchFormFieldsConfig, type DbxFormSearchFormFieldsValue } from './preset.form';

// TODO(migrate): Will be renamed in a future release to DbxForgePresetSearchFormComponent.
@Component({
  selector: 'dbx-form-search-form',
  template: `
    <dbx-forge (dbxFormValueChange)="searchChanged($event)"></dbx-forge>
  `,
  providers: dbxForgeFormComponentProviders(),
  imports: [DbxForgeFormComponentImportsModule, DbxFormValueChangeDirective],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'd-block dbx-form-search-form'
  }
})
export class DbxFormSearchFormComponent extends AbstractConfigAsyncForgeFormDirective<DbxFormSearchFormFieldsValue, DbxFormSearchFormFieldsConfig> {
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly search = output<string>();

  readonly formConfig$: Observable<Maybe<FormConfig>> = this.currentConfig$.pipe(map((config) => ({ fields: dbxFormSearchFormFields(config) }) as FormConfig));

  searchChanged(value: Maybe<DbxFormSearchFormFieldsValue>) {
    this.search.emit(value?.search ?? '');
  }
}
