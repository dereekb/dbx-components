import { ChangeDetectorRef, Component, OnDestroy, inject, OnInit } from '@angular/core';
import { filterWithSearchString, ListLoadingState, mapLoadingStateValueWithOperator, successResult } from '@dereekb/rxjs';
import { takeFront } from '@dereekb/util';
import { Observable, switchMap, of, delay, startWith, BehaviorSubject } from 'rxjs';
import { DocValue, makeDocValues } from '../component/item.list';
import { DbxSectionPageComponent } from '@dereekb/dbx-web';
import { DbxTwoColumnComponent } from '@dereekb/dbx-web';
import { DbxTwoColumnContextDirective } from '@dereekb/dbx-web';
import { DbxTwoColumnFullLeftDirective } from '@dereekb/dbx-web';
import { DbxTwoBlockComponent } from '@dereekb/dbx-web';
import { DbxTwoColumnColumnHeadDirective } from '@dereekb/dbx-web';
import { DbxFormSearchFormComponent } from '@dereekb/dbx-form';

import { DbxListEmptyContentComponent } from '@dereekb/dbx-web';
import { MatButton } from '@angular/material/button';
import { DbxTwoColumnRightComponent } from '@dereekb/dbx-web';

@Component({
  templateUrl: './section.page.two.component.html',
  standalone: true,
  imports: [DbxSectionPageComponent, DbxTwoColumnComponent, DbxTwoColumnContextDirective, DbxTwoColumnFullLeftDirective, DbxTwoBlockComponent, DbxTwoColumnColumnHeadDirective, DbxFormSearchFormComponent, DocLayoutComponentsModule, DbxListEmptyContentComponent, MatButton, DbxTwoColumnRightComponent]
})
export class DocLayoutSectionPageTwoComponent implements OnDestroy, OnInit {
  readonly cdRef = inject(ChangeDetectorRef);

  readonly numberToLoadPerUpdate = 50;
  private _values = new BehaviorSubject<DocValue[]>([]);

  showRight = true;

  private readonly _searchString = new BehaviorSubject<string>('');

  readonly search$ = this._searchString.asObservable();

  readonly state$: Observable<ListLoadingState<DocValue>> = this._values.pipe(
    switchMap((x) => {
      return of(successResult(x)).pipe(delay(Math.random() * 500 + 500), startWith<ListLoadingState<DocValue>>({ loading: true, value: takeFront(x, x.length - this.numberToLoadPerUpdate) }));
    }),
    mapLoadingStateValueWithOperator(
      filterWithSearchString({
        filter: (a) => a.name,
        search$: this.search$
      })
    )
  );

  search(string: string) {
    this._searchString.next(string);
  }

  ngOnInit(): void {
    this.loadMore();
  }

  ngOnDestroy(): void {
    this._searchString.complete();
  }

  loadMore() {
    this._values.next(this._values.value.concat(this.makeValues()));
  }

  makeValues() {
    return makeDocValues(this.numberToLoadPerUpdate);
  }
}
