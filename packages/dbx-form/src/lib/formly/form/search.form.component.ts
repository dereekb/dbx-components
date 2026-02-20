import { Component, output } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { map, Observable } from 'rxjs';
import { AbstractConfigAsyncFormlyFormDirective } from '../formly.directive';
import { dbxFormSearchFormFields, DbxFormSearchFormFieldsConfig, DbxFormSearchFormFieldsValue } from './form.form';
import { DbxFormlyFormComponentImportsModule, dbxFormlyFormComponentProviders } from '../formly.component.template';
import { DbxFormValueChangeDirective } from '../../form/io/form.change.directive';

@Component({
  selector: 'dbx-form-search-form',
  template: `
    <dbx-formly (dbxFormValueChange)="searchChanged($event)"></dbx-formly>
  `,
  providers: dbxFormlyFormComponentProviders(),
  imports: [DbxFormlyFormComponentImportsModule, DbxFormValueChangeDirective],
  standalone: true,
  host: {
    class: 'd-block dbx-form-search-form'
  }
})
export class DbxFormSearchFormComponent extends AbstractConfigAsyncFormlyFormDirective<DbxFormSearchFormFieldsValue, DbxFormSearchFormFieldsConfig> {
  readonly search = output<string>();

  readonly fields$: Observable<FormlyFieldConfig[]> = this.currentConfig$.pipe(map(dbxFormSearchFormFields));

  searchChanged(value: DbxFormSearchFormFieldsValue) {
    this.search.emit(value.search ?? '');
  }
}
