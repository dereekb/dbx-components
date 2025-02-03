import { filterMaybe } from '@dereekb/rxjs';
import { OnDestroy, Input, Directive, inject } from '@angular/core';
import { distinctUntilChanged, BehaviorSubject } from 'rxjs';
import { DbxTableStore } from './table.store';
import { type Maybe } from '@dereekb/util';
import { DbxTableColumn } from './table';

/**
 * Abstract directive that has a column input.
 */
@Directive()
export class AbstractDbxTableColumnDirective<C> implements OnDestroy {
  readonly tableStore = inject(DbxTableStore<unknown, C>);

  private readonly _column = new BehaviorSubject<Maybe<DbxTableColumn<C>>>(undefined);
  readonly column$ = this._column.pipe(filterMaybe(), distinctUntilChanged());

  @Input()
  set column(column: Maybe<DbxTableColumn<C>>) {
    this._column.next(column);
  }

  ngOnDestroy(): void {
    this._column.complete();
  }
}
