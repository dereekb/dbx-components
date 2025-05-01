import { FormlyFieldConfig } from '@ngx-formly/core';
import { Component } from '@angular/core';
import { DbxFormFormlyTextEditorFieldModule, textEditorField } from '@dereekb/dbx-form';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFormExampleComponent } from '../component/example.form.component';
import { DbxFormlyFieldsContextDirective } from '@dereekb/dbx-form';

@Component({
  templateUrl: './texteditor.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureDerivedComponent, DocFeatureExampleComponent, DocFormExampleComponent, DbxFormlyFieldsContextDirective, DbxFormFormlyTextEditorFieldModule]
})
export class DocFormTextEditorComponent {
  readonly textEditorField: FormlyFieldConfig[] = [
    textEditorField({
      key: 'editor',
      label: 'Text Editor',
      description: 'This is a text editor.'
    })
  ];
}
