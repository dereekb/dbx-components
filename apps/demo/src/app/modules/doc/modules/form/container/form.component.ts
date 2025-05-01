import { DbxFormSearchFormFieldsConfig } from '@dereekb/dbx-form';
import { Component } from '@angular/core';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxFormSearchFormComponent } from '../../../../../../../../../packages/dbx-form/src/lib/formly/form/search.form.component';
import { DbxContentBorderDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.border.directive';

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
