import { filterMaybe } from '@dereekb/rxjs';
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, Input } from '@angular/core';
import { map, distinctUntilChanged, BehaviorSubject, switchMap } from 'rxjs';
import { DbxTableStore } from './table.store';
import { Maybe } from '@dereekb/util';
import { DbxTableColumn } from './table';

@Component({
  selector: 'dbx-table-column-header',
  template: `
    <dbx-injection [config]="config$ | async"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTableColumnHeaderComponent<C> implements OnDestroy {
  private readonly _column = new BehaviorSubject<Maybe<DbxTableColumn<C>>>(undefined);
  readonly column$ = this._column.pipe(filterMaybe(), distinctUntilChanged());

  readonly config$ = this.tableStore.viewDelegate$.pipe(
    switchMap((viewDelegate) => this.column$.pipe(map((x) => viewDelegate.columnHeader(x)))),
    distinctUntilChanged()
  );

  constructor(readonly tableStore: DbxTableStore<unknown, C>) {}

  @Input()
  set column(column: Maybe<DbxTableColumn<C>>) {
    this._column.next(column);
  }

  ngOnDestroy(): void {
    this._column.complete();
  }
}
