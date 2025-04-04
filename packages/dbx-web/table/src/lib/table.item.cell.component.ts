import { filterMaybe, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { map, distinctUntilChanged, switchMap, combineLatest } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { AbstractDbxTableElementDirective } from './table.item.directive';
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
export class DbxTableItemCellComponent<T, C> extends AbstractDbxTableElementDirective<T, C> {
  readonly column = input<Maybe<DbxTableColumn<C>>>();

  readonly config$ = this.tableStore.viewDelegate$.pipe(
    switchMap((viewDelegate) => combineLatest([toObservable(this.column).pipe(filterMaybe()), this.element$]).pipe(map(([column, element]) => viewDelegate.itemCell(column, element)))),
    maybeValueFromObservableOrValue(),
    distinctUntilChanged()
  );

  readonly configSignal = toSignal(this.config$);
}
