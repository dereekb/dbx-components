import { Observable, of, delay, map, startWith } from 'rxjs';
import { Component } from '@angular/core';
import { DocFormExampleChecklistValues, DocFormExampleChecklistFieldsConfig } from '../component/checklist.example';
import { beginLoading, successResult } from '@dereekb/rxjs';
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

  readonly dataLoadingState$ = this.dataChecklist$.pipe(map(x => successResult(x)), delay(1000), startWith(beginLoading()));

  readonly config: DocFormExampleChecklistFieldsConfig = {
    dataObs: this.data$
  };

}
