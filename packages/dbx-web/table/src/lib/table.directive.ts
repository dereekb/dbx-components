import { filterMaybe } from '@dereekb/rxjs';
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, Input, Directive } from '@angular/core';
import { AbstractDbxInjectionDirective } from '@dereekb/dbx-core';
import { map, distinctUntilChanged, BehaviorSubject, switchMap } from 'rxjs';
import { DbxTableStore } from './table.store';
import { Maybe } from '@dereekb/util';
import { AbstractDbxTableElementDirective } from './table.item.directive';
import { DbxTableContextDataDelegate, DbxTableViewDelegate } from './table';

/**
 * Directive for providing and configuring a DbxTableStore
 */
@Directive({
  selector: '[dbxTable]',
  providers: [DbxTableStore]
})
export class DbxTableDirective<I, C, T> {
  constructor(readonly tableStore: DbxTableStore<I, C, T>) {}

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
