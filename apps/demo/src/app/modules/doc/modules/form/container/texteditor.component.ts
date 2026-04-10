import { type FormlyFieldConfig } from '@ngx-formly/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DbxFormFormlyTextEditorFieldModule, textEditorField, forgeTextEditorField, DbxFormlyFieldsContextDirective } from '@dereekb/dbx-form';
import { DbxBarDirective, DbxContentContainerDirective } from '@dereekb/dbx-web';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureDerivedComponent } from '../../shared/component/feature.derived.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormExampleComponent } from '../component/example.form.component';
import { DocFormForgeExampleComponent } from '../component/forge.example.form.component';

@Component({
  templateUrl: './texteditor.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DbxBarDirective, MatSlideToggle, DocFeatureLayoutComponent, DocFeatureDerivedComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormExampleComponent, DocFormForgeExampleComponent, DbxFormlyFieldsContextDirective, DbxFormFormlyTextEditorFieldModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormTextEditorComponent {
  readonly disabled = signal(false);
  readonly textEditorField: FormlyFieldConfig[] = [
    textEditorField({
      key: 'editor',
      label: 'Text Editor',
      description: 'This is a text editor.'
    })
  ];

  readonly forgeTextEditorFieldConfig: FormConfig = {
    fields: [
      forgeTextEditorField({
        key: 'editor',
        label: 'Text Editor',
        description: 'This is a text editor.'
      }) as any
    ]
  };
}
