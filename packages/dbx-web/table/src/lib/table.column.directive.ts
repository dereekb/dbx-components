import { filterMaybe } from '@dereekb/rxjs';
import { Directive, inject, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged } from 'rxjs';
import { DbxTableStore } from './table.store';
import { type Maybe } from '@dereekb/util';
import { DbxTableColumn } from './table';

/**
 * Abstract directive that has a column input.
 */
@Directive()
export class AbstractDbxTableColumnDirective<C> {
  readonly tableStore = inject(DbxTableStore<unknown, C>);

  readonly column = input<Maybe<DbxTableColumn<C>>>();
  readonly column$ = toObservable(this.column).pipe(filterMaybe(), distinctUntilChanged());
}
