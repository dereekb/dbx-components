import { Observable, of, delay, map, startWith } from 'rxjs';
import { ChangeDetectorRef, Component } from '@angular/core';
import { DocFormExampleChecklistValues, DocFormExampleChecklistFieldsConfig } from '../component/checklist.example';
import { beginLoading, successResult } from '@dereekb/rxjs';
import { DocFormExampleChecklistFormValue } from '../component/checklist.example.form.component';

@Component({
  templateUrl: './checklist.component.html'
})
export class DocFormChecklistComponent {

  value?: DocFormExampleChecklistFormValue;

  readonly date$: Observable<DocFormExampleChecklistValues> = of({
    itemA: 'Value set on itemA',
    itemB: 'itemB Value',
    itemC: 'itemC Set Value',
    itemArray: ['A', 'B', 'C']
  });

  readonly dataLoadingState$ = this.date$.pipe(map(x => successResult(x)), delay(1000), startWith(beginLoading()));

  readonly config: DocFormExampleChecklistFieldsConfig = {
    dataObs: this.date$
  };

  constructor(readonly cdRef: ChangeDetectorRef) { }

  updateChecklist = (template: DocFormExampleChecklistFormValue): Observable<any> => {
    this.value = template;
    this.cdRef.detectChanges();
    return of();
  }

}
