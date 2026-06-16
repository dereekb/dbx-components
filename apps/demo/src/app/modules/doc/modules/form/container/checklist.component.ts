import { Component, ChangeDetectionStrategy } from '@angular/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormForgeExampleComponent } from '../../shared/component/forge.example.form.component';
import { dbxForgeCheckboxField, dbxForgeRow } from '@dereekb/dbx-form';

@Component({
  templateUrl: './checklist.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormForgeExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormChecklistComponent {
  readonly forgeChecklistConfig: FormConfig = {
    fields: [
      dbxForgeRow({
        fields: [
          { ...dbxForgeCheckboxField({ key: 'itemA', label: 'itemA Label' }), col: 6 },
          { ...dbxForgeCheckboxField({ key: 'itemB', label: 'itemB Label' }), col: 6 },
          { ...dbxForgeCheckboxField({ key: 'itemC', label: 'itemC Label' }), col: 6 },
          { ...dbxForgeCheckboxField({ key: 'itemArray', label: 'itemArray Label' }), col: 6 }
        ]
      }) as any
    ]
  };
}
