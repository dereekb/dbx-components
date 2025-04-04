import { filterMaybe } from '@dereekb/rxjs';
import { ChangeDetectionStrategy, Component, Input, OnDestroy } from '@angular/core';
import { map, distinctUntilChanged, BehaviorSubject, switchMap, combineLatest } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { AbstractDbxTableElementDirective } from './table.item.directive';
import { DbxTableColumn } from './table';

@Component({
  selector: 'dbx-table-item-cell',
  template: `
    <dbx-injection [config]="config$ | async"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTableItemCellComponent<T, C> extends AbstractDbxTableElementDirective implements OnDestroy<T, C> {
  private readonly _column = new BehaviorSubject<Maybe<DbxTableColumn<C>>>(undefined);
  readonly column$ = this._column.pipe(filterMaybe(), distinctUntilChanged());

  readonly config$ = this.tableStore.viewDelegate$.pipe(
    switchMap((viewDelegate) => combineLatest([this.column$, this.element$]).pipe(map(([column, element]) => viewDelegate.itemCell(column, element)))),
    distinctUntilChanged()
  );

  @Input()
  set column(column: Maybe<DbxTableColumn<C>>) {
    this._column.next(column);
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._column.complete();
  }
}
