import { DocExtensionTableItemCellExampleComponent } from './../component/table.item.cell.example.component';
import { startOfDay } from 'date-fns';
import { Component, OnDestroy } from '@angular/core';
import { DateRangeDayDistanceInput, expandDaysForDateRange, dateRange, formatToISO8601DayString } from '@dereekb/date';
import { DbxTableColumn, DbxTableContextData, DbxTableContextDataDelegate, dbxTableDateHeaderInjectionFactory, dbxTableDateRangeDayDistanceInputCellInput, DbxTableViewDelegate } from '@dereekb/dbx-web/table';
import { beginLoadingPage, PageListLoadingState, successPageResult, successResult } from '@dereekb/rxjs';
import { range } from '@dereekb/util';
import { delay, map, Observable, of, startWith, BehaviorSubject, skip, shareReplay, distinctUntilChanged, switchMap } from 'rxjs';
import { DocExtensionTableItemActionExampleComponent } from '../component/table.item.action.example.component';
import { DocExtensionTableItemHeaderExampleComponent } from '../component/table.item.header.example.component';
import { ExampleTableData } from '../component/table.item';

@Component({
  templateUrl: './table.component.html'
})
export class DocExtensionTableComponent implements OnDestroy {
  readonly exampleInput: DateRangeDayDistanceInput = {
    date: startOfDay(new Date()),
    distance: 6
  };

  readonly exampleTableData: ExampleTableData[] = range(0, 15).map((x) => ({ name: `Example ${x}`, key: String(x) }));
  readonly exampleTableDataItems = new BehaviorSubject<ExampleTableData[]>(this.exampleTableData);

  readonly isLoading$ = this.exampleTableDataItems.pipe(
    skip(1),
    map((x) => false),
    startWith(true),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly exampleViewDelegate: DbxTableViewDelegate<DateRangeDayDistanceInput, Date, ExampleTableData> = {
    inputHeader: dbxTableDateRangeDayDistanceInputCellInput(),
    columnHeader: dbxTableDateHeaderInjectionFactory(),
    itemHeader: function (item: ExampleTableData) {
      return {
        componentClass: DocExtensionTableItemHeaderExampleComponent,
        init: (x) => {
          x.item = item;
        }
      };
    },
    itemCell: function (column: DbxTableColumn<Date>, item: ExampleTableData) {
      return {
        componentClass: DocExtensionTableItemCellExampleComponent,
        init: (x) => {
          x.item = item;
          x.column = column;
        }
      };
    },
    itemAction: function (item: ExampleTableData) {
      return {
        componentClass: DocExtensionTableItemActionExampleComponent
      };
    }
  };

  readonly exampleDataDelegate: DbxTableContextDataDelegate<DateRangeDayDistanceInput, Date, ExampleTableData> = {
    loadData: (input) => {
      const allDays = expandDaysForDateRange(dateRange({ ...input }));
      const columns: DbxTableColumn<Date>[] = allDays.map((x) => ({ columnName: formatToISO8601DayString(x), meta: x }));
      const items: ExampleTableData[] = [...this.exampleTableData];
      const items$: Observable<PageListLoadingState<ExampleTableData>> = of(successPageResult(0, items));

      const result: DbxTableContextData<DateRangeDayDistanceInput, Date, ExampleTableData> = {
        input,
        columns,
        items$
      };

      return of(successResult(result)); // .pipe(delay(1000), startWith(beginLoadingPage<typeof result>(0)));
    }
  };

  readonly exampleLoadingContextDelegate: DbxTableContextDataDelegate<DateRangeDayDistanceInput, Date, ExampleTableData> = {
    loadData: (input) => {
      return of(beginLoadingPage<DbxTableContextData<DateRangeDayDistanceInput, Date, ExampleTableData>>(0));
    }
  };

  readonly exampleLoadingDataDelegate: DbxTableContextDataDelegate<DateRangeDayDistanceInput, Date, ExampleTableData> = {
    loadData: (input) => {
      const allDays = expandDaysForDateRange(dateRange({ ...input }));
      const columns: DbxTableColumn<Date>[] = allDays.map((x) => ({ columnName: formatToISO8601DayString(x), meta: x }));
      const items$: Observable<PageListLoadingState<ExampleTableData>> = this.exampleTableDataItems
        .pipe(
          skip(1),
          switchMap((x) => of(successPageResult(0, x)).pipe(delay(1000), startWith(beginLoadingPage<ExampleTableData[]>(0))))
        )
        .pipe(startWith(beginLoadingPage<ExampleTableData[]>(0)));

      const result: DbxTableContextData<DateRangeDayDistanceInput, Date, ExampleTableData> = {
        input,
        columns,
        items$,
        loadMore: () => this.loadMoreItems()
      };

      return of(successResult(result));
    }
  };

  loadMoreItems() {
    const currentItems = this.exampleTableDataItems.value;
    const itemsCount = currentItems.length;
    const newItems = range(itemsCount + 1, itemsCount + 15).map((x) => ({ name: `Example ${x}`, key: String(x) }));
    this.exampleTableDataItems.next([...currentItems, ...newItems]);
  }

  ngOnDestroy(): void {
    this.exampleTableDataItems.complete();
  }
}
