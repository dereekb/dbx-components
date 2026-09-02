import { type DbxForgePresetSearchFormFieldsConfig, DbxForgePresetSearchFormComponent } from '@dereekb/dbx-form';
import { Component } from '@angular/core';
import { DbxContentContainerDirective, DbxContentBorderDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

@Component({
  templateUrl: './form.component.html',
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxForgePresetSearchFormComponent, DbxContentBorderDirective]
})
export class DocFormFormComponent {
  searchText = '';

  topSearchFormConfig: DbxForgePresetSearchFormFieldsConfig = {
    key: 'test-search',
    label: 'Search Label',
    placeholder: 'Search For Something Cool'
  };

  searchFormConfig: DbxForgePresetSearchFormFieldsConfig = {
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
