import { type DbxFormSearchFormFieldsConfig, DbxFormSearchFormComponent } from '@dereekb/dbx-form';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { DbxContentContainerDirective, DbxContentBorderDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

@Component({
  templateUrl: './form.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxFormSearchFormComponent, DbxContentBorderDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormFormComponent {
  searchText = '';

  topSearchFormConfig: DbxFormSearchFormFieldsConfig = {
    key: 'test-search',
    label: 'Search Label',
    placeholder: 'Search For Something Cool'
  };

  searchFormConfig: DbxFormSearchFormFieldsConfig = {
    ...this.topSearchFormConfig,
    key: 'test-search'
  };

  searchFormConfigBottomBar = {
    ...this.searchFormConfig,
    key: 'test-search-bottom-bar',
    bottomBar: true
  };

  searchFormConfigWithoutLabel = {
    ...this.searchFormConfig,
    key: 'test-search-no-label',
    label: undefined
  };
}
