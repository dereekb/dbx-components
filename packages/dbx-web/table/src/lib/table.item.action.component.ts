import { filterMaybe } from '@dereekb/rxjs';
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, Input } from '@angular/core';
import { AbstractDbxInjectionDirective } from '@dereekb/dbx-core';
import { map, distinctUntilChanged, BehaviorSubject, switchMap, of } from 'rxjs';
import { DbxTableStore } from './table.store';
import { Maybe } from '@dereekb/util';
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
