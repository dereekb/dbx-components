import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, type OnDestroy, inject, type OnInit, viewChild } from '@angular/core';
import { filterWithSearchString, type ListLoadingState, mapLoadingStateValueWithOperator, successResult } from '@dereekb/rxjs';
import { takeFront } from '@dereekb/util';
import { type Observable, switchMap, of, delay, startWith, BehaviorSubject } from 'rxjs';
import { type DocValue, makeDocValues } from '../component/item.list';
import { DbxPopoverService, DbxSectionPageComponent, DbxTwoColumnComponent, DbxTwoColumnContextDirective, DbxTwoColumnFullLeftDirective, DbxTwoBlockComponent, DbxTwoColumnColumnHeadDirective, DbxListEmptyContentComponent, DbxTwoColumnRightComponent, DbxSpacerDirective } from '@dereekb/dbx-web';
import { DbxFormSearchFormComponent, DbxFormValueChangeDirective } from '@dereekb/dbx-form';
import { MatButton } from '@angular/material/button';
import { DocSelectionItemListComponent } from '../component/item.list.selection.component';
import { DocLayoutSectionPageTwoPopoverComponent } from '../component/section.page.two.popover.component';
import { DocLayoutSectionPageTwoSearchComponent, type DocLayoutSectionPageTwoSearchValue } from '../component/sectionpagetwo.picker.component';

@Component({
  templateUrl: './section.page.two.component.html',
  standalone: true,
  imports: [DbxSectionPageComponent, DbxTwoColumnComponent, DbxFormSearchFormComponent, DbxSpacerDirective, DbxFormValueChangeDirective, DocLayoutSectionPageTwoSearchComponent, DbxTwoColumnContextDirective, DbxTwoColumnFullLeftDirective, DbxTwoBlockComponent, DbxTwoColumnColumnHeadDirective, DbxListEmptyContentComponent, MatButton, DbxTwoColumnRightComponent, DocSelectionItemListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocLayoutSectionPageTwoComponent implements OnDestroy, OnInit {
  readonly cdRef = inject(ChangeDetectorRef);
  readonly dbxPopoverService = inject(DbxPopoverService);

  readonly popoverOrigin = viewChild.required('popoverOrigin', { read: ElementRef });

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

  onSearchChange(value: DocLayoutSectionPageTwoSearchValue) {
    this._searchString.next(value?.search ?? '');
    console.log({ value });
  }

  openPopover() {
    DocLayoutSectionPageTwoPopoverComponent.openPopover(this.dbxPopoverService, { origin: this.popoverOrigin() });
  }
}
