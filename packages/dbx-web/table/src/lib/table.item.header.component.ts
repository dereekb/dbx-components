import { ChangeDetectionStrategy, Component } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, distinctUntilChanged, switchMap } from 'rxjs';
import { AbstractDbxTableElementDirective } from './table.item.directive';
import { maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { DbxInjectionComponent } from '@dereekb/dbx-core';

@Component({
  selector: 'dbx-table-item-header',
  template: `
    <dbx-injection [config]="configSignal()"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxInjectionComponent],
  standalone: true
})
export class DbxTableItemHeaderComponent<T> extends AbstractDbxTableElementDirective<T> {
  readonly config$ = this.tableStore.viewDelegate$.pipe(
    switchMap((viewDelegate) => this.element$.pipe(map((x) => viewDelegate.itemHeader(x)))),
    maybeValueFromObservableOrValue(),
    distinctUntilChanged()
  );

  readonly configSignal = toSignal(this.config$);
}
