import { filterMaybe } from '@dereekb/rxjs';
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, Input } from '@angular/core';
import { AbstractDbxInjectionDirective } from '@dereekb/dbx-core';
import { map, distinctUntilChanged, BehaviorSubject, switchMap } from 'rxjs';
import { DbxTableStore } from './table.store';
import { Maybe } from '@dereekb/util';
import { AbstractDbxTableElementComponent } from './table.item.directive';

@Component({
  selector: 'dbx-table-item-header',
  template: `
    <dbx-injection [config]="config$ | async"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTableItemHeaderComponent<T> extends AbstractDbxTableElementComponent<T> {
  readonly config$ = this.tableStore.viewDelegate$.pipe(
    switchMap((viewDelegate) => this.element$.pipe(map((x) => viewDelegate.itemHeader(x)))),
    distinctUntilChanged()
  );
}
