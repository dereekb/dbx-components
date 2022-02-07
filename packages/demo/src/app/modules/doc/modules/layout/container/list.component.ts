import { ListSelectionState } from '@dereekb/dbx-web';
import { ListLoadingState, mapLoadingStateResults, successResult, tapLog } from '@dereekb/rxjs';
import { BehaviorSubject, map, switchMap, startWith, Observable, delay, of } from 'rxjs';
import { Component, OnInit } from '@angular/core';
import { DocValue, DocValueWithSelection } from '../component/item.list';
import { range, takeFront } from '@dereekb/util';

@Component({
  templateUrl: './list.component.html'
})
export class DocLayoutListComponent implements OnInit {

  readonly numberToLoadPerUpdate = 50;

  selectionState?: ListSelectionState<DocValue>;

  private _values = new BehaviorSubject<DocValue[]>([]);
  readonly state$: Observable<ListLoadingState<DocValue>> = this._values.pipe(
    switchMap((x) => {
      return of(successResult(x)).pipe(
        delay((Math.random() * 500) + 1000),
        startWith<ListLoadingState<DocValue>>({ loading: true, value: takeFront(x, x.length - this.numberToLoadPerUpdate) })
      );
    })
  );

  readonly stateWithSelection$: Observable<ListLoadingState<DocValueWithSelection>> = this.state$.pipe(
    map((x) => mapLoadingStateResults<DocValue[], DocValueWithSelection[]>(x, {
      mapValue: ((values) => values.map((x) => ({ ...x, selected: Math.random() > 0.5, disabled: Math.random() > 0.8 })))
    }))
  );

  readonly staticState$: Observable<ListLoadingState<DocValue>> = of(successResult(this.makeValues()));

  readonly count$ = this.state$.pipe(map(x => x.value?.length ?? 0));

  loadMore() {
    this._values.next(this._values.value.concat(this.makeValues()))
  }

  onSelectionChange(event: ListSelectionState<DocValue>) {
    this.selectionState = event;
  }

  ngOnInit(): void {
    this.loadMore();
  }

  makeValues() {
    return range(this.numberToLoadPerUpdate).map(x => ({ icon: 'house', name: `${x}-${Math.random() * x}` }));
  }

}
