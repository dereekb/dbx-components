import { ChangeDetectionStrategy, Component, TrackByFunction, inject, computed, input, Signal, viewChild, effect, ChangeDetectorRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxTableStore } from './table.store';
import { LoadingState, loadingStateContext, mapLoadingStateValueWithOperator, valueFromFinishedLoadingState } from '@dereekb/rxjs';
import { shareReplay, map, Observable, switchMap, throttleTime } from 'rxjs';
import { DbxLoadingComponent } from '@dereekb/dbx-web';
import { InfiniteScrollDirective } from 'ngx-infinite-scroll';
import { MatTable, MatTableModule } from '@angular/material/table';
import { DbxTableInputCellComponent } from './table.cell.input.component';
import { DbxTableSummaryEndCellComponent } from './table.cell.summaryend.component';
import { DbxTableSummaryStartCellComponent } from './table.cell.summarystart.component';
import { DbxTableColumnFooterComponent } from './table.column.footer.component';
import { DbxTableItemCellComponent } from './table.item.cell.component';
import { DbxTableItemHeaderComponent } from './table.item.header.component';
import { DbxTableItemActionComponent } from './table.item.action.component';
import { DbxTableActionCellComponent } from './table.cell.action.component';
import { DbxTableColumnHeaderComponent } from './table.column.header.component';
import { DbxTableItemGroup, DefaultDbxTableItemGroup } from './table';
import { DbxTableGroupHeaderComponent } from './table.group.header.component';
import { DbxTableGroupFooterComponent } from './table.group.footer.component';
import { pushArrayItemsIntoArray } from '@dereekb/util';
import { NgClass } from '@angular/common';
import { DbxTableFullSummaryRowComponent } from './table.fullsummaryrow.component';
import { DbxColumnSizeDirective, DbxColumnSizeColumnDirective } from './table.column.size.directive';
import { DataSource } from '@angular/cdk/table';
import { ArrayDataSource } from '@angular/cdk/collections';

export const DBX_TABLE_ITEMS_COLUMN_NAME = '_items';
export const DBX_TABLE_ACTIONS_COLUMN_NAME = '_actions';

export interface DbxTableViewGroupElement<T, G> {
  readonly type: 'group';
  readonly location: 'header' | 'footer';
  readonly group: DbxTableItemGroup<T, G>;
}

export interface DbxTableViewItemElement<T, G> {
  readonly type: 'item';
  readonly item: T;
}

export type DbxTableViewElement<T, G> = DbxTableViewGroupElement<T, G> | DbxTableViewItemElement<T, G>;

export function isDbxTableViewGroupElement<T, G>(element: DbxTableViewElement<T, G>): element is DbxTableViewGroupElement<T, G> {
  return element.type === 'group';
}

export function isDbxTableViewItemElement<T, G>(element: DbxTableViewElement<T, G>): element is DbxTableViewItemElement<T, G> {
  return element.type === 'item';
}

/**
 * A table with fixed content
 */
@Component({
  selector: 'dbx-table-view',
  templateUrl: './table.component.html',
  imports: [
    DbxLoadingComponent,
    NgClass,
    InfiniteScrollDirective,
    MatTableModule,
    DbxTableInputCellComponent,
    DbxTableItemHeaderComponent,
    DbxTableItemCellComponent,
    DbxTableItemActionComponent,
    DbxTableActionCellComponent,
    DbxTableColumnHeaderComponent,
    DbxTableColumnFooterComponent,
    DbxTableSummaryStartCellComponent,
    DbxTableSummaryEndCellComponent,
    DbxTableGroupHeaderComponent,
    DbxTableGroupFooterComponent,
    DbxTableFullSummaryRowComponent,
    DbxColumnSizeDirective,
    DbxColumnSizeColumnDirective
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxTableViewComponent<I, C, T, G = unknown> {
  readonly tableStore = inject(DbxTableStore<I, C, T, G>);
  readonly table = viewChild.required<MatTable<DbxTableViewElement<T, G>>>(MatTable);

  /**
   * TEMPORARY: the cdk seems to not implement change detection properly
   */
  readonly cdRef = inject(ChangeDetectorRef);

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

  readonly elementsState$: Observable<LoadingState<DbxTableViewElement<T, G>[]>> = this.tableStore.groupsState$.pipe(
    mapLoadingStateValueWithOperator(
      switchMap((groups) => {
        return this.tableStore.viewDelegate$.pipe(
          map((viewDelegate) => {
            const { groupHeader: inputGroupHeader, groupFooter: inputGroupFooter } = viewDelegate;
            const hasGroupHeader = inputGroupHeader != null ? (group: DbxTableItemGroup<T, G>) => inputGroupHeader(group) != null : () => false;
            const hasGroupFooter = inputGroupFooter != null ? (group: DbxTableItemGroup<T, G>) => inputGroupFooter(group) != null : () => false;

            return groups
              .map((group) => {
                const { items } = group;

                const itemElements: DbxTableViewItemElement<T, G>[] = items.map((item) => ({
                  type: 'item',
                  item
                }));

                let elements: DbxTableViewElement<T, G>[];

                if ((group as DefaultDbxTableItemGroup<T, G>).default) {
                  elements = itemElements;
                } else {
                  const header = hasGroupHeader(group);
                  const footer = hasGroupFooter(group);

                  elements = [];

                  if (header) {
                    elements.push({
                      type: 'group',
                      location: 'header',
                      group
                    });
                  }

                  pushArrayItemsIntoArray(elements, itemElements);

                  if (footer) {
                    elements.push({
                      type: 'group',
                      location: 'footer',
                      group
                    });
                  }
                }

                return elements;
              })
              .flat();
          })
        );
      })
    ),
    shareReplay(1)
  );

  readonly elements$ = this.elementsState$.pipe(
    valueFromFinishedLoadingState(() => []),
    throttleTime(50, undefined, { leading: true, trailing: true }),
    shareReplay(1)
  );

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

  readonly visibleColumnsSignal = computed(() => {
    const displayedColumns = this.displayedColumnsSignal();

    // TODO: Every time the table is rendered/size changes/etc we should recompute width of the first n columns that span the viewport
    // in order to calculate a colspan for the group header/footer that is not greater than span of the table for a given view size
    // I.E. if the screen shrinks to only show the first 4 columns, then the colspan should be 4.

    // as a temporary measure, we just show half the columns

    return displayedColumns.length / 2;
  });

  readonly trackByFunction$: Observable<TrackByFunction<T>> = this.tableStore.viewDelegate$.pipe(
    map((x) => x.trackBy ?? this.DEFAULT_TRACK_BY_FUNCTION),
    shareReplay(1)
  );

  readonly inputTrackByFunctionSignal = toSignal(this.trackByFunction$, { initialValue: this.DEFAULT_TRACK_BY_FUNCTION });
  readonly trackElementByFunctionSignal: Signal<TrackByFunction<DbxTableViewElement<T, G>>> = computed(() => {
    const trackByFunction = this.inputTrackByFunctionSignal() as TrackByFunction<T>;

    const fn: TrackByFunction<DbxTableViewElement<T, G>> = (index: number, element: DbxTableViewElement<T, G>) => {
      if (element.type === 'item') {
        return `i_${trackByFunction(index, element.item as T)}`;
      } else {
        return `g_${element.group.groupId}`;
      }
    };

    return fn;
  });

  readonly context = loadingStateContext({ obs: this.tableStore.dataState$ });
  readonly dataLoadingContext = loadingStateContext({ obs: this.elementsState$ });

  readonly contextSignal = toSignal(this.context.state$);
  readonly dataLoadingContextSignal = toSignal(this.dataLoadingContext.state$);

  readonly viewDelegateSignal = toSignal(this.tableStore.viewDelegate$);
  readonly elementsSignal = toSignal(this.elements$, { initialValue: [] });

  readonly _elementEffect = effect(() => {
    const table = this.table();
    table.dataSource = this.elementsSignal(); // signal to render the rows
    table.renderRows();
    this.cdRef.detectChanges(); // detect changes
  });

  onScrollDown(): void {
    this.tableStore.loadMore();
  }

  showItemRow(_: number, row: DbxTableViewElement<T, G>): boolean {
    return row.type === 'item';
  }

  showGroupHeaderRow(_: number, row: DbxTableViewElement<T, G>): boolean {
    return row.type === 'group' && row.location === 'header';
  }

  showGroupFooterRow(_: number, row: DbxTableViewElement<T, G>): boolean {
    return row.type === 'group' && row.location === 'footer';
  }

  readonly showFooterRowSignal = computed(() => {
    const viewDelegate = this.viewDelegateSignal();
    const showFooterRow = viewDelegate && (viewDelegate.summaryRowHeader != null || viewDelegate.columnFooter != null || viewDelegate.summaryRowEnd != null);
    return showFooterRow;
  });

  readonly showFullSummaryRowSignal = computed(() => {
    const viewDelegate = this.viewDelegateSignal();
    return viewDelegate?.fullSummaryRow != null;
  });
}
