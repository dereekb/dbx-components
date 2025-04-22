import { ChangeDetectionStrategy, Component, TrackByFunction, inject, computed, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxTableStore } from './table.store';
import { loadingStateContext } from '@dereekb/rxjs';
import { shareReplay, map, Observable } from 'rxjs';
import { DbxLoadingComponent } from '@dereekb/dbx-web';
import { InfiniteScrollDirective } from 'ngx-infinite-scroll';
import { MatTableModule } from '@angular/material/table';
import { DbxTableInputCellComponent } from './table.cell.input.component';
import { DbxTableSummaryEndCellComponent } from './table.cell.summaryend.component';
import { DbxTableSummaryStartCellComponent } from './table.cell.summarystart.component';
import { DbxTableColumnFooterComponent } from './table.column.footer.component';
import { DbxTableItemCellComponent } from './table.item.cell.component';
import { DbxTableItemHeaderComponent } from './table.item.header.component';
import { DbxTableItemActionComponent } from './table.item.action.component';
import { DbxTableActionCellComponent } from './table.cell.action.component';
import { DbxTableColumnHeaderComponent } from './table.column.header.component';

export const DBX_TABLE_ITEMS_COLUMN_NAME = '_items';
export const DBX_TABLE_ACTIONS_COLUMN_NAME = '_actions';

/**
 * A table with fixed content
 */
@Component({
  selector: 'dbx-table-view',
  templateUrl: './table.component.html',
  imports: [DbxLoadingComponent, InfiniteScrollDirective, MatTableModule, DbxTableInputCellComponent, DbxTableItemHeaderComponent, DbxTableItemCellComponent, DbxTableItemActionComponent, DbxTableActionCellComponent, DbxTableColumnHeaderComponent, DbxTableColumnFooterComponent, DbxTableSummaryStartCellComponent, DbxTableSummaryEndCellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxTableViewComponent<I, C, T> {
  readonly tableStore = inject(DbxTableStore<I, C, T>);

  readonly DEFAULT_TRACK_BY_FUNCTION: TrackByFunction<any> = (index) => {
    return index;
  };

  readonly scrollDistance = input<number>(0.5);
  readonly throttleScroll = input<number>(50);

  readonly itemsColumnName = DBX_TABLE_ITEMS_COLUMN_NAME;
  readonly actionsColumnName = DBX_TABLE_ACTIONS_COLUMN_NAME;

  readonly innerColumns$ = this.tableStore.columns$;
  readonly innerColumnNames$ = this.innerColumns$.pipe(
    map((x) => x.map((y) => y.columnName)),
    shareReplay(1)
  );

  readonly innerColumnsSignal = toSignal(this.innerColumns$);
  readonly innerColumnNamesSignal = toSignal(this.innerColumnNames$);

  readonly elements$ = this.tableStore.items$;

  readonly displayedColumns$ = this.innerColumnNames$.pipe(
    map((columnNames) => {
      return [this.itemsColumnName, ...columnNames, this.actionsColumnName];
    }),
    shareReplay(1)
  );

  readonly displayedColumnsSignal = computed(() => {
    const columnNames = this.innerColumnNamesSignal() || [];
    return [this.itemsColumnName, ...columnNames, this.actionsColumnName];
  });

  readonly trackByFunction$: Observable<TrackByFunction<T>> = this.tableStore.viewDelegate$.pipe(
    map((x) => x.trackBy ?? this.DEFAULT_TRACK_BY_FUNCTION),
    shareReplay(1)
  );

  readonly trackByFunctionSignal = toSignal(this.trackByFunction$, { initialValue: this.DEFAULT_TRACK_BY_FUNCTION });

  readonly context = loadingStateContext({ obs: this.tableStore.dataState$ });
  readonly dataLoadingContext = loadingStateContext({ obs: this.tableStore.itemsState$ });

  readonly contextSignal = toSignal(this.context.state$);
  readonly dataLoadingContextSignal = toSignal(this.dataLoadingContext.state$);

  onScrollDown(): void {
    this.tableStore.loadMore();
  }
}
