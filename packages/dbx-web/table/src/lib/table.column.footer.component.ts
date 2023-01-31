import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { map, distinctUntilChanged, switchMap, of } from 'rxjs';
import { AbstractDbxTableColumnDirective } from './table.column.directive';

@Component({
  selector: 'dbx-table-column-footer',
  template: `
    <dbx-injection [config]="config$ | async"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTableColumnFooterComponent<C> extends AbstractDbxTableColumnDirective<C> implements OnDestroy {
  readonly config$ = this.tableStore.viewDelegate$.pipe(
    switchMap((viewDelegate) => {
      const columnFooter = viewDelegate.columnFooter;

      if (columnFooter) {
        return this.column$.pipe(map((x) => columnFooter(x)));
      } else {
        return of(undefined);
      }
    }),
    distinctUntilChanged()
  );
}
