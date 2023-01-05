import { DbxFormSearchFormFieldsConfig } from '@dereekb/dbx-form';
import { Component } from '@angular/core';

@Component({
  templateUrl: './form.component.html'
})
export class DocFormFormComponent {
  searchText = '';

  searchFormConfig: DbxFormSearchFormFieldsConfig = {
    placeholder: 'Search For Something Cool'
  };
}
