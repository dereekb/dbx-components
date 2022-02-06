import { ListSelectionState } from '@dereekb/dbx-web';
import { ListLoadingState, successResult, tapLog } from '@dereekb/rxjs';
import { BehaviorSubject, map, switchMap, startWith, Observable, delay, of } from 'rxjs';
import { Component, OnInit } from '@angular/core';
import { DocItem } from '../component/item.list.component';
import { range, takeFront } from '@dereekb/util';

@Component({
  templateUrl: './list.component.html'
})
export class DocLayoutListComponent implements OnInit {

  readonly numberToLoadPerUpdate = 50;

  selectionState?: ListSelectionState<DocItem>;

  private _values = new BehaviorSubject<DocItem[]>([]);
  readonly state$: Observable<ListLoadingState<DocItem>> = this._values.pipe(
    switchMap((x) => {
      return of(successResult(x)).pipe(
        delay((Math.random() * 500) + 1000),
        startWith<ListLoadingState<DocItem>>({ loading: true, model: takeFront(x, x.length - this.numberToLoadPerUpdate) })
      );
    })
  );

  readonly count$ = this.state$.pipe(map(x => x.model?.length ?? 0));

  loadMore() {
    this._values.next(this._values.value.concat(range(this.numberToLoadPerUpdate).map(x => ({ icon: 'house', name: `${x}-${Math.random() * x}` }))))
  }

  onSelectionChange(event: ListSelectionState<DocItem>) {
    this.selectionState = event;
  }

  ngOnInit(): void {
    this.loadMore();
  }

}
