import { Observable, of, map } from 'rxjs';
import { Component } from '@angular/core';
import { DocFormExampleChecklistValues, DocFormExampleChecklistFieldsConfig } from '../component/checklist.example';
import { successResult } from '@dereekb/rxjs';
import { DocFormExampleChecklistFormValue, DocFormExampleChecklistFormComponent } from '../component/checklist.example.form.component';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxFormLoadingSourceDirective } from '@dereekb/dbx-form';
import { DbxFormValueChangeDirective } from '@dereekb/dbx-form';
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
