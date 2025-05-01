import { FormlyFieldConfig } from '@ngx-formly/core';
import { Component } from '@angular/core';
import { textEditorField } from '@dereekb/dbx-form';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFormExampleComponent } from '../component/example.form.component';
import { DbxFormlyFieldsContextDirective } from '../../../../../../../../../packages/dbx-form/src/lib/formly/formly.context.directive';

@Component({
    templateUrl: './texteditor.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureDerivedComponent, DocFeatureExampleComponent, DocFormExampleComponent, DbxFormlyFieldsContextDirective]
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
