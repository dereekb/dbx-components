import { type Observable, of, map } from 'rxjs';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { type DocFormExampleChecklistValues, type DocFormExampleChecklistFieldsConfig } from '../component/checklist.example';
import { successResult } from '@dereekb/rxjs';
import { type DocFormExampleChecklistFormValue, DocFormExampleChecklistFormComponent } from '../component/checklist.example.form.component';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocFeatureFormTabsComponent } from '../../shared/component/feature.formtabs.component';
import { DocFormForgeExampleComponent } from '../component/forge.example.form.component';
import { DbxFormFormlyChecklistItemFieldModule, DbxFormLoadingSourceDirective, DbxFormValueChangeDirective, dbxForgeCheckboxField, dbxForgeRow } from '@dereekb/dbx-form';
import { JsonPipe } from '@angular/common';

@Component({
  templateUrl: './checklist.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFeatureFormTabsComponent, DocFormExampleChecklistFormComponent, DocFormForgeExampleComponent, DbxFormLoadingSourceDirective, DbxFormValueChangeDirective, JsonPipe, DbxFormFormlyChecklistItemFieldModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormChecklistComponent {
  value?: DocFormExampleChecklistFormValue;

  readonly data$: Observable<DocFormExampleChecklistValues> = of({
    itemA: 'Value set on itemA',
    itemB: 'itemB Value',
    itemC: 'itemC Set Value',
    itemArray: ['A', 'B', 'C']
  });

  readonly dataChecklist$: Observable<Partial<DocFormExampleChecklistFormValue>> = of({
    itemA: true
  });

  readonly dataLoadingState$ = this.dataChecklist$.pipe(map((x) => successResult(x)));

  readonly config: DocFormExampleChecklistFieldsConfig = {
    dataObs: this.data$
  };

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
