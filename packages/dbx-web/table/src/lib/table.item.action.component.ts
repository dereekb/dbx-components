import { ChangeDetectionStrategy, Component } from '@angular/core';
import { map, distinctUntilChanged, switchMap, of } from 'rxjs';
import { AbstractDbxTableElementDirective } from './table.item.directive';

@Component({
  selector: 'dbx-table-item-action',
  template: `
    <dbx-injection [config]="config$ | async"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTableItemActionComponent<T> extends AbstractDbxTableElementDirective<T> {
  readonly config$ = this.tableStore.viewDelegate$.pipe(
    switchMap((viewDelegate) => {
      const itemAction = viewDelegate.itemAction;

      if (itemAction) {
        return this.element$.pipe(map((x) => itemAction(x)));
      } else {
        return of(undefined);
      }
    }),
    distinctUntilChanged()
  );
}
