import { ChangeDetectionStrategy, Component } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, distinctUntilChanged, switchMap, of, Observable } from 'rxjs';
import { AbstractDbxTableElementDirective } from './table.item.directive';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import { MaybeObservableOrValue, maybeValueFromObservableOrValue, switchMapFilterMaybe } from '@dereekb/rxjs';

@Component({
  selector: 'dbx-table-item-action',
  template: `
    <dbx-injection [config]="configSignal()"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxInjectionComponent],
  standalone: true
})
export class DbxTableItemActionComponent<T> extends AbstractDbxTableElementDirective<T> {
  readonly config$ = this.tableStore.viewDelegate$.pipe(
    map((viewDelegate) => {
      const itemAction = viewDelegate.itemAction;
      let obs: MaybeObservableOrValue<DbxInjectionComponentConfig> = undefined;

      if (itemAction) {
        obs = this.element$.pipe(map((x) => itemAction(x)));
      }

      return obs;
    }),
    maybeValueFromObservableOrValue(),
    distinctUntilChanged()
  );

  readonly configSignal = toSignal(this.config$);
}
