import { DbxFormSearchFormFieldsConfig } from '@dereekb/dbx-form';
import { Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxFormSearchFormComponent } from '@dereekb/dbx-form';
import { DbxContentBorderDirective } from '@dereekb/dbx-web';

@Component({
  templateUrl: './form.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxFormSearchFormComponent, DbxContentBorderDirective]
})
export class DocFormFormComponent {
  searchText = '';

  searchFormConfig: DbxFormSearchFormFieldsConfig = {
    label: 'Search Label',
    placeholder: 'Search For Something Cool'
  };

  searchFormConfigWithoutLabel = {
    ...this.searchFormConfig,
    label: undefined
  };
}
