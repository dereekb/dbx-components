import { Observable, of, map } from 'rxjs';
import { Component } from '@angular/core';
import { DocFormExampleChecklistValues, DocFormExampleChecklistFieldsConfig } from '../component/checklist.example';
import { successResult } from '@dereekb/rxjs';
import { DocFormExampleChecklistFormValue, DocFormExampleChecklistFormComponent } from '../component/checklist.example.form.component';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxFormLoadingSourceDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/io/form.loading.directive';
import { DbxFormValueChangeDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/io/form.change.directive';
import { JsonPipe } from '@angular/common';

@Component({
    templateUrl: './checklist.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocFormExampleChecklistFormComponent, DbxFormLoadingSourceDirective, DbxFormValueChangeDirective, JsonPipe]
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
}
