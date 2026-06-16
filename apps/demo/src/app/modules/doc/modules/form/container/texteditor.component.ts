import { type FormConfig } from '@ng-forge/dynamic-forms';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { dbxForgeTextEditorField } from '@dereekb/dbx-form';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormForgeExampleComponent } from '../../shared/component/forge.example.form.component';

@Component({
  templateUrl: './texteditor.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureDerivedComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormForgeExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormTextEditorComponent {
  readonly forgeTextEditorFieldConfig: FormConfig = {
    fields: [
      dbxForgeTextEditorField({
        key: 'editor',
        label: 'Text Editor',
        description: 'This is a text editor.'
      }) as any
    ]
  };
}
