import { ChangeDetectorRef, Component, OnDestroy, inject, OnInit } from '@angular/core';
import { filterWithSearchString, ListLoadingState, mapLoadingStateValueWithOperator, successResult } from '@dereekb/rxjs';
import { takeFront } from '@dereekb/util';
import { Observable, switchMap, of, delay, startWith, BehaviorSubject } from 'rxjs';
import { DocValue, makeDocValues } from '../component/item.list';
import { DbxSectionPageComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/section/section.page.component';
import { DbxTwoColumnComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.component';
import { DbxTwoColumnContextDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.context.directive';
import { DbxTwoColumnFullLeftDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.full.left.directive';
import { DbxTwoBlockComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/block/two.block.component';
import { DbxTwoColumnColumnHeadDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.head.directive';
import { DbxFormSearchFormComponent } from '../../../../../../../../../packages/dbx-form/src/lib/formly/form/search.form.component';

import { DbxListEmptyContentComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/list/list.content.empty.component';
import { MatButton } from '@angular/material/button';
import { DbxTwoColumnRightComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/column/two/two.column.right.component';

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
