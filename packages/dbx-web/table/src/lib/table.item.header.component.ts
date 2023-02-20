import { ChangeDetectionStrategy, Component } from '@angular/core';
import { map, distinctUntilChanged, switchMap } from 'rxjs';
import { AbstractDbxTableElementDirective } from './table.item.directive';

@Component({
  selector: 'dbx-table-item-header',
  template: `
    <dbx-injection [config]="config$ | async"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTableItemHeaderComponent<T> extends AbstractDbxTableElementDirective<T> {
  readonly config$ = this.tableStore.viewDelegate$.pipe(
    switchMap((viewDelegate) => this.element$.pipe(map((x) => viewDelegate.itemHeader(x)))),
    distinctUntilChanged()
  );
}
