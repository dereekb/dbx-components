import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { map, distinctUntilChanged, switchMap, of } from 'rxjs';
import { AbstractDbxTableColumnDirective } from './table.column.directive';

@Component({
  selector: 'dbx-table-column-header',
  template: `
    <dbx-injection [config]="config$ | async"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTableColumnHeaderComponent<C> extends AbstractDbxTableColumnDirective<C> implements OnDestroy {
  readonly config$ = this.tableStore.viewDelegate$.pipe(
    switchMap((viewDelegate) => {
      const columnHeader = viewDelegate.columnHeader;

      if (columnHeader) {
        return this.column$.pipe(map((x) => columnHeader(x)));
      } else {
        return of(undefined);
      }
    }),
    distinctUntilChanged()
  );
}
