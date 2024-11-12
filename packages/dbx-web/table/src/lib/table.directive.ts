import { Input, Directive, inject } from '@angular/core';
import { DbxTableStore } from './table.store';
import { Maybe } from '@dereekb/util';
import { DbxTableContextDataDelegate, DbxTableViewDelegate } from './table';

/**
 * Directive for providing and configuring a DbxTableStore
 */
@Directive({
  selector: '[dbxTable]',
  providers: [DbxTableStore]
})
export class DbxTableDirective<I, C, T> {
  readonly tableStore = inject(DbxTableStore<I, C, T>);

  @Input()
  set dbxTableInput(input: Maybe<I>) {
    this.tableStore.setInput(input);
  }

  @Input()
  set dbxTableViewDelegate(dbxTableViewDelegate: Maybe<DbxTableViewDelegate<I, C, T>>) {
    this.tableStore.setViewDelegate(dbxTableViewDelegate);
  }

  @Input()
  set dbxTableDataDelegate(dbxTableDataDelegate: Maybe<DbxTableContextDataDelegate<I, C, T>>) {
    this.tableStore.setDataDelegate(dbxTableDataDelegate);
  }
}
