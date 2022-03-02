import { Observable, of, map } from 'rxjs';
import { Component } from '@angular/core';
import { DocFormExampleChecklistValues, DocFormExampleChecklistFieldsConfig } from '../component/checklist.example';
import { successResult } from '@dereekb/rxjs';
import { DocFormExampleChecklistFormValue } from '../component/checklist.example.form.component';

@Component({
  templateUrl: './checklist.component.html'
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

  readonly dataLoadingState$ = this.dataChecklist$.pipe(map(x => successResult(x)));

  readonly config: DocFormExampleChecklistFieldsConfig = {
    dataObs: this.data$
  };

}
