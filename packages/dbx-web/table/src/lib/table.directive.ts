import { Directive, inject, input, effect } from '@angular/core';
import { DbxTableStore } from './table.store';
import { type Maybe } from '@dereekb/util';
import { DbxTableContextDataDelegate, DbxTableViewDelegate } from './table';

/**
 * Directive for providing and configuring a DbxTableStore
 */
@Directive({
  selector: '[dbxTable]',
  providers: [DbxTableStore],
  standalone: true
})
export class DbxTableDirective<I, C, T> {
  readonly tableStore = inject(DbxTableStore<I, C, T>);

  readonly dbxTableInput = input<Maybe<I>>();
  readonly dbxTableViewDelegate = input<Maybe<DbxTableViewDelegate<I, C, T>>>();
  readonly dbxTableDataDelegate = input<Maybe<DbxTableContextDataDelegate<I, C, T>>>();

  protected readonly _setOnTableStoreEffect = effect(() => {
    this.tableStore.setInput(this.dbxTableInput());
    this.tableStore.setViewDelegate(this.dbxTableViewDelegate());
    this.tableStore.setDataDelegate(this.dbxTableDataDelegate());
  });
}
