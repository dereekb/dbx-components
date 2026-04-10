import { DbxFormFormlyTextFieldModule, type DbxFormSearchFormFieldsConfig, DbxFormSearchFormComponent } from '@dereekb/dbx-form';
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { DbxBarDirective, DbxContentContainerDirective, DbxContentBorderDirective } from '@dereekb/dbx-web';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

@Component({
  templateUrl: './form.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DbxBarDirective, MatSlideToggle, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxFormSearchFormComponent, DbxContentBorderDirective, DbxFormFormlyTextFieldModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormFormComponent {
  readonly disabled = signal(false);
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
