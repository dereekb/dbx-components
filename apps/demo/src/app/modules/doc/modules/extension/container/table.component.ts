import { DocExtensionTableItemCellExampleComponent } from './../component/table.item.cell.example.component';
import { startOfDay } from 'date-fns';
import { Component, OnDestroy } from '@angular/core';
import { DateRangeDayDistanceInput, expandDaysForDateRange, dateRange, formatToISO8601DayStringForSystem } from '@dereekb/date';
import { DbxTableColumn, DbxTableContextData, DbxTableContextDataDelegate, dbxTableDateHeaderInjectionFactory, dbxTableDateRangeDayDistanceInputCellInput, DbxTableDirective, DbxTableItemGroup, DbxTableViewComponent, DbxTableViewDelegate } from '@dereekb/dbx-web/table';
import { beginLoadingPage, ObservableOrValue, PageListLoadingState, successPageResult, successResult } from '@dereekb/rxjs';
import { range } from '@dereekb/util';
import { delay, map, Observable, of, startWith, BehaviorSubject, skip, shareReplay, distinctUntilChanged, switchMap } from 'rxjs';
import { DocExtensionTableItemActionExampleComponent } from '../component/table.item.action.example.component';
import { DocExtensionTableItemHeaderExampleComponent } from '../component/table.item.header.example.component';
import { ExampleTableData, ExampleTableGroupData } from '../component/table.item';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { NgIf, AsyncPipe } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { DocExtensionTableGroupHeaderExampleComponent } from '../component/table.group.header.example.component';
import { DocExtensionTableGroupFooterExampleComponent } from '../component/table.group.footer.example.component';
import { DocExtensionTableActionHeaderExampleComponent } from '../component/table.action.header.example.component';
import { DocExtensionTableSummaryRowHeaderExampleComponent } from '../component/table.summary.row.header.example.component';
import { DocExtensionTableSummaryRowEndExampleComponent } from '../component/table.summary.row.end.example.component';
import { DocExtensionTableColumnFooterExampleComponent } from '../component/table.column.footer.example.component';
import { DocExtensionTableFullSummaryRowExampleComponent } from '../component/table.fullsummaryrow.example.component';

@Component({
  templateUrl: './table.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxTableViewComponent, DbxTableDirective, NgIf, MatButton, AsyncPipe]
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
    actionHeader: {
      componentClass: DocExtensionTableActionHeaderExampleComponent
    },
    summaryRowHeader: {
      componentClass: DocExtensionTableSummaryRowHeaderExampleComponent
    },
    summaryRowEnd: {
      componentClass: DocExtensionTableSummaryRowEndExampleComponent
    },
    fullSummaryRow: {
      componentClass: DocExtensionTableFullSummaryRowExampleComponent
    },
    columnFooter: function (column: DbxTableColumn<Date>) {
      return {
        componentClass: DocExtensionTableColumnFooterExampleComponent,
        init: (x) => {
          x.column = column;
        }
      };
    },
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

  readonly exampleGroupViewDelegate: DbxTableViewDelegate<DateRangeDayDistanceInput, Date, ExampleTableData> = {
    ...this.exampleViewDelegate,
    summaryRowHeader: undefined,
    summaryRowEnd: undefined,
    columnFooter: undefined,
    groupBy: (items) => {
      const allEvenItems = items.filter((x) => Number(x.key) % 2 === 0);
      const allOddItems = items.filter((x) => Number(x.key) % 2 !== 0);

      const groupResult: ObservableOrValue<DbxTableItemGroup<ExampleTableData, ExampleTableGroupData>[]> = [
        { groupId: 'even', items: allEvenItems, meta: { groupName: 'Even' } },
        { groupId: 'odd', items: allOddItems, meta: { groupName: 'Odd' } }
      ];

      return groupResult;
    },
    groupHeader: (group: DbxTableItemGroup<ExampleTableData, ExampleTableGroupData>) => {
      return {
        componentClass: DocExtensionTableGroupHeaderExampleComponent,
        init: (x: DocExtensionTableGroupHeaderExampleComponent) => {
          x.group = group;
        }
      };
    },
    groupFooter: (group: DbxTableItemGroup<ExampleTableData, ExampleTableGroupData>) => {
      return {
        componentClass: DocExtensionTableGroupFooterExampleComponent,
        init: (x: DocExtensionTableGroupFooterExampleComponent) => {
          x.group = group;
        }
      };
    }
  };

  readonly exampleDataDelegate: DbxTableContextDataDelegate<DateRangeDayDistanceInput, Date, ExampleTableData> = {
    loadData: (input) => {
      const allDays = expandDaysForDateRange(dateRange({ ...input }));
      const columns: DbxTableColumn<Date>[] = allDays.map((x) => ({ columnName: formatToISO8601DayStringForSystem(x), meta: x }));
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
      const columns: DbxTableColumn<Date>[] = allDays.map((x) => ({ columnName: formatToISO8601DayStringForSystem(x), meta: x }));

      const items$: Observable<PageListLoadingState<ExampleTableData>> = this.isLoading$.pipe(
        switchMap((x) => {
          const skipCount = x ? 1 : 0;

          return this.exampleTableDataItems
            .pipe(
              skip(skipCount),
              switchMap((x) => of(successPageResult(0, x)).pipe(delay(1000), startWith(beginLoadingPage<ExampleTableData[]>(0))))
            )
            .pipe(startWith(beginLoadingPage<ExampleTableData[]>(0)));
        })
      );

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
