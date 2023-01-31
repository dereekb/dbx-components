import { shareReplay } from 'rxjs/operators';
import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { DbxTableStore } from './table.store';
import { loadingStateContext, tapLog } from '@dereekb/rxjs';
import { map } from 'rxjs';

export const DBX_TABLE_ITEMS_COLUMN_NAME = '_items';
export const DBX_TABLE_ACTIONS_COLUMN_NAME = '_actions';

/**
 * A table with fixed content
 */
@Component({
  selector: 'dbx-table-view',
  templateUrl: './table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTableViewComponent<I, C, T> implements OnDestroy {
  readonly itemsColumnName = DBX_TABLE_ITEMS_COLUMN_NAME;
  readonly actionsColumnName = DBX_TABLE_ACTIONS_COLUMN_NAME;

  readonly innerColumns$ = this.tableStore.columns$;
  readonly innerColumnNames$ = this.innerColumns$.pipe(
    map((x) => x.map((y) => y.columnName)),
    shareReplay(1)
  );

  readonly elements$ = this.tableStore.items$;

  readonly displayedColumns$ = this.innerColumnNames$.pipe(
    map((columnNames) => {
      return [this.itemsColumnName, ...columnNames, this.actionsColumnName];
    }),
    shareReplay(1)
  );

  readonly context = loadingStateContext({ obs: this.tableStore.dataState$ });
  readonly dataLoadingContext = loadingStateContext({ obs: this.tableStore.itemsState$ });

  constructor(readonly tableStore: DbxTableStore<I, C, T>) {}

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
