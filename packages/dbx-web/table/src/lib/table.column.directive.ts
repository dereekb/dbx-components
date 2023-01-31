import { filterMaybe } from '@dereekb/rxjs';
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, Input, Directive } from '@angular/core';
import { map, distinctUntilChanged, BehaviorSubject, switchMap } from 'rxjs';
import { DbxTableStore } from './table.store';
import { Maybe } from '@dereekb/util';
import { DbxTableColumn } from './table';

/**
 * Abstract directive that has a column input.
 */
@Directive()
export class AbstractDbxTableColumnDirective<C> implements OnDestroy {
  private readonly _column = new BehaviorSubject<Maybe<DbxTableColumn<C>>>(undefined);
  readonly column$ = this._column.pipe(filterMaybe(), distinctUntilChanged());

  constructor(readonly tableStore: DbxTableStore<unknown, C>) {}

  @Input()
  set column(column: Maybe<DbxTableColumn<C>>) {
    this._column.next(column);
  }

  ngOnDestroy(): void {
    this._column.complete();
  }
}
