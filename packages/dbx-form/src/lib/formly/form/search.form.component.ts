import { Component, Output, EventEmitter, OnDestroy } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { map, Observable } from 'rxjs';
import { provideFormlyContext } from '../formly.context';
import { AbstractConfigAsyncFormlyFormDirective } from '../formly.directive';
import { dbxFormSearchFormFields, DbxFormSearchFormFieldsConfig, DbxFormSearchFormFieldsValue } from './form.form';

@Component({
  template: `
    <dbx-formly (dbxFormValueChange)="searchChanged($event)"></dbx-formly>
  `,
  selector: 'dbx-form-search-form',
  providers: [provideFormlyContext()],
  host: {
    class: 'd-block dbx-form-search-form'
  }
})
export class DbxFormSearchFormComponent extends AbstractConfigAsyncFormlyFormDirective<DbxFormSearchFormFieldsValue, DbxFormSearchFormFieldsConfig> implements OnDestroy {
  @Output()
  readonly search = new EventEmitter<string>();

  readonly fields$: Observable<FormlyFieldConfig[]> = this.currentConfig$.pipe(map(dbxFormSearchFormFields));

  searchChanged(value: DbxFormSearchFormFieldsValue) {
    this.search.next(value.search ?? '');
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.search.complete();
  }
}
