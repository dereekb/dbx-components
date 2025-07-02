import { filterMaybe, maybeValueFromObservableOrValue, tapLog } from '@dereekb/rxjs';
import { ChangeDetectionStrategy, Component, input, OnDestroy } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { map, distinctUntilChanged, switchMap, combineLatest } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { AbstractDbxTableItemDirective } from './table.item.directive';
import { DbxTableColumn } from './table';
import { DbxInjectionComponent } from '@dereekb/dbx-core';

@Component({
  selector: 'dbx-table-item-cell',
  template: `
    <dbx-injection [config]="configSignal()"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxInjectionComponent],
  standalone: true
})
export class DbxTableItemCellComponent<T, C> extends AbstractDbxTableItemDirective<T, C> {
  readonly column = input<Maybe<DbxTableColumn<C>>>();
  readonly column$ = toObservable(this.column);

  readonly config$ = this.tableStore.viewDelegate$.pipe(switchMap((viewDelegate) => combineLatest([this.column$, this.item$]).pipe(map(([column, item]) => (column && item ? viewDelegate.itemCell(column, item) : undefined)))));

  readonly configSignal = toSignal(this.config$);
}
