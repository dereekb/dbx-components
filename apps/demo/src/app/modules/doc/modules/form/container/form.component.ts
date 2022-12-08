import { DbxFormSearchFormFieldsConfig, usernamePasswordLoginFields, timezoneStringField } from '@dereekb/dbx-form';
import { Component } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';

@Component({
  templateUrl: './form.component.html'
})
export class DocFormFormComponent {
  searchText = '';

  searchFormConfig: DbxFormSearchFormFieldsConfig = {
    placeholder: 'Search For Something Cool'
  };
}
