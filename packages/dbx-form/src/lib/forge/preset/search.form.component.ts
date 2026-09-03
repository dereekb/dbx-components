import { Component, output } from '@angular/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { type Maybe } from '@dereekb/util';
import { map, type Observable } from 'rxjs';
import { AbstractConfigAsyncForgeFormDirective } from '../form/forge.directive';
import { DbxForgeFormComponentImportsModule, dbxForgeFormComponentProviders } from '../form/forge.component.template';
import { DbxFormValueChangeDirective } from '../../form/io/form.change.directive';
import { dbxForgePresetSearchFormFields, type DbxForgePresetSearchFormFieldsConfig, type DbxForgePresetSearchFormFieldsValue } from './preset.form';

@Component({
  selector: 'dbx-form-search-form',
  template: `
    <dbx-forge (dbxFormValueChange)="searchChanged($event)"></dbx-forge>
  `,
  providers: dbxForgeFormComponentProviders(),
  imports: [DbxForgeFormComponentImportsModule, DbxFormValueChangeDirective],
  host: {
    class: 'd-block dbx-form-search-form'
  }
})
export class DbxForgePresetSearchFormComponent extends AbstractConfigAsyncForgeFormDirective<DbxForgePresetSearchFormFieldsValue, DbxForgePresetSearchFormFieldsConfig> {
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly search = output<string>();

  readonly formConfig$: Observable<Maybe<FormConfig>> = this.currentConfig$.pipe(map((config) => ({ fields: dbxForgePresetSearchFormFields(config) }) as FormConfig));

  searchChanged(value: Maybe<DbxForgePresetSearchFormFieldsValue>) {
    this.search.emit(value?.search ?? '');
  }
}
