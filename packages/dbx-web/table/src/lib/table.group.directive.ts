import { toObservable } from '@angular/core/rxjs-interop';
import { filterMaybe } from '@dereekb/rxjs';
import { Directive, inject, input } from '@angular/core';
import { distinctUntilChanged } from 'rxjs';
import { DbxTableStore } from './table.store';
import { type Maybe } from '@dereekb/util';
import { DbxTableItemGroup } from './table';

/**
 * Abstract directive that has an element input.
 */
@Directive()
export abstract class AbstractDbxTableGroupDirective<T, C = unknown, G = unknown> {
  readonly tableStore = inject(DbxTableStore<unknown, C, T, G>);

  readonly group = input<Maybe<DbxTableItemGroup<T, G>>>();
  readonly group$ = toObservable(this.group).pipe(filterMaybe(), distinctUntilChanged());
}
