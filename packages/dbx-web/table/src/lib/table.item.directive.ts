import { toObservable } from '@angular/core/rxjs-interop';
import { Directive, inject, input } from '@angular/core';
import { DbxTableStore } from './table.store';
import { type Maybe } from '@dereekb/util';

/**
 * Abstract directive that has an element input.
 */
@Directive()
export abstract class AbstractDbxTableItemDirective<T, C = unknown> {
  readonly tableStore = inject(DbxTableStore<unknown, C, T>);

  readonly item = input<Maybe<T>>();
  readonly item$ = toObservable(this.item);
}
